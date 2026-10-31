// Smoke check (F51) of a running Sketchy, from outside: /healthz, the client and its assets, the
// SPA fallback, room creation, and real WebSockets on both Socket.IO namespaces (`/` and `/ink`).
// `npm run smoke:docker` runs it against the container; it works against any URL.
//
//   npx tsx scripts/smoke.ts http://127.0.0.1:3000
//
// It creates one room (in memory, swept after 3 h idle) and joins it as a token Screen and one
// player; every socket is closed before it exits.
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { io, type Socket } from 'socket.io-client';
import { PLAYER_KEY_LENGTH } from '../shared/constants.js';
import type { CreateRoomResponse, View } from '../shared/types.js';

const STEP_MS = 5000;

type Ack = { ok: true; [key: string]: unknown } | { ok: false; error: string };

class SmokeError extends Error {}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SmokeError(message);
}

async function get(base: string, path: string): Promise<Response> {
  return fetch(new URL(path, base), { signal: AbortSignal.timeout(STEP_MS) });
}

function connect(base: string, path: '/' | '/ink', auth?: object): Promise<Socket> {
  // The gateway takes the WebSocket transport only, as the client does first (F39).
  const socket = io(new URL(path, base).href, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    timeout: STEP_MS,
    ...(auth ? { auth } : {}),
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

const emit = (socket: Socket, event: string, payload: object): Promise<Ack> =>
  socket.timeout(STEP_MS).emitWithAck(event, payload) as Promise<Ack>;

function nextState(socket: Socket, test: (view: View) => boolean): Promise<View> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('state', onState);
      reject(new SmokeError('no matching `state` within 5 s'));
    }, STEP_MS);
    function onState(view: View) {
      if (!test(view)) return;
      clearTimeout(timer);
      socket.off('state', onState);
      resolve(view);
    }
    socket.on('state', onState);
  });
}

/** Runs every check against `base`, logging one line per check; throws on the first failure. */
export async function runSmoke(base: string, log: (line: string) => void = console.log) {
  const health = await get(base, '/healthz');
  check(health.status === 200, `/healthz answered ${health.status}`);
  const body = (await health.json()) as unknown;
  check(JSON.stringify(body) === '{"ok":true}', `/healthz answered ${JSON.stringify(body)}`);
  log('ok   /healthz 200 {"ok":true}');

  const page = await get(base, '/');
  const html = await page.text();
  check(page.status === 200 && html.includes('<div id="root"'), '/ did not serve the client');
  log('ok   / serves the client');

  // The entry script Vite names in index.html: the built client really is in the image.
  const entry = /<script[^>]+src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
  check(entry, '/ names no /assets/*.js entry script');
  const script = await get(base, entry);
  check(
    script.status === 200 && /javascript/.test(script.headers.get('content-type') ?? ''),
    `${entry} answered ${script.status} ${script.headers.get('content-type')}`,
  );
  log(`ok   ${entry} is served`);

  const fallback = await get(base, '/play/ABCD');
  check(
    fallback.status === 200 && (await fallback.text()).includes('<div id="root"'),
    '/play/ABCD did not fall back to the client',
  );
  log('ok   /play/ABCD falls back to the client');

  const created = await fetch(new URL('/api/rooms', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(STEP_MS),
  });
  check(created.status === 201, `POST /api/rooms answered ${created.status}`);
  const { code, hostToken } = (await created.json()) as CreateRoomResponse;
  log(`ok   POST /api/rooms 201 (room ${code})`);

  // The word is the one secret: the dev route that reads it must not exist outside development.
  const devWord = await get(base, `/api/dev/rooms/${code}/word`);
  check(devWord.status === 404, `/api/dev/rooms/${code}/word answered ${devWord.status}`);
  log('ok   the dev word route is off');

  const sockets: Socket[] = [];
  const open = async (path: '/' | '/ink', auth?: object) => {
    const socket = await connect(base, path, auth);
    sockets.push(socket);
    return socket;
  };
  try {
    const screen = await open('/');
    const screenState = nextState(screen, (v) => v.role === 'screen' && v.code === code);
    const joined = await emit(screen, 'screen:join', { code, hostToken });
    check(joined.ok, `screen:join answered ${JSON.stringify(joined)}`);
    const sv = await screenState;
    check(sv.phase === 'LOBBY' && sv.host !== null, 'the token Screen is not the host in LOBBY');
    log('ok   main namespace: a token Screen joins and gets its state');

    const playerKey = randomBytes(32).toString('base64url').slice(0, PLAYER_KEY_LENGTH);
    const phone = await open('/');
    const phoneState = nextState(phone, (v) => v.role === 'player' && v.code === code);
    const seen = nextState(screen, (v) => v.players.some((p) => p.name === 'Smoke'));
    const playerJoin = await emit(phone, 'player:join', { code, playerKey, name: 'Smoke' });
    check(playerJoin.ok, `player:join answered ${JSON.stringify(playerJoin)}`);
    await Promise.all([phoneState, seen]);
    log('ok   main namespace: a player joins, and the Screen sees them');

    const screenInk = await open('/ink');
    const hello = await emit(screenInk, 'ink:hello', { code });
    check(hello.ok, `the Screen's ink:hello answered ${JSON.stringify(hello)}`);
    log('ok   /ink: the Screen says hello');

    const phoneInk = await open('/ink', { code, playerKey });
    const phoneHello = await emit(phoneInk, 'ink:hello', { code });
    check(phoneHello.ok, `the phone's ink:hello answered ${JSON.stringify(phoneHello)}`);
    log("ok   /ink: the phone's handshake is bound by its playerKey");

    const stranger = 'x'.repeat(PLAYER_KEY_LENGTH);
    const refused = await open('/ink', { code, playerKey: stranger }).then(
      () => 'connected',
      (err: Error) => err.message,
    );
    check(refused === 'notPlayer', `/ink with an unknown playerKey: ${refused}`);
    log('ok   /ink: an unknown playerKey is refused');
  } finally {
    for (const socket of sockets) socket.close();
  }
}

async function main() {
  const base = process.argv[2];
  if (!base) {
    console.error('usage: tsx scripts/smoke.ts <base URL>');
    process.exit(2);
  }
  try {
    await runSmoke(base);
    console.log('PASS');
  } catch (err) {
    console.error(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();

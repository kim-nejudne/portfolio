// Memory probe (F51): the peak memory of the production server through a 10-player game with a
// full gallery, which sets `mem_limit` in deploy/compose.deploy.yaml.
//
//   npm run build && npm run mem:probe [-- --games N] [--heap MB]
//
// It starts `dist/server/index.js` as a child (NODE_ENV=production, TRUST_PROXY=1), then plays
// N games at once over real sockets. Each game has a token Screen (main and /ink) and 10 players,
// each on one WebSocket for both namespaces, as a phone is:
// - every player sends a lobby doodle of nearly DOODLE_MAX_BYTES;
// - 3 cycles (30 turns), each drawer sending ink until the canvas is full (INK_TURN_MAX_BYTES),
//   which overflows the room's gallery budget (INK_ROOM_MAX_BYTES), while the guessers type
//   wrong guesses; the host skips each turn once the drawing is in;
// - at FINAL the Screen fetches every drawing for the gallery (`ink:get`).
// It samples the child's resident memory (/proc, so Linux only) every 50 ms and prints the idle,
// peak (all, and anonymous only) and final figures.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { Manager, type Socket } from 'socket.io-client';
import {
  CYCLES_CHOICES,
  DOODLE_MAX_BYTES,
  INK_BATCH_RATE_LIMIT,
  INK_GRID,
  INK_TURN_MAX_BYTES,
  MAX_PLAYERS,
  PLAYER_KEY_LENGTH,
} from '../shared/constants.js';
import { packBatches, strokeOps } from '../shared/ink.js';
import type { CreateRoomResponse, InkOp, PlayerView, ScreenView, View } from '../shared/types.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SERVER = 'dist/server/index.js';
const WAIT_MS = 20_000;
const WRONG = ['aso', 'pusa', 'bahay', 'kotse', 'puno', 'ulan', 'araw', 'bola', 'isda', 'tasa'];

type Ack = { ok: true; [key: string]: unknown } | { ok: false; error: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

function rssKb(pid: number, field: 'VmRSS' | 'VmHWM' | 'RssAnon'): number {
  const status = readFileSync(`/proc/${pid}/status`, 'utf8');
  return Number(new RegExp(`^${field}:\\s+(\\d+) kB`, 'm').exec(status)?.[1] ?? 0);
}

/** A deterministic scribble: strokes of 150 points wandering over the grid. */
function* scribble(seed: number): Generator<InkOp[]> {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1;
  for (let id = 1; ; id++) {
    let x = Math.floor(((rand() + 1) / 2) * INK_GRID);
    let y = Math.floor(((rand() + 1) / 2) * INK_GRID);
    const points: number[] = [];
    for (let i = 0; i < 150; i++) {
      x = Math.min(INK_GRID - 1, Math.max(0, Math.round(x + rand() * 12)));
      y = Math.min(INK_GRID - 1, Math.max(0, Math.round(y + rand() * 12)));
      points.push(x, y);
    }
    yield strokeOps({ id, color: id % 8, size: id % 3, points, ended: true });
  }
}

/** One WebSocket carrying `/` and `/ink`, from its own address (the join limit is per address). */
class Client {
  readonly main: Socket;
  readonly manager: Manager;
  latest: View | null = null;
  private waiters: (() => void)[] = [];

  constructor(base: string, ip: string) {
    this.manager = new Manager(base, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { 'X-Forwarded-For': ip },
    });
    this.main = this.manager.socket('/');
    this.main.on('state', (view: View) => {
      this.latest = view;
      for (const w of this.waiters.splice(0)) w();
    });
  }

  ink(auth?: object): Socket {
    return this.manager.socket('/ink', auth ? { auth } : {});
  }

  async waitFor(what: string, test: (view: View) => boolean): Promise<View> {
    const deadline = Date.now() + WAIT_MS;
    while (!this.latest || !test(this.latest)) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
        setTimeout(resolve, 250);
      });
    }
    return this.latest;
  }

  close() {
    this.main.close();
    this.manager.engine?.close();
  }
}

async function emit(socket: Socket, event: string, payload: object = {}): Promise<Ack> {
  return (await socket.timeout(WAIT_MS).emitWithAck(event, payload)) as Ack;
}

async function must(
  socket: Socket,
  event: string,
  payload: object = {},
): Promise<Extract<Ack, { ok: true }>> {
  const ack = await emit(socket, event, payload);
  if (!ack.ok) throw new Error(`${event} refused: ${ack.error}`);
  return ack;
}

async function playGame(base: string, g: number): Promise<{ turns: number; kept: number }> {
  const created = await fetch(new URL('/api/rooms', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${g}` },
    body: JSON.stringify({ settings: { cycles: Math.max(...CYCLES_CHOICES), drawSeconds: 100 } }),
  });
  if (created.status !== 201) throw new Error(`POST /api/rooms answered ${created.status}`);
  const { code, hostToken } = (await created.json()) as CreateRoomResponse;

  const screen = new Client(base, `198.51.100.${g}`);
  await must(screen.main, 'screen:join', { code, hostToken });
  const screenInk = screen.ink();
  await must(screenInk, 'ink:hello', { code });

  const phones: { client: Client; ink: Socket; pid: string; name: string }[] = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const client = new Client(base, `203.0.${g}.${i + 1}`);
    const playerKey = `${g}p${i}`.padEnd(PLAYER_KEY_LENGTH, 'k');
    const name = `Player ${i + 1}`;
    const ack = await must(client.main, 'player:join', { code, playerKey, name, avatar: '🦊' });
    const ink = client.ink({ code, playerKey });
    // A doodle just under the limit.
    const ops: InkOp[] = [];
    for (const stroke of scribble(1000 * g + i)) {
      if (JSON.stringify([...ops, ...stroke]).length > DOODLE_MAX_BYTES) break;
      ops.push(...stroke);
    }
    await must(ink, 'doodle:batch', { ops });
    phones.push({ client, ink, pid: ack.pid as string, name });
  }
  await screen.waitFor('10 players', (v) => v.players.length === MAX_PLAYERS);
  await must(screen.main, 'host:start');

  let turns = 0;
  const batchGapMs = Math.ceil(1000 / (INK_BATCH_RATE_LIMIT.max - 8));
  for (;;) {
    const view = (await screen.waitFor('a game phase', (v) =>
      ['CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'].includes(v.phase),
    )) as ScreenView;
    if (view.phase === 'FINAL') break;
    const turn = view.turn!;
    if (view.phase === 'CHOOSING') {
      const drawer = phones.find((p) => p.pid === turn.drawerPid)!;
      await drawer.client.waitFor('the choices', (v) => !!(v as PlayerView).secret?.choices);
      await must(drawer.client.main, 'drawer:choose', { index: 0 });
      await screen.waitFor('DRAWING', (v) => v.phase === 'DRAWING');
    } else if (view.phase === 'DRAWING') {
      turns++;
      const drawer = phones.find((p) => p.pid === turn.drawerPid)!;
      const guessers = phones.filter((p) => p !== drawer);
      const guessing = Promise.all(
        guessers.map(async (p, i) => {
          for (let k = 0; k < 3; k++) {
            await sleep(800);
            await emit(p.client.main, 'player:guess', { text: WRONG[(i + k + turns) % 10]! });
          }
        }),
      );
      const ops: InkOp[] = [];
      let bytes = 0;
      for (const stroke of scribble(turn.id * 7919 + g)) {
        bytes += JSON.stringify(stroke).length;
        if (bytes > INK_TURN_MAX_BYTES * 0.97) break;
        ops.push(...stroke);
      }
      for (const batch of packBatches(turn.id, 1, ops)) {
        const ack = await emit(drawer.ink, 'ink:batch', batch);
        if (!ack.ok && ack.error === 'inkFull') break;
        if (!ack.ok) throw new Error(`ink:batch refused: ${ack.error}`);
        await sleep(batchGapMs);
      }
      await guessing;
      await must(screen.main, 'host:skip');
      await screen.waitFor('the reveal', (v) => v.phase !== 'DRAWING');
    } else {
      const { phase } = view;
      await must(screen.main, 'host:next');
      await screen.waitFor('the next phase', (v) => v.phase !== phase || v.turn?.id !== turn.id);
    }
  }

  // The Screen's gallery asks for every drawing; the oldest are past the room's budget.
  const final = screen.latest as ScreenView;
  let kept = 0;
  for (const { turnId } of final.gallery) {
    const ack = await emit(screenInk, 'ink:get', { turnId });
    if (ack.ok) kept++;
    else if (ack.error !== 'inkNotKept') throw new Error(`ink:get refused: ${ack.error}`);
  }
  for (const p of phones) p.client.close();
  screen.close();
  return { turns, kept };
}

async function main() {
  if (!existsSync(`${ROOT}/${SERVER}`)) {
    console.error(`No ${SERVER}: run \`npm run build\` first.`);
    process.exit(2);
  }
  const gamesArg = process.argv.indexOf('--games');
  const games = gamesArg === -1 ? 1 : Number(process.argv[gamesArg + 1]);
  // `--heap MB` caps V8's old space, as a container's memory limit would: the smallest cap that
  // still plays through is what the game needs, apart from lazy collection.
  const heapArg = process.argv.indexOf('--heap');
  const nodeArgs = heapArg === -1 ? [] : [`--max-old-space-size=${process.argv[heapArg + 1]}`];
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [...nodeArgs, SERVER], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), TRUST_PROXY: '1' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const pid = child.pid!;
  try {
    for (let i = 0; ; i++) {
      if (i > 100) throw new Error('the server did not answer /healthz');
      const ok = await fetch(`${base}/healthz`).then(
        (r) => r.ok,
        () => false,
      );
      if (ok) break;
      await sleep(100);
    }
    await sleep(1000);
    const idle = rssKb(pid, 'VmRSS');
    let peak = idle;
    // Anonymous memory (heap, buffers) without the mapped Node binary, which the kernel can drop.
    let peakAnon = rssKb(pid, 'RssAnon');
    const sampler = setInterval(() => {
      peak = Math.max(peak, rssKb(pid, 'VmRSS'));
      peakAnon = Math.max(peakAnon, rssKb(pid, 'RssAnon'));
    }, 50);
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: games }, (_, g) => playGame(base, g + 1)),
    );
    clearInterval(sampler);
    const mb = (kb: number) => `${(kb / 1024).toFixed(1)} MB`;
    for (const [g, r] of results.entries())
      console.log(`game ${g + 1}: ${r.turns} turns, ${r.kept} drawings kept for the gallery`);
    if (nodeArgs.length) console.log(nodeArgs[0]);
    console.log(`${games} game(s) in ${((Date.now() - started) / 1000).toFixed(0)} s`);
    console.log(`RSS idle   ${mb(idle)}`);
    console.log(`RSS peak   ${mb(Math.max(peak, rssKb(pid, 'VmHWM')))} (VmHWM)`);
    console.log(`anon peak  ${mb(peakAnon)} (RssAnon)`);
    console.log(`RSS final  ${mb(rssKb(pid, 'VmRSS'))}`);
  } finally {
    child.kill('SIGTERM');
  }
}

await main();

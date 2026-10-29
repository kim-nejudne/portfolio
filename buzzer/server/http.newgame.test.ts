import { afterEach, describe, expect, it } from 'vitest';
import { CREATE_ROOM_BODY_MAX_BYTES, ROOM_CODE_ALPHABET } from '../shared/constants.js';
import type {
  HostView,
  HttpErrorBody,
  NewGameBody,
  PlayerView,
  QuestionSet,
  ScreenView,
  View,
} from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import {
  TOKEN,
  flush,
  hostJoin,
  playerJoin,
  recordStates,
  screenJoin,
  start,
  stopAll,
  type Harness,
} from './test/sockets.js';
import { T0, makeQuestion, makeRoom, makeSet } from './test/rooms.js';

afterEach(stopAll);

/** The first game's set: question 1 shows an image. */
const firstSet: QuestionSet = {
  ...makeSet(2),
  questions: [makeQuestion(1, { imageId: 'old-img' }), makeQuestion(2)],
};

/** The next game's set, with its own image and secrets. */
const nextSet: QuestionSet = {
  id: 'set2',
  title: 'Movies',
  questions: [
    makeQuestion(1, {
      id: 'm1',
      imageId: 'new-img',
      answer: 'Jaws-secret',
      hostNotes: 'Shark-notes',
    }),
    makeQuestion(2, { id: 'm2', answer: 'Alien-secret', hostNotes: 'Ripley-notes' }),
    makeQuestion(3, { id: 'm3', answer: 'Heat-secret', hostNotes: 'Pacino-notes' }),
  ],
  createdAt: T0,
  updatedAt: T0,
  schemaVersion: 1,
};

const body = (keepScores = false): NewGameBody => ({ set: nextSet, keepScores });

function put(
  h: Harness,
  payload: unknown,
  { auth = `Bearer ${TOKEN}`, code = 'ABCD' }: { auth?: string | null; code?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth) headers.authorization = auth;
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return fetch(`${h.base}/api/rooms/${code}/set`, { method: 'PUT', headers, body: raw });
}

function upload(h: Harness, imageId: string): Promise<Response> {
  return fetch(`${h.base}/api/rooms/ABCD/images/${imageId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'image/webp' },
    body: new Uint8Array(100).fill(1),
  });
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as HttpErrorBody).error;
}

/** Room ABCD with the first set and `TOKEN`, in `phase`. */
function startIn(phase: 'LOBBY' | 'FINAL' = 'FINAL') {
  return start({
    room: makeRoom({ hostTokenHash: hashHostToken(TOKEN), set: firstSet, phase }),
  });
}

describe('PUT /api/rooms/:code/set', () => {
  it('starts a new game in FINAL and answers 200 {ok: true}', async () => {
    const h = await startIn();
    const res = await put(h, body());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const room = h.rooms.get('ABCD')!;
    expect(room.phase).toBe('LOBBY');
    expect(room.set).toEqual(nextSet);
  });

  it('answers 404 for a room that does not exist, or a malformed code', async () => {
    const h = await startIn();
    const other =
      ROOM_CODE_ALPHABET[0]!.repeat(4) === 'ABCD' ? 'BBBB' : ROOM_CODE_ALPHABET[0]!.repeat(4);
    for (const code of [other, 'not-a-code']) {
      const res = await put(h, body(), { code });
      expect(res.status, code).toBe(404);
    }
    expect(h.rooms.get('ABCD')!.phase).toBe('FINAL');
  });

  it('answers 401 without the Bearer hostToken, or with a wrong one, and changes nothing', async () => {
    const h = await startIn();
    for (const auth of [null, `Bearer ${generateHostToken()}`, TOKEN, 'Bearer']) {
      const res = await put(h, body(), { auth });
      expect(res.status, String(auth)).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
    }
    expect(h.rooms.get('ABCD')!.phase).toBe('FINAL');
  });

  it('answers 400 for an invalid body or malformed JSON', async () => {
    const h = await startIn();
    const invalid: unknown[] = [
      {},
      { set: nextSet },
      { set: nextSet, keepScores: 'yes' },
      { set: { ...nextSet, questions: [] }, keepScores: false },
      '{"set":',
    ];
    for (const payload of invalid) {
      const res = await put(h, payload);
      expect(res.status, JSON.stringify(payload)).toBe(400);
      expect(await errorOf(res)).toMatch(/./);
    }
    expect(h.rooms.get('ABCD')!.phase).toBe('FINAL');
  });

  it('takes a body up to CREATE_ROOM_BODY_MAX_BYTES and refuses a larger one with 413', async () => {
    const h = await startIn();
    const padded = (bytes: number) => {
      const json = JSON.stringify({ ...body(), pad: '' });
      return json.replace('"pad":""', `"pad":"${'x'.repeat(bytes - json.length)}"`);
    };
    expect((await put(h, padded(CREATE_ROOM_BODY_MAX_BYTES + 1))).status).toBe(413);
    expect(h.rooms.get('ABCD')!.phase).toBe('FINAL');
    expect((await put(h, padded(CREATE_ROOM_BODY_MAX_BYTES))).status).toBe(200);
  });

  it('answers 409 outside FINAL', async () => {
    const h = await startIn('LOBBY');
    const res = await put(h, body());
    expect(res.status).toBe(409);
    expect(h.rooms.get('ABCD')!.set).toEqual(firstSet);
  });

  it('answers 409 to a second request, as when the Screen and the remote race', async () => {
    const h = await startIn();
    const [a, b] = await Promise.all([put(h, body()), put(h, { ...body(), keepScores: true })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await put(h, body())).status).toBe(409);
  });

  it("frees the old set's images, then accepts uploads of the new set's images only", async () => {
    const h = await startIn();
    expect((await upload(h, 'old-img')).status).toBe(201);
    expect(h.images.get('ABCD', 'old-img')).toBeDefined();

    expect((await put(h, body())).status).toBe(200);
    expect(h.images.get('ABCD', 'old-img')).toBeUndefined();
    expect(h.images.totalBytes).toBe(0);

    expect((await upload(h, 'old-img')).status).toBe(404);
    expect((await upload(h, 'new-img')).status).toBe(201);
    expect(h.images.get('ABCD', 'new-img')).toBeDefined();
  });

  it('keeps the images when the request is refused', async () => {
    const h = await startIn('LOBBY');
    expect((await upload(h, 'old-img')).status).toBe(201);
    expect((await put(h, body())).status).toBe(409);
    expect(h.images.get('ABCD', 'old-img')).toBeDefined();
  });

  describe('through the gateway', () => {
    /** Screen, a Screen holding the token, the Host remote and player a, joined, then End game. */
    async function endedTable() {
      const h = await startIn('LOBBY');
      const [screen, hostingScreen, host, player] = await Promise.all([
        h.connect(),
        h.connect(),
        h.connect(),
        h.connect(),
      ]);
      await screenJoin(screen);
      await screenJoin(hostingScreen, TOKEN);
      await hostJoin(host);
      await playerJoin(player, 'a', 'Ann');
      expect(await host.emitWithAck('host:start', {})).toEqual({ ok: true });
      expect(await host.emitWithAck('host:adjustScore', { playerId: 'a', delta: 200 })).toEqual({
        ok: true,
      });
      expect(await host.emitWithAck('host:end', {})).toEqual({ ok: true });
      const sockets = [screen, hostingScreen, host, player];
      await Promise.all(sockets.map(flush));
      return { h, sockets, screen, hostingScreen, host, player };
    }

    it('sends Screen, hosting Screen, Host and Player the LOBBY with the new question count', async () => {
      const { h, sockets } = await endedTable();
      const states = sockets.map(recordStates);
      expect((await put(h, body())).status).toBe(200);
      await Promise.all(sockets.map(flush));

      const [screen, hostingScreen, host, player] = states.map((s) => s.at(-1));
      for (const view of [screen, hostingScreen, host, player]) {
        expect(view?.phase).toBe('LOBBY');
        expect((view as ScreenView | HostView | PlayerView).questionIndex).toBe(-1);
      }
      expect((screen as ScreenView).questionCount).toBe(3);
      expect((hostingScreen as ScreenView).questionCount).toBe(3);
      expect((host as HostView).questionCount).toBe(3);
      expect((host as HostView).title).toBe('Movies');
    });

    it('zeroes the scores, or keeps them with keepScores, on every device', async () => {
      for (const keepScores of [false, true]) {
        const { h, sockets } = await endedTable();
        const states = sockets.map(recordStates);
        expect((await put(h, body(keepScores))).status).toBe(200);
        await Promise.all(sockets.map(flush));
        const host = states[2]!.at(-1) as HostView;
        expect(host.players.find((p) => p.id === 'a')?.score).toBe(keepScores ? 200 : 0);
        await stopAll();
      }
    });

    it("never sends the new set's answers or host notes to Screen or Player views", async () => {
      const { h, sockets } = await endedTable();
      const states = sockets.map(recordStates);
      expect((await put(h, body())).status).toBe(200);
      await Promise.all(sockets.map(flush));
      // Play on into the first question too: still nothing before reveal.
      const host = sockets[2]!;
      expect(await host.emitWithAck('host:start', {})).toEqual({ ok: true });
      await Promise.all(sockets.map(flush));

      const leaky: View[] = [...states[0]!, ...states[1]!, ...states[3]!];
      expect(leaky.length).toBeGreaterThanOrEqual(6);
      const json = JSON.stringify(leaky);
      for (const secret of nextSet.questions.flatMap((q) => [q.answer, q.hostNotes!])) {
        expect(json).not.toContain(secret);
      }
    });

    it('lets the host start the new game, which plays the new set', async () => {
      const { h, host, player } = await endedTable();
      expect((await put(h, body())).status).toBe(200);
      const states = recordStates(player);
      expect(await host.emitWithAck('host:start', {})).toEqual({ ok: true });
      await flush(player);
      expect(states.at(-1)?.phase).toBe('QUESTION');
      expect(h.rooms.get('ABCD')!.set.questions[0]?.id).toBe('m1');
    });
  });
});

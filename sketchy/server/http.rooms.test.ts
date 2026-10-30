import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  ROOM_CHECK_RATE_LIMIT,
  ROOM_CREATE_RATE_LIMIT,
  ROOM_IDLE_TTL_MS,
} from '../shared/constants.js';
import { roomCodeSchema } from '../shared/schemas.js';
import type { CreateRoomResponse, Player, Room, RoomExistsResponse } from '../shared/types.js';
import { hashHostToken, verifyHostToken } from './hostToken.js';
import { createApp, type AppOptions } from './http.js';
import { createRoom } from './room.js';
import { createRng } from './rng.js';
import { InMemoryRoomStore } from './roomStore.js';
import { TEST_PACKS } from './test/packs.js';

const T0 = 1_800_000_000_000;

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

interface Setup {
  base: string;
  rooms: InMemoryRoomStore;
  advance: (ms: number) => void;
}

async function setup(options: Partial<AppOptions> = {}): Promise<Setup> {
  let now = T0;
  const rooms = new InMemoryRoomStore();
  const rng = createRng(1);
  server = createApp({
    packs: TEST_PACKS,
    rooms,
    clock: () => now,
    rng: () => rng.next(),
    ...options,
  }).listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    rooms,
    advance: (ms) => {
      now += ms;
    },
  };
}

function postRoom(base: string, body?: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/api/rooms`, {
    method: 'POST',
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function exists(base: string, code: string): Promise<RoomExistsResponse> {
  const res = await fetch(`${base}/api/rooms/${code}/exists`);
  expect(res.status).toBe(200);
  return (await res.json()) as RoomExistsResponse;
}

function player(pid: string): Player {
  return {
    pid,
    keyHash: `hash-${pid}`,
    name: pid,
    color: '#ffffff',
    score: 0,
    connected: true,
    hidden: false,
    hasDoodle: false,
    joinedAt: T0,
  };
}

function withPlayers(room: Room, count: number): Room {
  const players = Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`p${i}`, player(`p${i}`)]),
  );
  return { ...room, players };
}

describe('POST /api/rooms', () => {
  it('returns 201 {code, hostToken} and stores a LOBBY room with only the token hash', async () => {
    const { base, rooms } = await setup();
    const res = await postRoom(base, {});
    expect(res.status).toBe(201);
    const body = (await res.json()) as CreateRoomResponse;
    expect(Object.keys(body).sort()).toEqual(['code', 'hostToken']);
    expect(roomCodeSchema.parse(body.code)).toBe(body.code);

    const room = rooms.get(body.code)!;
    expect(room.phase).toBe('LOBBY');
    expect(room.settings).toEqual(DEFAULT_SETTINGS);
    expect(room.createdAt).toBe(T0);
    expect(room.lastActivityAt).toBe(T0);
    expect(room.hostTokenHash).toBe(hashHostToken(body.hostToken));
    expect(verifyHostToken(body.hostToken, room.hostTokenHash)).toBe(true);
    expect(JSON.stringify(room)).not.toContain(body.hostToken);
  });

  it('accepts an empty body', async () => {
    const { base, rooms } = await setup();
    const res = await postRoom(base);
    expect(res.status).toBe(201);
    expect(rooms.size).toBe(1);
  });

  it('applies partial settings over the defaults', async () => {
    const { base, rooms } = await setup();
    const res = await postRoom(base, { settings: { drawSeconds: 60, cycles: 3 } });
    const { code } = (await res.json()) as CreateRoomResponse;
    expect(rooms.get(code)!.settings).toEqual({ ...DEFAULT_SETTINGS, drawSeconds: 60, cycles: 3 });
  });

  it('rejects invalid settings with 400 JSON and creates no room', async () => {
    const { base, rooms } = await setup();
    for (const body of [{ settings: { drawSeconds: 61 } }, { settings: { drawSecs: 60 } }]) {
      const res = await postRoom(base, body);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    }
    expect(rooms.size).toBe(0);
  });

  it('rejects malformed JSON and an oversized body with a JSON error', async () => {
    const { base, rooms } = await setup();
    const bad = await postRoom(base, '{"settings":');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ ok: false });

    const big = await postRoom(base, { settings: {}, pad: 'x'.repeat(10_000) });
    expect(big.status).toBe(413);
    expect(await big.json()).toMatchObject({ ok: false });
    expect(rooms.size).toBe(0);
  });

  it('gives each room a different code and token', async () => {
    const { base, rooms } = await setup();
    const a = (await (await postRoom(base, {})).json()) as CreateRoomResponse;
    const b = (await (await postRoom(base, {})).json()) as CreateRoomResponse;
    expect(a.code).not.toBe(b.code);
    expect(a.hostToken).not.toBe(b.hostToken);
    expect(rooms.size).toBe(2);
  });

  it('allows 10 rooms per IP per hour, then answers 429 until the hour has passed', async () => {
    const { base, rooms, advance } = await setup();
    for (let i = 0; i < ROOM_CREATE_RATE_LIMIT.max; i++) {
      expect((await postRoom(base, {})).status).toBe(201);
    }
    const refused = await postRoom(base, {});
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ ok: false });
    expect(rooms.size).toBe(ROOM_CREATE_RATE_LIMIT.max);

    advance(ROOM_CREATE_RATE_LIMIT.windowMs - 1);
    expect((await postRoom(base, {})).status).toBe(429);
    advance(1);
    expect((await postRoom(base, {})).status).toBe(201);
  });

  it('counts invalid requests against the limit too', async () => {
    const { base } = await setup();
    for (let i = 0; i < ROOM_CREATE_RATE_LIMIT.max; i++) {
      expect((await postRoom(base, { settings: { bogus: 1 } })).status).toBe(400);
    }
    expect((await postRoom(base, {})).status).toBe(429);
  });

  it('ignores X-Forwarded-For unless trustProxy is set', async () => {
    const { base } = await setup();
    for (let i = 0; i < ROOM_CREATE_RATE_LIMIT.max; i++) {
      await postRoom(base, {}, { 'x-forwarded-for': `10.0.0.${i}` });
    }
    expect((await postRoom(base, {}, { 'x-forwarded-for': '10.0.1.1' })).status).toBe(429);
  });

  it('limits each client address separately behind a trusted proxy', async () => {
    const { base } = await setup({ trustProxy: 1 });
    for (let i = 0; i < ROOM_CREATE_RATE_LIMIT.max; i++) {
      expect((await postRoom(base, {}, { 'x-forwarded-for': '10.0.0.1' })).status).toBe(201);
    }
    expect((await postRoom(base, {}, { 'x-forwarded-for': '10.0.0.1' })).status).toBe(429);
    expect((await postRoom(base, {}, { 'x-forwarded-for': '10.0.0.2' })).status).toBe(201);
  });

  it('skips codes already in use', async () => {
    // The same seed draws the same first code, so a second app with that room taken must move on.
    const first = await setup();
    const { code } = (await (await postRoom(first.base, {})).json()) as CreateRoomResponse;
    await new Promise((resolve) => server!.close(resolve));

    const rooms = new InMemoryRoomStore();
    rooms.set(createRoom({ code, hostTokenHash: 'taken', now: T0, seed: 1, packs: TEST_PACKS }));
    const second = await setup({ rooms });
    const res = (await (await postRoom(second.base, {})).json()) as CreateRoomResponse;
    expect(res.code).not.toBe(code);
    expect(rooms.get(code)!.hostTokenHash).toBe('taken');
  });

  it('answers 503 when no code is free', async () => {
    const { base, rooms } = await setup({ rng: () => 0 }); // always draws AAAA
    rooms.set(
      createRoom({ code: 'AAAA', hostTokenHash: 'taken', now: T0, seed: 1, packs: TEST_PACKS }),
    );
    const res = await postRoom(base, {});
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false });
    expect(rooms.size).toBe(1);
  });
});

describe('GET /api/rooms/:code/exists', () => {
  it('answers {exists: false, phase: null, full: false} for an unknown or malformed code', async () => {
    const { base } = await setup();
    const none: RoomExistsResponse = { exists: false, phase: null, full: false };
    expect(await exists(base, 'ZZZZ')).toEqual(none);
    expect(await exists(base, 'IIII')).toEqual(none);
    expect(await exists(base, 'ABCDE')).toEqual(none);
  });

  it('finds a created room by its code, in any case', async () => {
    const { base } = await setup();
    const { code } = (await (await postRoom(base, {})).json()) as CreateRoomResponse;
    const found: RoomExistsResponse = { exists: true, phase: 'LOBBY', full: false };
    expect(await exists(base, code)).toEqual(found);
    expect(await exists(base, code.toLowerCase())).toEqual(found);
  });

  it('reports the phase and whether the room is full', async () => {
    const { base, rooms } = await setup();
    const room = createRoom({
      code: 'ABCD',
      hostTokenHash: 'h',
      now: T0,
      seed: 1,
      packs: TEST_PACKS,
    });
    rooms.set(withPlayers(room, MAX_PLAYERS - 1));
    expect(await exists(base, 'ABCD')).toEqual({ exists: true, phase: 'LOBBY', full: false });
    rooms.set({ ...withPlayers(room, MAX_PLAYERS), phase: 'DRAWING' });
    expect(await exists(base, 'ABCD')).toEqual({ exists: true, phase: 'DRAWING', full: true });
  });

  it('never reveals the token hash or any other room data', async () => {
    const { base, rooms } = await setup();
    const { code } = (await (await postRoom(base, {})).json()) as CreateRoomResponse;
    const text = await (await fetch(`${base}/api/rooms/${code}/exists`)).text();
    expect(text).not.toContain(rooms.get(code)!.hostTokenHash);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(['exists', 'full', 'phase']);
  });

  it('is rate-limited per IP so the code space cannot be walked', async () => {
    const { base, advance } = await setup();
    for (let i = 0; i < ROOM_CHECK_RATE_LIMIT.max; i++) await exists(base, 'ZZZZ');
    const refused = await fetch(`${base}/api/rooms/ZZZZ/exists`);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ ok: false });
    advance(ROOM_CHECK_RATE_LIMIT.windowMs);
    expect((await exists(base, 'ZZZZ')).exists).toBe(false);
  });
});

describe('room expiry', () => {
  it('a room idle for 3 hours is swept and no longer exists; one used recently stays', async () => {
    const { base, rooms } = await setup();
    const { code: idle } = (await (await postRoom(base, {})).json()) as CreateRoomResponse;
    const { code: busy } = (await (await postRoom(base, {})).json()) as CreateRoomResponse;
    rooms.set({ ...rooms.get(busy)!, lastActivityAt: T0 + 60_000 });

    expect(rooms.sweep(T0 + ROOM_IDLE_TTL_MS - 1)).toEqual([]);
    expect(rooms.sweep(T0 + ROOM_IDLE_TTL_MS)).toEqual([idle]);
    expect((await exists(base, idle)).exists).toBe(false);
    expect((await exists(base, busy)).exists).toBe(true);
  });
});

describe('unknown API routes', () => {
  it('answer 404 JSON', async () => {
    const { base } = await setup();
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false });
  });
});

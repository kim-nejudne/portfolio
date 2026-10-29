import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  ROOM_CHECK_RATE_LIMIT,
  ROOM_CHECK_RATE_LIMITED_ERROR,
  ROOM_CREATE_RATE_LIMIT,
} from '../shared/constants.js';
import { hostTokenSchema } from '../shared/schemas.js';
import type {
  ConfigResponse,
  CreateRoomResponse,
  HttpErrorBody,
  RoomExistsResponse,
} from '../shared/types.js';
import { hashHostToken, verifyHostToken } from './hostToken.js';
import { createApp, type AppOptions } from './http.js';
import { InMemoryRoomStore } from './roomStore.js';
import { makeRoom, makeSet, T0 } from './test/rooms.js';

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

async function listen(options?: AppOptions): Promise<string> {
  server = createApp(options).listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe('HTTP app', () => {
  it('answers GET /healthz with 200 and {ok: true}', async () => {
    const base = await listen();
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('serves the built client, with index.html for client routes but not for /api or /socket.io', async () => {
    const clientDir = await mkdtemp(join(tmpdir(), 'buzzr-client-'));
    await writeFile(join(clientDir, 'index.html'), '<title>Buzzr test shell</title>');
    try {
      const base = await listen({ clientDir });
      for (const path of ['/', '/play/ABCD']) {
        const res = await fetch(`${base}${path}`);
        expect(res.status).toBe(200);
        expect(await res.text()).toContain('Buzzr test shell');
      }
      for (const path of ['/api/rooms', '/socket.io/']) {
        const res = await fetch(`${base}${path}`);
        expect(res.status).toBe(404);
        expect(await res.text()).not.toContain('Buzzr test shell');
      }
    } finally {
      await rm(clientDir, { recursive: true, force: true });
    }
  });
});

function postRoom(
  base: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${base}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validBody = { set: makeSet(), settings: DEFAULT_SETTINGS };

describe('POST /api/rooms', () => {
  it('creates a LOBBY room and returns 201 with {code, hostToken}', async () => {
    const rooms = new InMemoryRoomStore();
    const base = await listen({ rooms, clock: () => T0 });
    const res = await postRoom(base, validBody);
    expect(res.status).toBe(201);
    const { code, hostToken } = (await res.json()) as CreateRoomResponse;
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect(hostTokenSchema.safeParse(hostToken).success).toBe(true);

    const room = rooms.get(code);
    expect(room?.phase).toBe('LOBBY');
    expect(room?.set).toEqual(validBody.set);
    expect(room?.settings).toEqual(DEFAULT_SETTINGS);
    expect(room?.createdAt).toBe(T0);
    expect(room?.lastActivityAt).toBe(T0);
  });

  it('stores a choice question with its answer set to the correct choice, and drops stray choices', async () => {
    const rooms = new InMemoryRoomStore();
    const base = await listen({ rooms });
    const [first] = validBody.set.questions;
    const choice = {
      ...first!,
      id: 'qc',
      answer: '',
      mode: 'choice',
      choices: ['No', ' Yes '],
      correctChoice: 1,
    };
    const stray = { ...first!, id: 'qs', choices: ['A', 'B'], correctChoice: 0 };
    const body = { ...validBody, set: { ...validBody.set, questions: [choice, stray] } };
    const { code } = (await (await postRoom(base, body)).json()) as CreateRoomResponse;
    const [storedChoice, storedStray] = rooms.get(code)!.set.questions;
    expect(storedChoice).toMatchObject({ choices: ['No', 'Yes'], correctChoice: 1, answer: 'Yes' });
    expect(storedStray).toEqual({ ...first, id: 'qs' });
  });

  it('stores only the SHA-256 hash of the hostToken, never the token', async () => {
    const rooms = new InMemoryRoomStore();
    const base = await listen({ rooms });
    const { code, hostToken } = (await (
      await postRoom(base, validBody)
    ).json()) as CreateRoomResponse;
    const room = rooms.get(code)!;
    expect(room.hostTokenHash).toBe(hashHostToken(hostToken));
    expect(verifyHostToken(hostToken, room.hostTokenHash)).toBe(true);
    expect(JSON.stringify(room)).not.toContain(hostToken);
  });

  it('gives each room its own code and token', async () => {
    const rooms = new InMemoryRoomStore();
    const base = await listen({ rooms });
    const a = (await (await postRoom(base, validBody)).json()) as CreateRoomResponse;
    const b = (await (await postRoom(base, validBody)).json()) as CreateRoomResponse;
    expect(a.code).not.toBe(b.code);
    expect(a.hostToken).not.toBe(b.hostToken);
    expect(rooms.size).toBe(2);
  });

  it(`refuses the ${ROOM_CREATE_RATE_LIMIT.max + 1}th create from one IP within an hour with 429`, async () => {
    const rooms = new InMemoryRoomStore();
    let now = T0;
    const base = await listen({ rooms, clock: () => now });
    for (let i = 0; i < ROOM_CREATE_RATE_LIMIT.max; i++) {
      expect((await postRoom(base, validBody)).status).toBe(201);
    }
    const refused = await postRoom(base, validBody);
    expect(refused.status).toBe(429);
    expect(((await refused.json()) as HttpErrorBody).error).toMatch(/too many/i);
    expect(rooms.size).toBe(ROOM_CREATE_RATE_LIMIT.max);

    now += ROOM_CREATE_RATE_LIMIT.windowMs;
    expect((await postRoom(base, validBody)).status).toBe(201);
  });

  it('ignores X-Forwarded-For unless trust proxy is on', async () => {
    const base = await listen();
    for (let i = 0; i < ROOM_CREATE_RATE_LIMIT.max; i++) {
      await postRoom(base, validBody, { 'x-forwarded-for': `10.0.0.${i}` });
    }
    expect((await postRoom(base, validBody, { 'x-forwarded-for': '10.0.1.1' })).status).toBe(429);
  });

  it('limits by the forwarded client IP when trust proxy is on', async () => {
    const base = await listen({ trustProxy: 1 });
    for (let i = 0; i < ROOM_CREATE_RATE_LIMIT.max; i++) {
      await postRoom(base, validBody, { 'x-forwarded-for': '10.0.0.1' });
    }
    expect((await postRoom(base, validBody, { 'x-forwarded-for': '10.0.0.1' })).status).toBe(429);
    expect((await postRoom(base, validBody, { 'x-forwarded-for': '10.0.0.2' })).status).toBe(201);
  });

  it('rejects a bad body with 400 and an error naming the field', async () => {
    const rooms = new InMemoryRoomStore();
    const base = await listen({ rooms });
    const res = await postRoom(base, {
      set: { ...makeSet(), title: '' },
      settings: DEFAULT_SETTINGS,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as HttpErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error).toContain('set.title');
    expect(rooms.size).toBe(0);
  });

  it('rejects missing settings and an empty question list with 400', async () => {
    const base = await listen();
    const noSettings = await postRoom(base, { set: makeSet() });
    expect(noSettings.status).toBe(400);
    expect(((await noSettings.json()) as HttpErrorBody).error).toContain('settings');

    const empty = await postRoom(base, { set: makeSet(0), settings: DEFAULT_SETTINGS });
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as HttpErrorBody).error).toContain('set.questions');
  });

  it('rejects malformed JSON with 400 and a readable error', async () => {
    const base = await listen();
    const res = await postRoom(base, '{"set":');
    expect(res.status).toBe(400);
    expect((await res.json()) as HttpErrorBody).toEqual({
      ok: false,
      error: 'The request body is not valid JSON.',
    });
  });

  it('rejects a body over 1 MB with 413', async () => {
    const base = await listen();
    const res = await postRoom(base, {
      set: makeSet(),
      settings: DEFAULT_SETTINGS,
      pad: 'x'.repeat(1024 * 1024),
    });
    expect(res.status).toBe(413);
    expect(((await res.json()) as HttpErrorBody).ok).toBe(false);
  });

  it('answers 503 when no room code is free', async () => {
    const rooms = new InMemoryRoomStore();
    rooms.set(makeRoom({ code: 'AAAA' }));
    const base = await listen({ rooms, rng: () => 0 });
    const res = await postRoom(base, validBody);
    expect(res.status).toBe(503);
    expect(rooms.size).toBe(1);
  });
});

describe('GET /api/rooms/:code/exists', () => {
  it('returns {exists: true, phase} for a live room, in any case', async () => {
    const rooms = new InMemoryRoomStore();
    rooms.set(makeRoom({ code: 'ABCD', phase: 'OPEN' }));
    const base = await listen({ rooms });
    for (const code of ['ABCD', 'abcd']) {
      const res = await fetch(`${base}/api/rooms/${code}/exists`);
      expect(res.status).toBe(200);
      expect((await res.json()) as RoomExistsResponse).toEqual({ exists: true, phase: 'OPEN' });
    }
  });

  it('returns {exists: false, phase: null} for an unknown or malformed code', async () => {
    const base = await listen({ rooms: new InMemoryRoomStore() });
    for (const code of ['WXYZ', 'AB', 'AAAAAA', '1234']) {
      const res = await fetch(`${base}/api/rooms/${code}/exists`);
      expect(res.status).toBe(200);
      expect((await res.json()) as RoomExistsResponse).toEqual({ exists: false, phase: null });
    }
  });

  it(`refuses the ${ROOM_CHECK_RATE_LIMIT.max + 1}st check from one IP within a minute with 429`, async () => {
    let now = T0;
    const base = await listen({ clock: () => now });
    // The first check at T0, the other 29 a second later.
    for (let i = 0; i < ROOM_CHECK_RATE_LIMIT.max; i++) {
      if (i === 1) now += 1000;
      expect((await fetch(`${base}/api/rooms/WXYZ/exists`)).status).toBe(200);
    }
    const refused = await fetch(`${base}/api/rooms/WXYZ/exists`);
    expect(refused.status).toBe(429);
    expect((await refused.json()) as HttpErrorBody).toEqual({
      ok: false,
      error: ROOM_CHECK_RATE_LIMITED_ERROR,
    });

    // The window slides: one slot frees exactly a window after the first check, not before.
    now = T0 + ROOM_CHECK_RATE_LIMIT.windowMs - 1;
    expect((await fetch(`${base}/api/rooms/WXYZ/exists`)).status).toBe(429);
    now += 1;
    expect((await fetch(`${base}/api/rooms/WXYZ/exists`)).status).toBe(200);
    expect((await fetch(`${base}/api/rooms/WXYZ/exists`)).status).toBe(429);
  });

  it('limits checks by the forwarded client IP when trust proxy is on', async () => {
    const base = await listen({ trustProxy: 1 });
    const check = (ip: string) =>
      fetch(`${base}/api/rooms/WXYZ/exists`, { headers: { 'x-forwarded-for': ip } });
    for (let i = 0; i < ROOM_CHECK_RATE_LIMIT.max; i++) await check('10.0.0.1');
    expect((await check('10.0.0.1')).status).toBe(429);
    expect((await check('10.0.0.2')).status).toBe(200);
  });

  it('never exposes the hostToken hash or the set', async () => {
    const rooms = new InMemoryRoomStore();
    rooms.set(makeRoom({ code: 'ABCD' }));
    const base = await listen({ rooms });
    const text = await (await fetch(`${base}/api/rooms/ABCD/exists`)).text();
    expect(JSON.parse(text)).toEqual({ exists: true, phase: 'LOBBY' });
    expect(text).not.toContain('secret');
  });
});

/** GET with a chosen Host header, which `fetch` will not send. */
function getWithHost(base: string, path: string, host: string): Promise<ConfigResponse> {
  return new Promise((resolve, reject) => {
    request(`${base}${path}`, { headers: { host } }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => (body += chunk.toString()));
      res.on('end', () => resolve(JSON.parse(body) as ConfigResponse));
    })
      .on('error', reject)
      .end();
  });
}

const iface = (address: string, internal = false) => ({
  address,
  netmask: '255.255.255.0',
  family: 'IPv4' as const,
  mac: '00:00:00:00:00:00',
  internal,
  cidr: `${address}/24`,
});

describe('GET /api/config', () => {
  const interfaces = () => ({
    lo: [iface('127.0.0.1', true)],
    docker0: [iface('172.17.0.1')],
    wlan0: [iface('192.168.1.20')],
  });

  it('returns PUBLIC_URL for any Host when it is set', async () => {
    const base = await listen({ publicUrl: 'https://buzzr.example', interfaces });
    for (const host of ['localhost:5173', '192.168.1.20:5173', 'buzzr.example']) {
      expect(await getWithHost(base, '/api/config', host)).toEqual({
        joinOrigin: 'https://buzzr.example',
      });
    }
  });

  it('returns the LAN address with no port when the Host is loopback', async () => {
    const base = await listen({ interfaces });
    for (const host of ['localhost:5173', 'localhost', '127.0.0.1:3000', '[::1]:5173']) {
      expect(await getWithHost(base, '/api/config', host)).toEqual({
        joinOrigin: 'http://192.168.1.20',
      });
    }
  });

  it('returns null for a non-loopback Host, which phones can already reach', async () => {
    const base = await listen({ interfaces });
    for (const host of ['192.168.1.20:5173', 'buzzr.example', 'localhost.evil.example']) {
      expect(await getWithHost(base, '/api/config', host)).toEqual({ joinOrigin: null });
    }
  });

  it('returns null on loopback when the machine has no LAN address', async () => {
    const base = await listen({ interfaces: () => ({ lo: [iface('127.0.0.1', true)] }) });
    expect(await getWithHost(base, '/api/config', 'localhost:5173')).toEqual({
      joinOrigin: null,
    });
  });
});

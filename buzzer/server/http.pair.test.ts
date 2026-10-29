import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PAIR_INVALID_PIN_ERROR,
  PAIR_RATE_LIMIT,
  PAIR_RATE_LIMITED_ERROR,
  PAIRING_PIN_MAX_MISSES,
  PAIRING_PIN_TTL_MS,
} from '../shared/constants.js';
import type { HttpErrorBody, PairingResponse, PairResponse } from '../shared/types.js';
import { generateHostToken, hashHostToken, verifyHostToken } from './hostToken.js';
import { createApp, type AppOptions } from './http.js';
import { PairingStore, randomPin } from './pairing.js';
import { InMemoryRoomStore } from './roomStore.js';
import { makeRoom, T0 } from './test/rooms.js';

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

const TOKEN = generateHostToken();

/** Room ABCD holding `TOKEN`, a clock the test moves, and PINs drawn from `pins` in order. */
async function listen(pins: string[] = ['123456', '654321', '111111'], options: AppOptions = {}) {
  let now = T0;
  const rooms = new InMemoryRoomStore();
  rooms.set(makeRoom({ hostTokenHash: hashHostToken(TOKEN) }));
  const pairings = new PairingStore(() => pins.shift() ?? '000000');
  server = createApp({ rooms, pairings, clock: () => now, ...options }).listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    rooms,
    pairings,
    advance: (ms: number) => (now += ms),
  };
}

function createPin(
  base: string,
  { auth = `Bearer ${TOKEN}`, code = 'ABCD' }: { auth?: string | null; code?: string } = {},
): Promise<Response> {
  return fetch(`${base}/api/rooms/${code}/pairing`, {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
  });
}

function pair(
  base: string,
  body: unknown,
  { code = 'ABCD', headers = {} }: { code?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  return fetch(`${base}/api/rooms/${code}/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as HttpErrorBody).error;
}

describe('POST /api/rooms/:code/pairing', () => {
  it('returns 201 with a 6-digit PIN for the host', async () => {
    const { base, pairings } = await listen();
    const res = await createPin(base);
    expect(res.status).toBe(201);
    expect((await res.json()) as PairingResponse).toEqual({ pin: '123456' });
    expect(pairings.size).toBe(1);
  });

  it('refuses a missing or wrong token with 401 and makes no PIN', async () => {
    const { base, pairings } = await listen();
    for (const auth of [null, `Bearer ${generateHostToken()}`, 'Basic abc']) {
      const res = await createPin(base, { auth });
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
    }
    expect(pairings.size).toBe(0);
  });

  it('answers 404 for a room that does not exist', async () => {
    const { base } = await listen();
    expect((await createPin(base, { code: 'WXYZ' })).status).toBe(404);
    expect((await createPin(base, { code: 'nope!' })).status).toBe(404);
  });
});

describe('POST /api/rooms/:code/pair', () => {
  it('returns {hostToken} for the right PIN, and that token is the room’s', async () => {
    const { base, rooms } = await listen();
    await createPin(base);
    const res = await pair(base, { pin: '123456' });
    expect(res.status).toBe(200);
    const { hostToken } = (await res.json()) as PairResponse;
    expect(hostToken).toBe(TOKEN);
    expect(verifyHostToken(hostToken, rooms.get('ABCD')!.hostTokenHash)).toBe(true);
  });

  it('accepts a lower-case room code', async () => {
    const { base } = await listen();
    await createPin(base);
    expect((await pair(base, { pin: '123456' }, { code: 'abcd' })).status).toBe(200);
  });

  it('refuses a wrong PIN with 401', async () => {
    const { base } = await listen();
    await createPin(base);
    const res = await pair(base, { pin: '123457' });
    expect(res.status).toBe(401);
    expect(await errorOf(res)).toBe(PAIR_INVALID_PIN_ERROR);
  });

  it('refuses with 401 when no PIN was made, or the room does not exist', async () => {
    const { base } = await listen();
    expect((await pair(base, { pin: '123456' })).status).toBe(401);
    expect((await pair(base, { pin: '123456' }, { code: 'WXYZ' })).status).toBe(401);
  });

  it('refuses a body that is not a 6-digit PIN with 400', async () => {
    const { base } = await listen();
    await createPin(base);
    for (const body of [{ pin: '12345' }, { pin: '1234567' }, { pin: 'abcdef' }, {}, 'nope']) {
      expect((await pair(base, body)).status).toBe(400);
    }
  });

  it('refuses an oversized body with 413 and its own message', async () => {
    const { base } = await listen();
    const res = await pair(base, { pin: '123456', pad: 'x'.repeat(2000) });
    expect(res.status).toBe(413);
    expect(await errorOf(res)).toBe('Send only the 6-digit PIN.');
  });

  it('works once: the same PIN is refused after it pairs', async () => {
    const { base, pairings } = await listen();
    await createPin(base);
    expect((await pair(base, { pin: '123456' })).status).toBe(200);
    expect(pairings.size).toBe(0);
    expect((await pair(base, { pin: '123456' })).status).toBe(401);
  });

  it('still pairs just before 60 s', async () => {
    const { base, advance } = await listen();
    await createPin(base);
    advance(PAIRING_PIN_TTL_MS - 1);
    expect((await pair(base, { pin: '123456' })).status).toBe(200);
  });

  it('refuses the PIN at 60 s', async () => {
    const { base, advance, pairings } = await listen();
    await createPin(base);
    advance(PAIRING_PIN_TTL_MS);
    expect((await pair(base, { pin: '123456' })).status).toBe(401);
    expect(pairings.size).toBe(0);
  });

  it('a new PIN replaces the room’s previous one', async () => {
    const { base } = await listen();
    await createPin(base);
    await createPin(base);
    expect((await pair(base, { pin: '123456' })).status).toBe(401);
    expect((await pair(base, { pin: '654321' })).status).toBe(200);
  });

  it(`revokes the PIN after ${PAIRING_PIN_MAX_MISSES} wrong ones`, async () => {
    // Trust proxy, so each guess comes from its own address and only the misses count.
    const { base, advance, pairings } = await listen(undefined, { trustProxy: true });
    await createPin(base);
    for (let i = 0; i < PAIRING_PIN_MAX_MISSES - 1; i++) {
      await pair(base, { pin: '000000' }, { headers: { 'x-forwarded-for': `10.0.0.${i}` } });
    }
    expect(pairings.size).toBe(1);
    await pair(base, { pin: '000000' }, { headers: { 'x-forwarded-for': '10.0.1.1' } });
    expect(pairings.size).toBe(0);
    // Past the room's rate window, the right PIN is still refused: it is gone.
    advance(PAIR_RATE_LIMIT.windowMs);
    expect((await pair(base, { pin: '123456' })).status).toBe(401);
  });

  it(`limits one IP to ${PAIR_RATE_LIMIT.max} tries a minute, across rooms`, async () => {
    const { base, rooms, advance } = await listen();
    rooms.set(makeRoom({ code: 'WXYZ', hostTokenHash: hashHostToken(TOKEN) }));
    for (let i = 0; i < PAIR_RATE_LIMIT.max; i++) {
      await pair(base, { pin: '000000' }, { code: i % 2 ? 'ABCD' : 'WXYZ' });
    }
    await createPin(base, { code: 'WXYZ' });
    const refused = await pair(base, { pin: '123456' }, { code: 'WXYZ' });
    expect(refused.status).toBe(429);
    expect(await errorOf(refused)).toBe(PAIR_RATE_LIMITED_ERROR);
    advance(PAIR_RATE_LIMIT.windowMs);
    // The window has passed, but so has the PIN's minute: a fresh one pairs.
    await createPin(base, { code: 'WXYZ' });
    expect((await pair(base, { pin: '654321' }, { code: 'WXYZ' })).status).toBe(200);
  });

  it(`limits one room to ${PAIR_RATE_LIMIT.max} tries a minute, across IPs`, async () => {
    const { base } = await listen(undefined, { trustProxy: true });
    const from = (i: number) => ({ headers: { 'x-forwarded-for': `10.0.0.${i}` } });
    for (let i = 0; i < PAIR_RATE_LIMIT.max; i++) await pair(base, 'bad body', from(i));
    await createPin(base);
    expect((await pair(base, { pin: '123456' }, from(99))).status).toBe(429);
    // Another room is not affected.
    expect((await pair(base, { pin: '123456' }, { code: 'WXYZ', ...from(98) })).status).toBe(401);
  });

  it('an IP over its limit does not use up the room’s tries', async () => {
    const { base } = await listen(undefined, { trustProxy: true });
    const blocked = { headers: { 'x-forwarded-for': '10.0.0.1' } };
    for (let i = 0; i < PAIR_RATE_LIMIT.max; i++)
      await pair(base, { pin: '000000' }, { code: 'WXYZ', ...blocked });
    for (let i = 0; i < 10; i++)
      expect((await pair(base, { pin: '000000' }, blocked)).status).toBe(429);
    await createPin(base);
    expect(
      (await pair(base, { pin: '123456' }, { headers: { 'x-forwarded-for': '10.0.0.2' } })).status,
    ).toBe(200);
  });
});

describe('PairingStore', () => {
  it('frees an unused PIN, and the token with it, after 60 s with no further requests', () => {
    vi.useFakeTimers();
    try {
      const pairings = new PairingStore(() => '123456');
      pairings.create('ABCD', TOKEN, T0);
      vi.advanceTimersByTime(PAIRING_PIN_TTL_MS - 1);
      expect(pairings.size).toBe(1);
      vi.advanceTimersByTime(1);
      expect(pairings.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("an old PIN's timer does not drop the PIN that replaced it", () => {
    vi.useFakeTimers();
    try {
      const pairings = new PairingStore(() => '123456');
      pairings.create('ABCD', TOKEN, T0);
      vi.advanceTimersByTime(30_000);
      pairings.create('ABCD', TOKEN, T0 + 30_000);
      vi.advanceTimersByTime(30_000);
      expect(pairings.redeem('ABCD', '123456', T0 + 60_000)).toEqual({
        ok: true,
        hostToken: TOKEN,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('randomPin', () => {
  it('is always 6 digits, leading zeros kept', () => {
    for (let i = 0; i < 200; i++) expect(randomPin()).toMatch(/^\d{6}$/);
  });
});

import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { DevWordResponse, Room, Turn } from '../shared/types.js';
import { createApp } from './http.js';
import { createRoom } from './room.js';
import { InMemoryRoomStore } from './roomStore.js';
import { EN_PACK, TEST_PACKS } from './test/packs.js';

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

async function setup(dev: boolean | undefined, room?: Room): Promise<string> {
  const rooms = new InMemoryRoomStore();
  if (room) rooms.set(room);
  server = createApp({ packs: TEST_PACKS, rooms, ...(dev === undefined ? {} : { dev }) }).listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function drawing(word: Turn['word']): Room {
  const room = createRoom({ code: 'KPRW', hostTokenHash: 'h', now: 0, seed: 1, packs: TEST_PACKS });
  const turn: Turn = {
    id: 3,
    cycle: 1,
    drawerPid: 'p1',
    choices: [EN_PACK.words[0]!, EN_PACK.words[1]!, EN_PACK.words[2]!],
    dealtAt: 0,
    word,
    clockStart: word ? 0 : null,
    endsAt: word ? 60_000 : null,
    hintIndexes: [],
    correct: [],
    feed: [],
    closeGuesses: [],
    closeCount: {},
    lastGuessAt: {},
    guessCount: {},
    drawerPoints: 0,
    endReason: null,
  };
  return { ...room, phase: word ? 'DRAWING' : 'CHOOSING', turn };
}

const getWord = (base: string, code: string) => fetch(`${base}/api/dev/rooms/${code}/word`);

describe('GET /api/dev/rooms/:code/word', () => {
  it('does not exist unless the app is built with dev on (production, and the default)', async () => {
    for (const dev of [false, undefined]) {
      const base = await setup(dev, drawing(EN_PACK.words[8]!));
      const res = await getWord(base, 'KPRW');
      expect(res.status).toBe(404);
      expect(JSON.stringify(await res.json())).not.toContain(EN_PACK.words[8]!.word);
      await new Promise((resolve) => server!.close(resolve));
      server = undefined;
    }
  });

  it("answers the current turn's word in dev", async () => {
    const base = await setup(true, drawing(EN_PACK.words[8]!));
    const res = await getWord(base, 'kprw');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ turnId: 3, word: 'umbrella' } satisfies DevWordResponse);
  });

  it('answers null before a word is chosen and outside a turn', async () => {
    const base = await setup(true, drawing(null));
    expect(await (await getWord(base, 'KPRW')).json()).toEqual({ turnId: 3, word: null });
    await new Promise((resolve) => server!.close(resolve));
    const lobby = createRoom({
      code: 'KPRW',
      hostTokenHash: 'h',
      now: 0,
      seed: 1,
      packs: TEST_PACKS,
    });
    const base2 = await setup(true, lobby);
    expect(await (await getWord(base2, 'KPRW')).json()).toEqual({ turnId: null, word: null });
  });

  it('404s for an unknown or malformed code', async () => {
    const base = await setup(true);
    expect((await getWord(base, 'ZZZZ')).status).toBe(404);
    expect((await getWord(base, 'not-a-code')).status).toBe(404);
  });
});

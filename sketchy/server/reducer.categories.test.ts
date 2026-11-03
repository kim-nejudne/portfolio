// Categories at game start (F78): `host:start` and a rematch take the gateway's snapshot of the
// chosen categories (Room state; Words, Word selection). The reducer never reads the store.
import { describe, expect, it } from 'vitest';
import { REMATCH_COUNTDOWN_MS } from '../shared/constants.js';
import type { Effect, GameSnapshot, Room } from '../shared/types.js';
import type { Category } from './categoryStore.js';
import { reduce } from './reducer.js';
import { buildSnapshot } from './snapshot.js';
import { EN_PACK, SPICY_PACK, TEST_CATEGORIES, TEST_SNAPSHOT, testCategory } from './test/packs.js';
import { SCREEN_HOST, makeRoom, step, T0, withPlayers } from './test/rooms.js';

const start = (snapshot: GameSnapshot) => ({
  type: 'host:start' as const,
  by: SCREEN_HOST,
  snapshot,
});

function lobby(categories: string[], customWords: string[] = []): Room {
  let { room } = withPlayers(
    ['Ana', 'Ben'],
    makeRoom({ settings: { ...makeRoom().settings, categories } }),
  );
  if (customWords.length > 0)
    room = step(room, { type: 'host:customWords', by: SCREEN_HOST, words: customWords }, T0).room;
  return room;
}

describe('host:start with a snapshot', () => {
  it('refuses a start with no category left and no custom words: "Pick at least one category"', () => {
    const room = lobby(['gone']);
    const none = buildSnapshot(TEST_CATEGORIES, ['gone']);
    expect(reduce(room, start(none), T0 + 10)).toEqual({ ok: false, error: 'noCategories' });
  });

  it('still refuses fewer than 3 words in all', () => {
    const room = lobby([], ['grandma', 'grandpa']);
    const none = buildSnapshot(TEST_CATEGORIES, []);
    expect(reduce(room, start(none), T0 + 10)).toEqual({ ok: false, error: 'notEnoughWords' });
  });

  it('deals only the snapshot’s words, and keeps the snapshot it was given', () => {
    const room = lobby([SPICY_PACK.id, EN_PACK.id]);
    const both = buildSnapshot(TEST_CATEGORIES, [SPICY_PACK.id, EN_PACK.id]);
    const r = step(room, start(both), T0 + 10).room;
    expect(r.phase).toBe('CHOOSING');
    expect(r.snapshot).toBe(both);
    const dealt = [...r.deck.remaining, ...r.turn!.choices.map((c) => c.id)].sort();
    expect(dealt).toEqual(both.words.map((w) => w.id).sort());
  });

  it('drops the ids of deleted or hidden categories from the settings', () => {
    const room = lobby(['gone', EN_PACK.id, SPICY_PACK.id]);
    const store: Category[] = [
      testCategory(EN_PACK, true),
      testCategory(SPICY_PACK, false, { hidden: true }),
    ];
    const snap = buildSnapshot(store, room.settings.categories);
    const r = step(room, start(snap), T0 + 10).room;
    expect(r.settings.categories).toEqual([EN_PACK.id]);
    expect(r.snapshot!.categories.map((c) => c.id)).toEqual([EN_PACK.id]);
  });

  it('stays pure: the room it was given is unchanged, and so is the snapshot', () => {
    const room = lobby([EN_PACK.id]);
    const before = structuredClone(room);
    const snapBefore = JSON.stringify(TEST_SNAPSHOT);
    const a = reduce(room, start(TEST_SNAPSHOT), T0 + 10);
    const b = reduce(room, start(TEST_SNAPSHOT), T0 + 10);
    expect(room).toEqual(before);
    expect(JSON.stringify(TEST_SNAPSHOT)).toBe(snapBefore);
    // Same input, same output: the deal comes from the seeded RNG, never the store.
    expect(a).toEqual(b);
  });

  it('refuses an empty pick in the lobby only at Start, not as a setting', () => {
    const room = lobby([EN_PACK.id]);
    const r = step(room, { type: 'host:settings', by: SCREEN_HOST, categories: [] }, T0 + 10).room;
    expect(r.settings.categories).toEqual([]);
  });
});

type Schedule = Extract<Effect, { type: 'schedule' }>;

/** A game started on `snapshot`, ended at once (FINAL), and a rematch countdown run out with `fresh`. */
function rematchWith(snapshot: GameSnapshot, fresh: GameSnapshot | undefined) {
  let room = step(lobby([EN_PACK.id, SPICY_PACK.id]), start(snapshot), T0 + 10).room;
  room = step(room, { type: 'host:end', by: SCREEN_HOST }, T0 + 20).room;
  expect(room.phase).toBe('FINAL');
  const counting = step(room, { type: 'host:rematch', by: SCREEN_HOST }, T0 + 30);
  const go = counting.effects.find(
    (e): e is Schedule => e.type === 'schedule' && e.timer === 'rematchGo',
  )!;
  return step(
    counting.room,
    {
      type: 'timer',
      timer: 'rematchGo',
      turnId: go.turnId,
      epoch: go.epoch,
      ...(fresh && { snapshot: fresh }),
    },
    T0 + 30 + REMATCH_COUNTDOWN_MS,
  ).room;
}

describe('a rematch takes a fresh snapshot', () => {
  it('deals from the store as it is now, so admin edits apply from the next game', () => {
    const both = buildSnapshot(TEST_CATEGORIES, [EN_PACK.id, SPICY_PACK.id]);
    const r = rematchWith(TEST_SNAPSHOT, both);
    expect(r.phase).toBe('CHOOSING');
    expect(r.snapshot).toBe(both);
  });

  it('drops categories deleted since from the settings', () => {
    const enOnly = buildSnapshot([testCategory(EN_PACK, true)], [EN_PACK.id, SPICY_PACK.id]);
    const both = buildSnapshot(TEST_CATEGORIES, [EN_PACK.id, SPICY_PACK.id]);
    const r = rematchWith(both, enOnly);
    expect(r.settings.categories).toEqual([EN_PACK.id]);
    expect(r.snapshot).toBe(enOnly);
  });

  it('carries on with the last game’s words when the fresh one can’t deal', () => {
    const none = buildSnapshot([], [EN_PACK.id]);
    const r = rematchWith(TEST_SNAPSHOT, none);
    expect(r.phase).toBe('CHOOSING');
    expect(r.snapshot).toBe(TEST_SNAPSHOT);
    expect(r.settings.categories).toEqual([EN_PACK.id]);
  });
});

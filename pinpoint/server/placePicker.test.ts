import { describe, expect, it } from 'vitest';
import type { Category, Difficulty, Place, PlaceKind } from '#shared/types.js';
import { mulberry32, pickPlace, poolShortfall, snapshotPool } from './placePicker.js';

function place(id: string, kind: PlaceKind = 'city'): Place {
  return {
    id,
    kind,
    name: id,
    displayName: id,
    autoDisplayName: true,
    fact: 'A fact.',
    lat: 0,
    lng: 0,
    coordsSource: 'wikidata',
    wikidataId: 'Q1',
    countryId: 'Q2',
    countryName: 'Testland',
  };
}

const ids = (n: number, prefix = 'p') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const places = (n: number, kind: PlaceKind = 'city', prefix = 'p') =>
  ids(n, prefix).map((id) => place(id, kind));

function category(levels: Partial<Record<Difficulty, Place[]>>): Category {
  const live: Category['live'] = {};
  for (const [level, ps] of Object.entries(levels) as [Difficulty, Place[]][]) {
    live[level] = { places: ps, reviewed: true, updatedAt: 0 };
  }
  const box = { south: 0, west: 0, north: 1, east: 1 };
  return {
    id: 'japan',
    name: 'Japan',
    emoji: null,
    box,
    labelStyle: 'city',
    draftMeta: null,
    hidden: false,
    live,
    draft: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

/** Draws `n` places in a row, feeding each pick back as used, like a game's rounds and skips. */
function drawAll(pool: Place[], usage: Record<string, number>, seed: number, n: number) {
  const used: string[] = [];
  let rngState = seed;
  for (let i = 0; i < n; i++) {
    const pick = pickPlace(pool, used, usage, rngState);
    if (!pick) break;
    used.push(pick.place.id);
    rngState = pick.rngState;
  }
  return { used, rngState };
}

describe('mulberry32', () => {
  it('is a pure step: the same state gives the same value and next state', () => {
    expect(mulberry32(42)).toEqual(mulberry32(42));
    const { value, state } = mulberry32(42);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
    expect(mulberry32(state).value).not.toBe(value);
  });
});

describe('snapshotPool', () => {
  it('copies only the mode’s kind for each level the game needs', () => {
    const c = category({
      easy: [...places(3, 'city', 'ec'), ...places(2, 'landmark', 'el')],
      hard: places(4, 'city', 'hc'),
    });
    const pool = snapshotPool(c, 'picture', ['easy', 'easy']);
    expect(Object.keys(pool)).toEqual(['easy']);
    expect(pool.easy?.map((p) => p.id)).toEqual(['el0', 'el1']);
    expect(snapshotPool(c, 'name', ['easy', 'medium', 'hard'])).toEqual({
      easy: c.live.easy?.places.slice(0, 3),
      medium: [],
      hard: c.live.hard?.places,
    });
  });

  it('is a snapshot: later edits to the category never change it', () => {
    const c = category({ easy: places(5) });
    const pool = snapshotPool(c, 'name', ['easy']);
    c.live.easy?.places.push(place('late'));
    c.live.easy!.places[0]!.name = 'Renamed';
    expect(pool.easy).toHaveLength(5);
    expect(pool.easy?.[0]?.name).toBe('p0');
  });
});

describe('pickPlace', () => {
  it('never repeats a place within a game, including after skips, and ends when the pool does', () => {
    const pool = places(6);
    const { used } = drawAll(pool, {}, 7, 10);
    expect(used).toHaveLength(6);
    expect(new Set(used).size).toBe(6);
    expect(pickPlace(pool, used, {}, 7)).toBeNull();
  });

  it('prefers places with no placeUsage entry', () => {
    const pool = places(6);
    const usage = { p0: 1, p2: 1, p4: 2 };
    for (const seed of [1, 2, 3, 99, 12345]) {
      const { used } = drawAll(pool, usage, seed, 3);
      expect(new Set(used)).toEqual(new Set(['p1', 'p3', 'p5']));
    }
  });

  it('then takes the least recently used (lowest game number)', () => {
    const pool = places(4);
    const usage = { p0: 3, p1: 1, p2: 2, p3: 1 };
    for (const seed of [1, 2, 3, 99, 12345]) {
      const { used } = drawAll(pool, usage, seed, 4);
      expect(new Set(used.slice(0, 2))).toEqual(new Set(['p1', 'p3']));
      expect(used.slice(2)).toEqual(['p2', 'p0']);
    }
  });

  it('is deterministic for a seed and breaks ties by the PRNG', () => {
    const pool = places(10);
    expect(drawAll(pool, {}, 2024, 10)).toEqual(drawAll(pool, {}, 2024, 10));
    const orders = new Set([1, 2, 3, 4, 5].map((seed) => drawAll(pool, {}, seed, 10).used.join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('advances the PRNG state it returns', () => {
    const pick = pickPlace(places(3), [], {}, 5);
    expect(pick?.rngState).toBe(mulberry32(5).state);
  });
});

describe('poolShortfall', () => {
  it('names the short level in a single-level game', () => {
    const pool = snapshotPool(category({ hard: places(8, 'landmark') }), 'picture', ['hard']);
    expect(poolShortfall('Japan', pool, 'picture', 'hard', 10)).toBe(
      'Japan · Hard has 8 landmarks; this game needs 10.',
    );
    expect(poolShortfall('Japan', pool, 'picture', 'hard', 5)).toBeNull();
  });

  it('checks each level’s share of a Mixed plan (10 rounds: 3 · 4 · 3)', () => {
    const c = category({
      easy: places(3, 'city', 'e'),
      medium: places(3, 'city', 'm'),
      hard: places(9, 'city', 'h'),
    });
    const plan = ['easy', 'medium', 'hard'] as Difficulty[];
    expect(poolShortfall('Japan', snapshotPool(c, 'name', plan), 'name', 'mixed', 10)).toBe(
      'Japan · Medium has 3 cities; this game needs 4.',
    );
    expect(poolShortfall('Japan', snapshotPool(c, 'name', plan), 'name', 'mixed', 5)).toBeNull();
  });

  it('counts places used in earlier games as available', () => {
    const pool = snapshotPool(category({ easy: places(5) }), 'name', ['easy']);
    const usage = Object.fromEntries(ids(5).map((id) => [id, 1]));
    expect(poolShortfall('Japan', pool, 'name', 'easy', 5)).toBeNull();
    // A game after one that used every place still draws all five.
    expect(new Set(drawAll(pool.easy!, usage, 3, 5).used).size).toBe(5);
  });

  it('uses the singular for one place', () => {
    const pool = snapshotPool(category({ easy: places(1) }), 'name', ['easy']);
    expect(poolShortfall('Japan', pool, 'name', 'easy', 5)).toBe(
      'Japan · Easy has 1 city; this game needs 5.',
    );
  });
});

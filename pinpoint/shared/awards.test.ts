import { describe, expect, it } from 'vitest';
import { passStats, travelAwards, type AwardRound } from '#shared/awards.js';
import type { RoundResult } from '#shared/types.js';

const PLACES = ['Lima', 'Osaka', 'Oslo', 'Cairo', 'Perth', 'Quito'];

/** A result row; `null` km is a missed round. */
function res(
  playerId: string,
  km: number | null,
  opts: { bullseye?: boolean; points?: number } = {},
): RoundResult {
  return {
    playerId,
    position: km === null ? null : { lat: 0, lng: 0 },
    lockedIn: km !== null,
    distanceKm: km,
    basePoints: opts.points ?? 0,
    bullseye: opts.bullseye ?? false,
    multiplier: 1,
    points: opts.points ?? 0,
  };
}

/**
 * Rounds from a table of km per player: `{a: [100, 200], b: [50, null]}`. `'B'` (any string, as
 * literal tables widen it) is a 1 km bullseye; `undefined` means not a participant that round.
 */
function game(
  table: Record<string, readonly (number | null | string | undefined)[]>,
): AwardRound[] {
  const n = Math.max(...Object.values(table).map((r) => r.length));
  return Array.from({ length: n }, (_, i) => ({
    number: i + 1,
    placeName: PLACES[i % PLACES.length]!,
    results: Object.entries(table).flatMap(([id, kms]) => {
      const km = kms[i];
      if (km === undefined) return []; // not a participant (joined later)
      return typeof km === 'string' ? [res(id, 1, { bullseye: true })] : [res(id, km)];
    }),
  }));
}

const ids = (table: Record<string, unknown>) => Object.keys(table);
const summary = (awards: ReturnType<typeof travelAwards>) =>
  awards.map((a) => [a.id, a.playerIds.join('+'), a.stat]);

describe('travelAwards', () => {
  it('gives the four awards in order, each to a new winner, at most 3', () => {
    const t = { a: ['B', 'B', 30], b: ['B', 4812, 20], c: [500, 600, 700], d: [10, 15, 12] };
    // Pilot: a (2 bullseyes). Lost Luggage: b (4,812 km at Osaka). Frequent Flyer: c (1,800 km).
    expect(summary(travelAwards(ids(t), game(t)))).toEqual([
      ['pinpointPilot', 'a', '2 bullseyes'],
      ['lostLuggage', 'b', '4,812 km from Osaka'],
      ['frequentFlyer', 'c', '1,800 km in total'],
    ]);
  });

  it('skips Pinpoint Pilot without a bullseye, so Smooth Landing makes the third', () => {
    const t = { a: [4812, 30], b: [900, 900], c: [3.25, 600], d: [40, 50] };
    expect(summary(travelAwards(ids(t), game(t)))).toEqual([
      ['lostLuggage', 'a', '4,812 km from Lima'],
      ['frequentFlyer', 'b', '1,800 km in total'],
      ['smoothLanding', 'c', '3.3 km from Lima'],
    ]);
  });

  it('words a single bullseye in the singular, and Smooth Landing counts bullseyes', () => {
    const t = { a: ['B', 9000], b: [8000, 8000], c: [20, 30], d: [700, 'B'] };
    // a and d share Pilot (1 each); a's 9,000 km would win Lost Luggage, but a already won.
    expect(summary(travelAwards(ids(t), game(t)))).toEqual([
      ['pinpointPilot', 'a+d', '1 bullseye'],
      ['lostLuggage', 'b', '8,000 km from Lima'],
      ['frequentFlyer', 'c', '50 km in total'],
    ]);
  });

  it('never repeats a winner: the next best non-winner takes the award', () => {
    // a is the biggest miss and the most km overall, but wins Lost Luggage only.
    const t = { a: [9000, 9000], b: [5000, 100], c: [3000, 3000], d: [1, 2] };
    expect(summary(travelAwards(ids(t), game(t)))).toEqual([
      ['lostLuggage', 'a', '9,000 km from Lima'],
      ['frequentFlyer', 'c', '6,000 km in total'],
      ['smoothLanding', 'd', '1.0 km from Lima'],
    ]);
  });

  it('shares an award between players tied on the stat, in standings order', () => {
    const t = { c: [7000, 10], a: [7000, 20], b: [100, 200], d: [50, 60] };
    const awards = travelAwards(['a', 'b', 'c', 'd'], game(t));
    expect(summary(awards)).toEqual([
      ['lostLuggage', 'a+c', '7,000 km from Lima'],
      ['frequentFlyer', 'b', '300 km in total'],
      ['smoothLanding', 'd', '50 km from Lima'],
    ]);
  });

  it('takes the stat place from the earliest round with that distance', () => {
    const t = { a: [100, 5000, 5000], b: [10, 10, 10], c: [20, 20, 20] };
    expect(travelAwards(ids(t), game(t))[0]!.stat).toBe('5,000 km from Osaka');
  });

  it('needs half the played rounds, rounded up; missed rounds do not count', () => {
    // 5 played rounds → 3 needed. e played 2 (joined late), f missed 3 of 5: neither eligible.
    const t = {
      a: [10, 20, 30, 40, 50],
      b: [100, 100, 100, 100, 100],
      c: [5, 5, 5, 5, 5],
      e: [undefined, undefined, undefined, 9999, 9999],
      f: [9999, null, null, null, 9999],
      g: [800, null, null, 800, 800],
    };
    const awards = travelAwards(ids(t), game(t));
    expect(awards.flatMap((a) => a.playerIds)).not.toContain('e');
    expect(awards.flatMap((a) => a.playerIds)).not.toContain('f');
    expect(summary(awards)).toEqual([
      ['lostLuggage', 'g', '800 km from Lima'],
      ['frequentFlyer', 'b', '500 km in total'],
      ['smoothLanding', 'c', '5.0 km from Lima'],
    ]);
  });

  it('gives none with fewer than 3 players in the final standings', () => {
    const t = { a: ['B', 100], b: [5000, 200] };
    expect(travelAwards(ids(t), game(t))).toEqual([]);
    // 3 players in the standings, but one of them never played: still awards for the other two.
    const u = { a: ['B', 100], b: [5000, 200], c: [null, null] };
    expect(summary(travelAwards(ids(u), game(u)))).toEqual([
      ['pinpointPilot', 'a', '1 bullseye'],
      ['lostLuggage', 'b', '5,000 km from Lima'],
    ]);
  });

  it('gives none when no round was played', () => {
    expect(travelAwards(['a', 'b', 'c'], [])).toEqual([]);
  });

  it('with 3 or more eligible players always yields 3 awards unless ties used up every player', () => {
    let seed = 27; // a seeded LCG keeps the 500 games deterministic
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    for (let g = 0; g < 500; g++) {
      const players = 3 + Math.floor(rand() * 6);
      const rounds = 5 + Math.floor(rand() * 11);
      const t: Record<string, (number | 'B')[]> = {};
      for (let p = 0; p < players; p++)
        t[`p${p}`] = Array.from({ length: rounds }, () =>
          rand() < 0.1 ? 'B' : Math.round(rand() * 20000),
        );
      const awards = travelAwards(ids(t), game(t));
      const winners = new Set(awards.flatMap((a) => a.playerIds));
      expect(winners.size).toBe(awards.reduce((n, a) => n + a.playerIds.length, 0)); // no repeats
      expect(winners.size).toBeGreaterThanOrEqual(3);
      expect(awards.length === 3 || winners.size === players).toBe(true);
      if (awards.every((a) => a.playerIds.length === 1)) expect(awards).toHaveLength(3);
    }
  });

  it('three players sharing every stat: one shared award, then nobody is left', () => {
    const t = { a: ['B', 100], b: ['B', 100], c: ['B', 100] };
    expect(summary(travelAwards(ids(t), game(t)))).toEqual([
      ['pinpointPilot', 'a+b+c', '1 bullseye'],
    ]);
  });
});

describe('passStats', () => {
  const rounds: AwardRound[] = [
    { number: 1, placeName: 'Lima', results: [res('a', 300, { points: 486 }), res('b', null)] },
    {
      number: 2,
      placeName: 'Osaka',
      results: [res('a', 12, { points: 960 }), res('b', 50, { points: 900 })],
    },
    {
      number: 3,
      placeName: 'Oslo',
      results: [res('a', 30, { points: 960 }), res('b', 1000, { points: 1499 })],
    },
  ];

  it('names the best round, earliest on a tie, and averages played rounds only', () => {
    expect(passStats('a', rounds)).toEqual({ bestRound: 'Round 2 · Osaka · 960', avgKm: 114 });
    expect(passStats('b', rounds)).toEqual({ bestRound: 'Round 3 · Oslo · 1,499', avgKm: 525 });
  });

  it('is empty for a player with no played round', () => {
    expect(passStats('z', rounds)).toEqual({ bestRound: null, avgKm: null });
    expect(passStats('a', [])).toEqual({ bestRound: null, avgKm: null });
  });
});

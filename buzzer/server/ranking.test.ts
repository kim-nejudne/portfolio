import { describe, expect, it } from 'vitest';
import { rankPlayers } from './ranking.js';
import { T0, makePlayer } from './test/rooms.js';

describe('rankPlayers', () => {
  it('sorts by score, highest first', () => {
    const ranked = rankPlayers([
      makePlayer('a', { score: 100 }),
      makePlayer('b', { score: 300 }),
      makePlayer('c', { score: -100 }),
    ]);
    expect(ranked.map((p) => [p.id, p.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 3],
    ]);
  });

  it('gives equal scores the same rank and skips the ranks they fill', () => {
    const ranked = rankPlayers([
      makePlayer('a', { score: 200 }),
      makePlayer('b', { score: 200 }),
      makePlayer('c', { score: 100 }),
    ]);
    expect(ranked.map((p) => p.rank)).toEqual([1, 1, 3]);
  });

  it('lists tied players in join order', () => {
    const ranked = rankPlayers([
      makePlayer('late', { score: 0, joinedAt: T0 + 2 }),
      makePlayer('early', { score: 0, joinedAt: T0 + 1 }),
    ]);
    expect(ranked.map((p) => p.id)).toEqual(['early', 'late']);
  });

  it('does not reorder the input array', () => {
    const players = [makePlayer('a', { score: 0 }), makePlayer('b', { score: 5 })];
    rankPlayers(players);
    expect(players.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

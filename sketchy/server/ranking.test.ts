import { describe, expect, it } from 'vitest';
import { rankPlayers } from './ranking.js';
import { T0 } from './test/rooms.js';

let joined = 0;
const player = (id: string, score: number, joinedAt = T0 + joined++) => ({ id, score, joinedAt });

describe('rankPlayers', () => {
  it('sorts by score, highest first', () => {
    const ranked = rankPlayers([player('a', 100), player('b', 300), player('c', 0)]);
    expect(ranked.map((p) => [p.id, p.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 3],
    ]);
  });

  it('gives equal scores the same rank and skips the ranks they fill', () => {
    const ranked = rankPlayers([player('a', 200), player('b', 200), player('c', 100)]);
    expect(ranked.map((p) => p.rank)).toEqual([1, 1, 3]);
  });

  it('handles several tie groups in one ranking', () => {
    const ranked = rankPlayers([
      player('a', 300),
      player('b', 100),
      player('c', 300),
      player('d', 0),
      player('e', 100),
    ]);
    expect(ranked.map((p) => [p.id, p.rank])).toEqual([
      ['a', 1],
      ['c', 1],
      ['b', 3],
      ['e', 3],
      ['d', 5],
    ]);
  });

  it('gives everyone rank 1 when all scores are equal', () => {
    const ranked = rankPlayers(['a', 'b', 'c'].map((id) => player(id, 50)));
    expect(ranked.map((p) => p.rank)).toEqual([1, 1, 1]);
  });

  it('returns an empty ranking for no players', () => {
    expect(rankPlayers([])).toEqual([]);
  });

  it('lists tied players in join order', () => {
    const ranked = rankPlayers([player('late', 0, T0 + 2), player('early', 0, T0 + 1)]);
    expect(ranked.map((p) => p.id)).toEqual(['early', 'late']);
  });

  it('keeps every other field and does not reorder the input', () => {
    const players = [player('a', 0), player('b', 5)];
    expect(rankPlayers(players)[0]).toMatchObject({ id: 'b', score: 5, rank: 1 });
    expect(players.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

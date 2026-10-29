import { describe, expect, it } from 'vitest';
import { rankPlayers, rankTeams } from './ranking.js';
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

  it('handles several tie groups in one ranking', () => {
    const ranked = rankPlayers([
      makePlayer('a', { score: 300 }),
      makePlayer('b', { score: 100 }),
      makePlayer('c', { score: 300 }),
      makePlayer('d', { score: 0 }),
      makePlayer('e', { score: 100 }),
    ]);
    expect(ranked.map((p) => [p.id, p.rank])).toEqual([
      ['a', 1],
      ['c', 1],
      ['b', 3],
      ['e', 3],
      ['d', 5],
    ]);
  });

  it('ranks tied negative scores below zero and together', () => {
    const ranked = rankPlayers([
      makePlayer('a', { score: -100 }),
      makePlayer('b', { score: 0 }),
      makePlayer('c', { score: -100 }),
    ]);
    expect(ranked.map((p) => [p.id, p.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
    ]);
  });

  it('gives everyone rank 1 when all scores are equal', () => {
    const ranked = rankPlayers(['a', 'b', 'c'].map((id) => makePlayer(id, { score: 50 })));
    expect(ranked.map((p) => p.rank)).toEqual([1, 1, 1]);
  });

  it('returns an empty ranking for no players', () => {
    expect(rankPlayers([])).toEqual([]);
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

describe('rankTeams', () => {
  const team = (index: number, score: number) => ({ index, score });

  it('sorts teams by score, highest first', () => {
    const ranked = rankTeams([team(0, 100), team(1, 300), team(2, -50)]);
    expect(ranked.map((t) => [t.index, t.rank])).toEqual([
      [1, 1],
      [0, 2],
      [2, 3],
    ]);
  });

  it('gives equal team scores the same rank and lists them by team index', () => {
    const ranked = rankTeams([team(2, 200), team(0, 100), team(1, 200), team(3, 0)]);
    expect(ranked.map((t) => [t.index, t.rank])).toEqual([
      [1, 1],
      [2, 1],
      [0, 3],
      [3, 4],
    ]);
  });

  it('keeps every other field and does not reorder the input', () => {
    const teams = [
      { ...team(0, 0), name: 'Red' },
      { ...team(1, 5), name: 'Blue' },
    ];
    expect(rankTeams(teams)[0]).toEqual({ index: 1, score: 5, name: 'Blue', rank: 1 });
    expect(teams.map((t) => t.index)).toEqual([0, 1]);
  });
});

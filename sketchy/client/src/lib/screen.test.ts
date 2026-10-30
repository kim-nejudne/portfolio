import { describe, expect, it } from 'vitest';
import type { PlayerChipView } from '../../../shared/types.js';
import { formatClock, hintLetters, rankPlayers, wordLengths } from './screen.js';

function chip(pid: string, score: number | null): PlayerChipView {
  return {
    pid,
    name: pid,
    color: '#fff',
    connected: true,
    crown: false,
    isDrawer: false,
    hasDoodle: false,
    guessed: false,
    turnPoints: 0,
    score,
  };
}

describe('Screen helpers', () => {
  it('counts the letters of each word in the blanks: (5, 4)', () => {
    expect(wordLengths([...'_____ ____'])).toEqual([5, 4]);
  });

  it('counts hyphenated and punctuated words by their letters only', () => {
    expect(wordLengths([...'___-___'])).toEqual([6]);
    expect(wordLengths([...'_ _'])).toEqual([1, 1]);
    expect(wordLengths([...'__a'])).toEqual([3]);
  });

  it('formats time left as m:ss, rounding up so 0:00 means time is up', () => {
    expect(formatClock(47_000)).toBe('0:47');
    expect(formatClock(46_001)).toBe('0:47');
    expect(formatClock(100_000)).toBe('1:40');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-5)).toBe('0:00');
  });

  it('ranks players by score with shared ranks for ties', () => {
    const ranked = rankPlayers([chip('a', 100), chip('b', 300), chip('c', 100), chip('d', 50)]);
    expect(ranked.map((r) => [r.player.pid, r.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });

  it('keeps join order among tied players', () => {
    const ranked = rankPlayers([chip('x', 0), chip('y', 0)]);
    expect(ranked.map((r) => r.player.pid)).toEqual(['x', 'y']);
  });
});

describe('hintLetters', () => {
  it('lists the revealed letters in word order, never blanks, spaces or marks', () => {
    expect(hintLetters([..."b_h__ _u-o'"])).toEqual(['b', 'h', 'u', 'o']);
    expect(hintLetters([...'____'])).toEqual([]);
  });
});

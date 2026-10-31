import { describe, expect, it } from 'vitest';
import type { Phase, PlayerChipView, TurnView } from '../../../shared/types.js';
import { translator } from './copy.js';
import {
  formatClock,
  hintLetters,
  hasCaptionRow,
  HOW_TO_PLAY,
  rankPlayers,
  screenLayout,
  turnCaption,
  wordLengths,
} from './screen.js';

function chip(pid: string, score: number | null, rank: number | null = null): PlayerChipView {
  return {
    pid,
    name: pid,
    color: '#fff',
    connected: true,
    crown: false,
    isDrawer: false,
    avatar: '🦊',
    guessed: false,
    turnPoints: 0,
    score,
    rank,
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

  it('orders players by the server’s shared ranks', () => {
    const ranked = rankPlayers([
      chip('a', 100, 2),
      chip('b', 300, 1),
      chip('c', 100, 2),
      chip('d', 50, 4),
    ]);
    expect(ranked.map((r) => [r.player.pid, r.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });

  it('keeps the view’s join order among tied players', () => {
    const ranked = rankPlayers([chip('x', 0, 1), chip('y', 0, 1)]);
    expect(ranked.map((r) => r.player.pid)).toEqual(['x', 'y']);
  });
});

describe('hintLetters', () => {
  it('lists the revealed letters in word order, never blanks, spaces or marks', () => {
    expect(hintLetters([..."b_h__ _u-o'"])).toEqual(['b', 'h', 'u', 'o']);
    expect(hintLetters([...'____'])).toEqual([]);
  });
});

describe('turnCaption (F26)', () => {
  const t = translator('en');
  const turn = (number: number): TurnView => ({
    id: number + 10,
    number,
    cycle: 1,
    drawerPid: 'mika',
    drawerName: 'Mika',
    timer: null,
    mask: [...'____'],
    word: null,
    correct: [],
    guessed: { guessed: 0, of: 2 },
    endReason: null,
    drawerReconnecting: false,
  });
  const caption = (phase: Phase, number: number | null) =>
    turnCaption({ phase, turn: number === null ? null : turn(number) }, t);

  it('teaches the rule with the drawer’s name on the game’s first turn', () => {
    expect(caption('DRAWING', 1)).toBe(
      'Mika is drawing. Everyone else: type your guess on your phone 🤫',
    );
  });

  it('reminds everyone not to shout on the second turn', () => {
    expect(caption('DRAWING', 2)).toBe('Type your guess. Don’t say it! 🤫');
  });

  it('is gone from the third turn on', () => {
    expect(caption('DRAWING', 3)).toBeNull();
    expect(caption('DRAWING', 12)).toBeNull();
  });

  it('shows only while drawing, not while choosing or at the reveal', () => {
    for (const phase of ['LOBBY', 'CHOOSING', 'REVEAL', 'SCOREBOARD', 'FINAL'] as const) {
      expect(caption(phase, 1)).toBeNull();
      expect(caption(phase, 2)).toBeNull();
    }
    expect(caption('DRAWING', null)).toBeNull();
  });

  it('keeps the caption’s row through the first two turns only, so the reveal doesn’t resize', () => {
    expect(hasCaptionRow({ number: 1 })).toBe(true);
    expect(hasCaptionRow({ number: 2 })).toBe(true);
    expect(hasCaptionRow({ number: 3 })).toBe(false);
  });
});

describe('How to play (F26)', () => {
  const t = translator('en');

  it('has three numbered steps of at most six words each', () => {
    const steps = HOW_TO_PLAY.map((s) => t(s.key));
    expect(steps).toEqual([
      '1 · One person draws on their phone',
      '2 · Everyone else types guesses 🤫',
      '3 · Faster = more points',
    ]);
    for (const step of steps) {
      // The number and the emoji aren't words.
      const words = step
        .replace(/^\d · /, '')
        .split(/\s+/)
        .filter((w) => /[\p{L}]/u.test(w));
      expect(words.length).toBeLessThanOrEqual(6);
    }
  });

  it('gives each step its own icon', () => {
    expect(new Set(HOW_TO_PLAY.map((s) => s.icon)).size).toBe(3);
  });
});

describe('screenLayout', () => {
  it.each([
    [1920, 1080],
    [1366, 768],
    [1180, 820],
    [844, 390],
    [1024, 768],
  ])('is landscape at %i×%i', (w, h) => {
    expect(screenLayout(w, h)).toBe('landscape');
  });

  it.each([
    [820, 1180],
    [390, 844],
    [768, 1024],
  ])('is portrait at %i×%i', (w, h) => {
    expect(screenLayout(w, h)).toBe('portrait');
  });

  it('keeps near-square Screens on the landscape layout', () => {
    expect(screenLayout(1000, 1000)).toBe('landscape');
    expect(screenLayout(1100, 1000)).toBe('landscape');
    expect(screenLayout(860, 1000)).toBe('landscape');
  });

  it('turns portrait at a width/height of 0.85', () => {
    expect(screenLayout(850, 1000)).toBe('portrait');
    expect(screenLayout(851, 1000)).toBe('landscape');
  });

  it('falls back to landscape before the window has a size', () => {
    expect(screenLayout(0, 0)).toBe('landscape');
    expect(screenLayout(800, 0)).toBe('landscape');
  });
});

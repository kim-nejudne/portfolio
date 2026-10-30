import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANNOUNCE_MS,
  BUBBLE_MS,
  BUBBLES_MAX,
  createScreenFx,
  FLOAT_MS,
  FLOATS_MAX,
} from './screenFx.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('screen fx: "Jun got it!"', () => {
  it('announces each correct guesser for 2 s, newest last', () => {
    const fx = createScreenFx();
    fx.push({ kind: 'correct', pid: 'jun', points: 270, order: 1 });
    vi.advanceTimersByTime(500);
    fx.push({ kind: 'correct', pid: 'ana', points: 250, order: 2 });
    expect(fx.getSnapshot().gotIt.map((g) => g.pid)).toEqual(['jun', 'ana']);
    expect(ANNOUNCE_MS).toBe(2000);
    vi.advanceTimersByTime(ANNOUNCE_MS - 500);
    expect(fx.getSnapshot().gotIt.map((g) => g.pid)).toEqual(['ana']);
    vi.advanceTimersByTime(500);
    expect(fx.getSnapshot().gotIt).toEqual([]);
  });
});

describe('screen fx: wrong-guess bubbles', () => {
  it('keeps at most three at once for 2 s each; extras are dropped (they are in the feed)', () => {
    const fx = createScreenFx();
    for (const pid of ['bea', 'cy', 'dan', 'eli'])
      fx.push({ kind: 'wrongGuess', pid, text: `${pid}-guess` });
    expect(BUBBLES_MAX).toBe(3);
    expect(fx.getSnapshot().bubbles.map((b) => b.pid)).toEqual(['bea', 'cy', 'dan']);
    expect(BUBBLE_MS).toBe(2000);
    vi.advanceTimersByTime(BUBBLE_MS);
    expect(fx.getSnapshot().bubbles).toEqual([]);
    fx.push({ kind: 'wrongGuess', pid: 'eli', text: 'payong' });
    expect(fx.getSnapshot().bubbles.map((b) => b.text)).toEqual(['payong']);
  });

  it('replaces a guesser’s own bubble with their newer guess, restarting its 2 s', () => {
    const fx = createScreenFx();
    fx.push({ kind: 'wrongGuess', pid: 'bea', text: 'payong' });
    fx.push({ kind: 'wrongGuess', pid: 'cy', text: null });
    vi.advanceTimersByTime(1500);
    fx.push({ kind: 'wrongGuess', pid: 'bea', text: 'sapatos' });
    expect(fx.getSnapshot().bubbles.map((b) => [b.pid, b.text])).toEqual([
      ['cy', null],
      ['bea', 'sapatos'],
    ]);
    vi.advanceTimersByTime(500);
    expect(fx.getSnapshot().bubbles.map((b) => b.text)).toEqual(['sapatos']);
    vi.advanceTimersByTime(1500);
    expect(fx.getSnapshot().bubbles).toEqual([]);
  });

  it('lets a guesser with a bubble replace it even when three are up', () => {
    const fx = createScreenFx();
    for (const pid of ['bea', 'cy', 'dan']) fx.push({ kind: 'wrongGuess', pid, text: 'x' });
    fx.push({ kind: 'wrongGuess', pid: 'bea', text: 'y' });
    expect(fx.getSnapshot().bubbles.map((b) => [b.pid, b.text])).toEqual([
      ['cy', 'x'],
      ['dan', 'x'],
      ['bea', 'y'],
    ]);
  });
});

describe('screen fx: reactions', () => {
  it('floats each reaction for its time, and caps how many are up', () => {
    const fx = createScreenFx();
    fx.push({ kind: 'reaction', pid: 'jun', emoji: '🔥' });
    fx.push({ kind: 'reaction', pid: 'jun', emoji: '😂' });
    expect(fx.getSnapshot().floats.map((f) => f.emoji)).toEqual(['🔥', '😂']);
    vi.advanceTimersByTime(FLOAT_MS);
    expect(fx.getSnapshot().floats).toEqual([]);
    for (let i = 0; i < FLOATS_MAX + 5; i++)
      fx.push({ kind: 'reaction', pid: `p${i}`, emoji: '👏' });
    const floats = fx.getSnapshot().floats;
    expect(floats).toHaveLength(FLOATS_MAX);
    expect(floats[0]!.pid).toBe('p5');
  });

  it('gives every item its own id, so a repeat restarts its animation', () => {
    const fx = createScreenFx();
    fx.push({ kind: 'reaction', pid: 'jun', emoji: '🔥' });
    fx.push({ kind: 'reaction', pid: 'jun', emoji: '🔥' });
    const [a, b] = fx.getSnapshot().floats;
    expect(a!.id).not.toBe(b!.id);
  });
});

describe('screen fx: store', () => {
  it('ignores other kinds, notifies on change, and clears everything with its timers', () => {
    const fx = createScreenFx();
    const seen = vi.fn();
    const stop = fx.subscribe(seen);
    const before = fx.getSnapshot();
    fx.push({ kind: 'hint' });
    expect(fx.getSnapshot()).toBe(before);
    expect(seen).not.toHaveBeenCalled();
    fx.push({ kind: 'correct', pid: 'jun', points: 270, order: 1 });
    expect(seen).toHaveBeenCalledTimes(1);
    fx.clear();
    expect(fx.getSnapshot()).toEqual({ gotIt: [], bubbles: [], floats: [] });
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });
});

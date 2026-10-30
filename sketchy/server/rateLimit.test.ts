// Ported from Buzzr (buzzer/server/rateLimit.test.ts).
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit.js';

function setup(max = 3, windowMs = 1000) {
  let now = 0;
  const limiter = createRateLimiter({ max, windowMs }, () => now);
  return {
    limiter,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('createRateLimiter', () => {
  it('allows max hits per key, then refuses', () => {
    const { limiter } = setup(3);
    expect([1, 2, 3, 4].map(() => limiter.hit('a'))).toEqual([true, true, true, false]);
  });

  it('counts keys separately', () => {
    const { limiter } = setup(1);
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.hit('b')).toBe(true);
    expect(limiter.hit('a')).toBe(false);
  });

  it('frees a slot exactly one window after the oldest hit', () => {
    const { limiter, advance } = setup(2, 1000);
    limiter.hit('a');
    advance(400);
    limiter.hit('a');
    advance(599);
    expect(limiter.hit('a')).toBe(false);
    advance(1);
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.hit('a')).toBe(false);
  });

  it('does not count refused hits against the key', () => {
    const { limiter, advance } = setup(1, 1000);
    limiter.hit('a');
    advance(500);
    expect(limiter.hit('a')).toBe(false);
    advance(500);
    expect(limiter.hit('a')).toBe(true);
  });

  it('starts a key fresh after its hits expire and idle keys are cleaned up', () => {
    const { limiter, advance } = setup(1, 1000);
    limiter.hit('a');
    limiter.hit('b');
    advance(5000);
    expect(limiter.hit('c')).toBe(true);
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.hit('a')).toBe(false);
  });
});

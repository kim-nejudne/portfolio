/** At most `max` hits per key within any `windowMs` span. */
export interface RateLimit {
  readonly max: number;
  readonly windowMs: number;
}

export interface RateLimiter {
  /** Records a hit for `key` and returns true, or returns false (recording nothing) if the key is over its limit. */
  hit(key: string): boolean;
}

/**
 * A sliding-window limiter. Each key keeps the times of its hits inside the window. Keys whose
 * hits have all expired are dropped at most once per window, so idle keys do not pile up.
 */
export function createRateLimiter({ max, windowMs }: RateLimit, clock: () => number): RateLimiter {
  const hits = new Map<string, number[]>();
  let lastCleanup = clock();

  return {
    hit(key) {
      const now = clock();
      const since = now - windowMs;

      if (now - lastCleanup >= windowMs) {
        for (const [k, times] of hits) {
          if (times[times.length - 1]! <= since) hits.delete(k);
        }
        lastCleanup = now;
      }

      const recent = (hits.get(key) ?? []).filter((t) => t > since);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

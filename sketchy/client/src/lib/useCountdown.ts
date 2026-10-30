import { useEffect, useState } from 'react';
import type { TimerView } from '../../../shared/types.js';

/**
 * Time left on a phase timer, counted down locally from the `state` it came in (`receivedAt`,
 * `performance.now()` when that state arrived). Every new `state` resyncs it.
 */
export function useCountdown(timer: TimerView | null, receivedAt: number): number {
  const [now, setNow] = useState(() => performance.now());
  const running = timer?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [running]);
  if (!timer) return 0;
  if (!timer.running) return timer.remainingMs;
  return Math.max(0, timer.remainingMs - Math.max(0, now - receivedAt));
}

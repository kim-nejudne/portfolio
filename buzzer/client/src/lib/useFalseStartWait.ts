import { useEffect, useState } from 'react';
import type { Phase } from '../../../shared/types.js';

/** The parts of any role's view the false start wait needs. */
interface WaitSource {
  phase: Phase;
  questionIndex: number;
  openingCounter: number;
}

/**
 * True while this opening's false starters are still held (UI spec, Player view: "Too early!").
 * Views carry no time (DECISIONS, F71), so the device counts `falseStartMs` from when it first sees
 * the buzzers open for this question and opening. That is after the server's own start, so the
 * device never frees a press the server would still ignore. `anyone` is false when nobody this
 * device shows pressed early; then there is nothing to wait for. A `waitMs` of 0 is off.
 */
export function useFalseStartWait(view: WaitSource, waitMs: number, anyone: boolean): boolean {
  const open = view.phase === 'OPEN' || view.phase === 'COLLECTING';
  const key = anyone && open && waitMs > 0 ? `${view.questionIndex}:${view.openingCounter}` : null;
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (key === null) return;
    const timer = setTimeout(() => setDone(key), waitMs);
    return () => clearTimeout(timer);
  }, [key, waitMs]);

  return key !== null && done !== key;
}

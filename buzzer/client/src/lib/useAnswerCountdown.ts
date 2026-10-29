import { useEffect, useRef, useState } from 'react';
import type { AnswerTimerView, BuzzTimerView, ChoiceView } from '../../../shared/types.js';

/** What every device shows once the server marks the answer time up. */
export const TIME_UP_LABEL = 'Time’s up!';

/** How often the countdown reads the clock. Shorter than a second, so each change shows on time. */
const TICK_MS = 250;

export interface AnswerCountdown {
  /** Whole seconds left on this device's count, down to 0. */
  secondsLeft: number;
  /** The server has marked the time up (the view's `answerTimer.up`). */
  up: boolean;
}

/** The parts of any role's view the answer countdown needs. */
interface CountdownSource {
  answerTimer: AnswerTimerView | null;
  questionIndex: number;
  openingCounter: number;
}

/** The parts of any role's view the buzz countdown needs. */
interface BuzzCountdownSource {
  buzzTimer: BuzzTimerView | null;
  questionIndex: number;
  openingCounter: number;
}

/**
 * The winner's answer countdown (UI spec, Player, Screen and Host views), or null with no timer
 * running. Views carry no end time (DECISIONS, F35), so each device counts `seconds` down from
 * when the timer first appears for this question and opening, and restarts on a new one. It reads
 * the clock on every tick, so a throttled tab catches up instead of falling behind. It stops at 0;
 * only the server's `up` turns it into "Time's up!".
 */
export function useAnswerCountdown({
  answerTimer,
  questionIndex,
  openingCounter,
}: CountdownSource): AnswerCountdown | null {
  return useCountdown(answerTimer, questionIndex, openingCounter);
}

/**
 * The buzz time left while the buzzers are open (UI spec, Screen view: Question), or null with no
 * buzz time. It counts like the answer countdown and is never `up`: the server's time up moves the
 * room to REVEAL, which clears the timer (DECISIONS, F63).
 */
export function useBuzzCountdown({
  buzzTimer,
  questionIndex,
  openingCounter,
}: BuzzCountdownSource): AnswerCountdown | null {
  return useCountdown(buzzTimer, questionIndex, openingCounter);
}

/** The parts of any role's view the choice countdown needs. */
interface ChoiceCountdownSource {
  choice: Pick<ChoiceView, 'timer'> | null;
  questionIndex: number;
  openingCounter: number;
}

/**
 * The time left to answer a choice question (F86), or null outside ANSWERING. It counts like the
 * buzz countdown and is never `up`: the server closes the answering at 0 and reveals (F85).
 */
export function useChoiceCountdown({
  choice,
  questionIndex,
  openingCounter,
}: ChoiceCountdownSource): AnswerCountdown | null {
  return useCountdown(choice?.timer ?? null, questionIndex, openingCounter);
}

/** Counts a view's timer down on this device; keyed by question index and opening counter. */
function useCountdown(
  timer: { seconds: number; up?: boolean } | null,
  questionIndex: number,
  openingCounter: number,
): AnswerCountdown | null {
  const seconds = timer?.seconds ?? 0;
  const up = timer?.up ?? false;
  const key = timer ? `${questionIndex}:${openingCounter}` : null;

  const [count, setCount] = useState({ key, left: seconds });
  let left = count.left;
  if (count.key !== key) {
    setCount({ key, left: seconds });
    left = seconds;
  }

  // When this opening's count started; kept across `up` changing, so it never restarts mid-count.
  const started = useRef<{ key: string; at: number } | null>(null);
  useEffect(() => {
    if (key === null || up) return;
    if (started.current?.key !== key) started.current = { key, at: Date.now() };
    const at = started.current.at;
    const timer = setInterval(() => {
      const next = Math.max(0, seconds - Math.floor((Date.now() - at) / 1000));
      setCount((current) => (current.key === key ? { key, left: next } : current));
      if (next === 0) clearInterval(timer);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [key, seconds, up]);

  if (key === null) return null;
  return up ? { secondsLeft: 0, up: true } : { secondsLeft: left, up: false };
}

/** The countdown as shown: the seconds left, then "Time's up!". */
export function countdownText(countdown: AnswerCountdown): string {
  return countdown.up ? TIME_UP_LABEL : String(countdown.secondsLeft);
}

// Points (spec "Scoring and timing"). Pure. The reducer passes the latency-corrected elapsed
// time (`fairness.ts` `correctedAt`).
import {
  DRAWER_SHARE,
  GUESSER_POINTS_MAX,
  GUESSER_POINTS_MIN,
  POINTS_STEP,
} from '../shared/constants.js';

const roundToStep = (points: number) => POINTS_STEP * Math.round(points / POINTS_STEP);

/**
 * A correct guess: 300 at the start of the turn, falling evenly to 100 at the buzzer, rounded to
 * the nearest 5. `drawMs` is T (`drawSeconds × 1000`), `elapsedMs` is t, clamped to the turn.
 */
export function guesserPoints(drawMs: number, elapsedMs: number): number {
  const t = Math.min(Math.max(elapsedMs, 0), drawMs);
  const span = GUESSER_POINTS_MAX - GUESSER_POINTS_MIN;
  return roundToStep(GUESSER_POINTS_MIN + (span * (drawMs - t)) / drawMs);
}

/** The drawer: half of everything the guessers scored this turn, rounded to the nearest 5. */
export function drawerPoints(guesserPointsThisTurn: readonly number[]): number {
  const sum = guesserPointsThisTurn.reduce((a, b) => a + b, 0);
  return roundToStep(sum * DRAWER_SHARE);
}

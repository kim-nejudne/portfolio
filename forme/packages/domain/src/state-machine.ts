/**
 * The job state machine.
 *
 * The scaffold moved jobs by writing the `state` field directly, which meant any
 * caller could put a job into any state — a cancelled job could go back on press,
 * a job could reach PLATED without a proof ever being approved. This is the one
 * place a transition is allowed, and it is the same table on both sides of the
 * wire so the UI can grey out what the API would reject anyway.
 */
import type { JobState } from './types';

/** The linear production path. HELD and CANCELLED sit outside it. */
export const JOB_STATE_SEQUENCE: readonly JobState[] = [
  'ESTIMATE',
  'ARTWORK_RECEIVED',
  'PREFLIGHT',
  'PROOFING',
  'APPROVED',
  'IMPOSED',
  'PLATED',
  'ON_PRESS',
  'FINISHING',
  'DESPATCHED',
];

/** States a job can never leave. Distinct from HELD, which is a pause. */
export const IMMOVABLE_STATES: readonly JobState[] = ['DESPATCHED', 'CANCELLED'];

/** States that sit outside the linear production path. */
export const OFF_PATH_STATES: readonly JobState[] = ['HELD', 'CANCELLED'];

/**
 * Every legal move. Anything not listed here throws.
 *
 * Two rules worth stating because they are not obvious from the table alone:
 * PROOFING can go backwards to PREFLIGHT (a rejected proof means new artwork),
 * and HELD remembers nothing — resuming a held job returns it to PREFLIGHT,
 * because a job that sat still long enough to be held gets re-checked.
 */
export const TRANSITIONS: Record<JobState, readonly JobState[]> = {
  ESTIMATE: ['ARTWORK_RECEIVED', 'HELD', 'CANCELLED'],
  ARTWORK_RECEIVED: ['PREFLIGHT', 'HELD', 'CANCELLED'],
  PREFLIGHT: ['PROOFING', 'HELD', 'CANCELLED'],
  PROOFING: ['APPROVED', 'PREFLIGHT', 'HELD', 'CANCELLED'],
  APPROVED: ['IMPOSED', 'HELD', 'CANCELLED'],
  IMPOSED: ['PLATED', 'HELD', 'CANCELLED'],
  PLATED: ['ON_PRESS', 'HELD', 'CANCELLED'],
  ON_PRESS: ['FINISHING', 'HELD', 'CANCELLED'],
  FINISHING: ['DESPATCHED', 'HELD', 'CANCELLED'],
  // Despatched is the end of the line. A reprint is a new job, not a rewind.
  DESPATCHED: [],
  HELD: ['PREFLIGHT', 'CANCELLED'],
  // Kept on record forever, but it never moves again.
  CANCELLED: [],
};

export function canTransition(from: JobState, to: JobState): boolean {
  return TRANSITIONS[from].includes(to);
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: JobState,
    readonly to: JobState,
  ) {
    const allowed = TRANSITIONS[from];
    super(
      allowed.length === 0
        ? `${from} is terminal. A job in ${from} cannot move to ${to}.`
        : `${from} cannot move to ${to}. Allowed from ${from}: ${allowed.join(', ')}.`,
    );
    this.name = 'IllegalTransitionError';
  }
}

export function assertTransition(from: JobState, to: JobState): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

/** How far down the production path a job has reached, as a percentage. */
export function progressOf(state: JobState): number {
  if (state === 'CANCELLED' || state === 'HELD') return 0;
  const index = JOB_STATE_SEQUENCE.indexOf(state);
  if (index < 0) return 0;
  return Math.round(((index + 1) / JOB_STATE_SEQUENCE.length) * 100);
}

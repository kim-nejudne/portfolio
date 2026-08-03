/**
 * Projection from the persisted `JobRecord` to the composed `Job` the screens
 * render. Pure: everything it needs is passed in, so the API can run it over a
 * database row and a test can run it over a literal.
 */
import { computeQuote } from './quote';
import { JOB_STATE_SEQUENCE, progressOf } from './state-machine';
import { stateOwner } from './vocabulary';
import type {
  Customer,
  Job,
  JobRecord,
  JobStage,
  JobState,
  PriceMatrix,
  StateOwner,
} from './types';

/** States a job passes through while prepress still owns it. */
export const PREPRESS_STATES: readonly JobState[] = ['ARTWORK_RECEIVED', 'PREFLIGHT', 'PROOFING'];

function isOffPath(state: JobState): boolean {
  return state === 'HELD' || state === 'CANCELLED';
}

/**
 * The last production state the job actually reached, which is what a HELD or
 * CANCELLED job's progress bar should reflect — a job cancelled at PLATED is
 * further along than one cancelled at ESTIMATE, and the board should show it.
 */
export function lastReachedState(record: JobRecord): JobState {
  const reached = JOB_STATE_SEQUENCE.filter((state) => record.stamps[state] !== undefined);
  return reached[reached.length - 1] ?? 'ESTIMATE';
}

export function buildStages(record: JobRecord): readonly JobStage[] {
  const offPath = isOffPath(record.state);
  const last = lastReachedState(record);

  const stages: JobStage[] = JOB_STATE_SEQUENCE.map((state) => {
    const at = record.stamps[state] ?? null;
    const current = !offPath && state === record.state;
    return { state, at, by: null, done: at !== null && !current, current };
  });

  if (!offPath) return stages;

  // A held or cancelled job shows its whole path plus where it stopped.
  stages.push({
    state: record.state,
    at: record.stamps[record.state] ?? null,
    by: null,
    done: false,
    current: true,
  });
  return stages.map((stage) =>
    stage.state === last && stage.at !== null ? { ...stage, done: true } : stage,
  );
}

export function ownerOf(record: JobRecord, blocked: boolean): StateOwner {
  return stateOwner(record.state, blocked);
}

export interface BuildJobContext {
  customer: Customer;
  matrix: PriceMatrix;
  /** True when the preflight report carries an unwaived FAIL. */
  blocked: boolean;
}

export function buildJob(record: JobRecord, context: BuildJobContext): Job {
  // Priced from the proof approval where there is one, because that is when the
  // turnaround clock actually starts. Falls back to receipt for unproofed jobs.
  const from = record.proofAt ?? record.receivedAt;
  return {
    ...record,
    customer: context.customer,
    quote: computeQuote(record.spec, context.matrix, from),
    stages: buildStages(record),
    progress: isOffPath(record.state)
      ? progressOf(lastReachedState(record))
      : progressOf(record.state),
    owner: ownerOf(record, context.blocked),
  };
}

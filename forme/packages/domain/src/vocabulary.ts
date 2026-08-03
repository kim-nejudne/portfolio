/**
 * Vocabulary: labels and status marks. No rates, no records, no dates, no
 * ordering — the state order lives in state-machine.ts, which is authoritative.
 */
import type {
  BindingStyle,
  CheckSeverity,
  JobState,
  SignatureScheme,
  StateOwner,
  WorkStyle,
} from './types';

export const JOB_STATE_LABEL: Record<JobState, string> = {
  ESTIMATE: 'ESTIMATE',
  ARTWORK_RECEIVED: 'ARTWORK RECEIVED',
  PREFLIGHT: 'PREFLIGHT',
  PROOFING: 'PROOFING',
  APPROVED: 'APPROVED',
  IMPOSED: 'IMPOSED',
  PLATED: 'PLATED',
  ON_PRESS: 'ON PRESS',
  FINISHING: 'FINISHING',
  DESPATCHED: 'DESPATCHED',
  HELD: 'HELD',
  CANCELLED: 'CANCELLED',
};

export const JOB_STATE_NOTE: Record<JobState, string> = {
  ESTIMATE: 'Priced. Waiting for the order to be placed.',
  ARTWORK_RECEIVED: 'Artwork logged. Queued for preflight.',
  PREFLIGHT: 'Automated checks running against the artwork specification.',
  PROOFING: 'Proof issued. Waiting on customer approval.',
  APPROVED: 'Proof approved and locked. No further artwork changes.',
  IMPOSED: 'Sheet laid out, forms written.',
  PLATED: 'Plates output and mounted.',
  ON_PRESS: 'Running.',
  FINISHING: 'Bindery: folding, stitching, laminating, trimming.',
  DESPATCHED: 'Boxed and collected.',
  HELD: 'Held. Nothing moves until the hold is lifted.',
  CANCELLED: 'Cancelled. Kept on record.',
};

/**
 * Who the job is waiting on. Drives the colour: system work is cyan,
 * anything waiting on a person is magenta, held is yellow, done is black.
 */
export function stateOwner(state: JobState, hasBlockingFailure = false): StateOwner {
  if (state === 'HELD') return 'held';
  if (state === 'CANCELLED' || state === 'DESPATCHED') return 'final';
  if (state === 'ESTIMATE' || state === 'PROOFING') return 'human';
  if (state === 'PREFLIGHT' && hasBlockingFailure) return 'human';
  return 'system';
}

export const OWNER_LABEL: Record<StateOwner, string> = {
  system: 'AUTOMATED',
  human: 'ACTION REQUIRED',
  held: 'HELD',
  final: 'FINAL',
};

export const SEVERITY_LABEL: Record<CheckSeverity, string> = {
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
  SKIPPED: 'NOT RUN',
};

/**
 * Why a check reports SKIPPED. Shown in the report so the absence is explicit:
 * these are not passes, they are analyses the engine does not perform.
 */
export const SKIPPED_REASON =
  'Not implemented. This check needs content-stream analysis the preflight engine does not do, and reporting it as a pass would be a lie.';

export const SCHEME_LABEL: Record<SignatureScheme, string> = {
  '4pp': '4pp — one fold',
  '8pp': '8pp — two folds',
  '16pp': '16pp — three folds',
};

export const BINDING_LABEL: Record<BindingStyle, string> = {
  'saddle-stitch': 'Saddle stitch',
  'perfect-bound': 'Perfect bound',
  none: 'None (flat work)',
};

export const WORK_STYLE_LABEL: Record<WorkStyle, string> = {
  sheetwise: 'Sheetwise',
  'work-and-turn': 'Work-and-turn',
  'work-and-tumble': 'Work-and-tumble',
};

export const ARTWORK_SPEC = {
  bleedMm: 3,
  safetyMm: 4,
  resolutionPpi: 300,
  inkLimitCoated: 300,
  inkLimitUncoated: 260,
  standard: 'PDF/X-4',
} as const;

export const SHOP = {
  name: 'FORME',
  city: 'Manila',
  opens: '07:00',
  closes: '19:00',
  daysOpen: 6,
  shifts: 2,
  vatLabel: '12%',
} as const;

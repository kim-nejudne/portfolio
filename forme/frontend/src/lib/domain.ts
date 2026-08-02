/**
 * Vocabulary: labels, ordering and status marks. No rates, no records, no dates.
 * Rates and records come from src/lib/api.
 */
import type {
  BindingStyle,
  CheckSeverity,
  JobState,
  SignatureScheme,
  StateOwner,
  WorkStyle,
} from '@/lib/types';

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

export const TERMINAL_STATES: readonly JobState[] = ['HELD', 'CANCELLED'];

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

export function progressOf(state: JobState): number {
  if (state === 'CANCELLED') return 0;
  if (state === 'HELD') return 0;
  const index = JOB_STATE_SEQUENCE.indexOf(state);
  if (index < 0) return 0;
  return Math.round(((index + 1) / JOB_STATE_SEQUENCE.length) * 100);
}

export const SEVERITY_LABEL: Record<CheckSeverity, string> = {
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
};

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

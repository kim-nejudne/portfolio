// The built-in library (Set list `/sets`, Built-in tab): the sample, then the 60 starter sets. Read
// from the bundle and never written to IndexedDB, so they stay read-only and every browser, a
// paired phone included, has the same ones (DECISIONS F54).

import { SAMPLE_SET } from './sampleSet.js';
import { STARTER_SETS } from './starterSets/index.js';
import type { QuestionSet } from './types.js';

/** The sample, then the starters in their list order. */
export const BUILT_IN_SETS: readonly QuestionSet[] = [SAMPLE_SET, ...STARTER_SETS];

const BY_ID = new Map(BUILT_IN_SETS.map((set) => [set.id, set]));

/** The built-in set with this id, or undefined for any other id. */
export function builtInSet(id: string): QuestionSet | undefined {
  return BY_ID.get(id);
}

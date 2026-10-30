// The bundled built-in library as F54 shipped it: the sample, then the 60 starter sets. Since F104
// the pages list the server's built-ins (`client/src/lib/builtInSets.ts`); this list stays for the
// Dexie v3 clean-up, which compares stored copies against the bundled sets they were seeded from.

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

// The rows of **Host a game** and the **New game** picker: this browser's sets, then the built-in
// ones. A My set and a built-in can share an id (an admin may import a set exported from My sets),
// so a row is keyed by its source and id (DECISIONS F104).

import type { QuestionSet } from '../../../shared/types.js';

export interface HostableRows {
  /** My sets first, then the built-ins. */
  sets: QuestionSet[];
  /** A row's key for the picker: `mine:<id>` or `built-in:<id>`. */
  keyOf: (set: QuestionSet) => string;
  isBuiltIn: (set: QuestionSet) => boolean;
}

/** The picker's rows. `builtIn` is null when the built-in sets could not be fetched. */
export function hostableRows(
  mine: readonly QuestionSet[],
  builtIn: readonly QuestionSet[] | null,
): HostableRows {
  const builtIns = new Set(builtIn ?? []);
  const isBuiltIn = (set: QuestionSet) => builtIns.has(set);
  return {
    sets: [...mine, ...(builtIn ?? [])],
    keyOf: (set) => `${isBuiltIn(set) ? 'built-in' : 'mine'}:${set.id}`,
    isBuiltIn,
  };
}

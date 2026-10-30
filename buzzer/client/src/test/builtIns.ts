import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import { resetBuiltInSets } from '../lib/builtInSets.js';

/**
 * Answers the built-in fetch as a freshly seeded server would, with no request: the sample, then
 * the 60 starters, the same list as `BUILT_IN_SETS`. Call `resetBuiltInSets()` after each test.
 */
export function serveSeededBuiltIns(): void {
  resetBuiltInSets({ sets: [...STARTER_SETS], sampleHidden: false });
}

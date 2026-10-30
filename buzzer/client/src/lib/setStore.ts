// Where the set editor loads and autosaves a set (F107): this browser's IndexedDB for My sets, or
// the server's draft API for a built-in set the admin edits.

import type { QuestionSet } from '../../../shared/types.js';
import { loadDraft, saveDraft } from './adminBuiltIns.js';
import { getSet, saveSet } from './db.js';

export interface SetStore {
  /** `admin`: a built-in set, saved as a draft that only **Publish** makes live. */
  kind: 'browser' | 'admin';
  /** The set, or undefined when it does not exist. `draft`: an unpublished draft is open. */
  load(id: string): Promise<{ set: QuestionSet; draft: boolean } | undefined>;
  save(set: QuestionSet): Promise<void>;
}

export const browserSetStore: SetStore = {
  kind: 'browser',
  load: async (id) => {
    const set = await getSet(id);
    return set && { set, draft: false };
  },
  save: (set) => saveSet(set),
};

export const adminDraftStore: SetStore = { kind: 'admin', load: loadDraft, save: saveDraft };

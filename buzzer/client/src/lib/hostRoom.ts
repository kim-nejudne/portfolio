// Creating a room from a saved set (Creating and joining a room, step 1). Shared by **Host a game**
// on the landing page and **Host this set** on the set list.

import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { questionSetSchema } from '../../../shared/schemas.js';
import type { QuestionSet } from '../../../shared/types.js';
import { createRoom } from './api.js';
import { saveHostToken } from './hostTokens.js';

type Checked = { ok: true; set: QuestionSet } | { ok: false; error: string };

/**
 * Checks a saved set against the playable schema. Saved sets may be drafts (DECISIONS F02), so this
 * tells the host what to fix before the server would refuse the room.
 */
export function checkPlayable(set: QuestionSet): Checked {
  const result = questionSetSchema.safeParse(set);
  if (result.success) return { ok: true, set: result.data };

  if (set.questions.length === 0) return { ok: false, error: 'This set has no questions yet.' };
  const issue = result.error.issues[0]!;
  const [first, index, field] = issue.path;
  if (first === 'title') return { ok: false, error: 'This set needs a title.' };
  if (first === 'questions' && typeof index === 'number') {
    const number = index + 1;
    if (field === 'answer') return { ok: false, error: `Question ${number} needs an answer.` };
    if (field === 'text' && issue.code === 'custom') {
      return { ok: false, error: `Question ${number} needs text or an image.` };
    }
    return {
      ok: false,
      error: `Question ${number}${typeof field === 'string' ? ` (${field})` : ''}: ${issue.message}`,
    };
  }
  return { ok: false, error: `This set can't be played yet: ${issue.message}` };
}

/**
 * Creates a room for `set` with the default settings and keeps its hostToken on this device.
 * Returns the room code. Throws a readable Error when the set is not playable or the server refuses.
 */
export async function hostSet(set: QuestionSet): Promise<string> {
  const checked = checkPlayable(set);
  if (!checked.ok) throw new Error(checked.error);
  // SPEC-QUESTION: the set's images are not uploaded yet (POST /api/rooms/:code/images/:imageId is
  // F30), so a set with `imageId` questions would show broken images. No editor adds one before F29.
  const { code, hostToken } = await createRoom({ set: checked.set, settings: DEFAULT_SETTINGS });
  saveHostToken(code, hostToken);
  return code;
}

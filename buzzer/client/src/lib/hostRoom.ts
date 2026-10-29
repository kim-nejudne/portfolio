// Creating a room from a saved set (Creating and joining a room, step 1). Shared by **Host a game**
// on the landing page and **Host this set** on the set list, and **New game** after the final results.

import { DEFAULT_SETTINGS, ROOM_IMAGES_MAX_BYTES } from '../../../shared/constants.js';
import { questionSetSchema } from '../../../shared/schemas.js';
import type { QuestionSet } from '../../../shared/types.js';
import { createRoom, replaceSet, uploadImage } from './api.js';
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

/** Reads one stored image blob, or undefined when it is gone from this browser. */
export type LoadImage = (imageId: string) => Promise<Blob | undefined>;

// Dexie loads only when a host creates a room, not on every player's phone (as in HostGame).
const loadStoredImage: LoadImage = async (imageId) =>
  (await (await import('./db.js')).getImage(imageId))?.blob;

const MB = 1024 * 1024;

/**
 * The playable copy of `set` and each image its questions use, once. Throws a readable Error when
 * the set is not playable, an image is missing from this browser or they add up to over 50 MB.
 */
async function gatherImages(
  set: QuestionSet,
  loadImage: LoadImage,
): Promise<{ set: QuestionSet; images: Map<string, Blob> }> {
  const checked = checkPlayable(set);
  if (!checked.ok) throw new Error(checked.error);

  const images = new Map<string, Blob>();
  for (const [index, question] of checked.set.questions.entries()) {
    if (question.imageId === undefined || images.has(question.imageId)) continue;
    const blob = await loadImage(question.imageId);
    if (!blob) throw new Error(`Question ${index + 1}'s image is missing from this browser.`);
    images.set(question.imageId, blob);
  }
  const total = [...images.values()].reduce((sum, blob) => sum + blob.size, 0);
  if (total > ROOM_IMAGES_MAX_BYTES) {
    throw new Error(
      `This set's images add up to ${(total / MB).toFixed(1)} MB. A game holds up to ${ROOM_IMAGES_MAX_BYTES / MB} MB.`,
    );
  }
  return { set: checked.set, images };
}

/**
 * An image upload failed after the new set was already in the room (`hostNextSet`): retry with
 * `uploadSetImages`, as another PUT would get 409.
 */
export class SetImagesError extends Error {
  constructor(message: string, options: ErrorOptions) {
    super(message, options);
    this.name = 'SetImagesError';
  }
}

async function uploadImages(
  code: string,
  hostToken: string,
  images: Map<string, Blob>,
  ErrorType: new (message: string, options: ErrorOptions) => Error = Error,
): Promise<void> {
  for (const [imageId, blob] of images) {
    try {
      await uploadImage(code, hostToken, imageId, blob);
    } catch (caught) {
      throw new ErrorType(`Couldn't upload an image: ${(caught as Error).message}`, {
        cause: caught,
      });
    }
  }
}

/**
 * Creates a room for `set` with the default settings, keeps its hostToken on this device, then
 * uploads each image its questions use, once. Returns the room code. Throws a readable Error when
 * the set is not playable, an image is missing or over the room's 50 MB, or the server refuses.
 * The image checks run before the room is created, so a set that cannot be uploaded makes no room.
 */
export async function hostSet(set: QuestionSet, loadImage = loadStoredImage): Promise<string> {
  const gathered = await gatherImages(set, loadImage);
  const { code, hostToken } = await createRoom({ set: gathered.set, settings: DEFAULT_SETTINGS });
  saveHostToken(code, hostToken);
  await uploadImages(code, hostToken, gathered.images);
  return code;
}

/**
 * **New game** after the final results (DECISIONS F49–F50): replaces room `code`'s set, then
 * uploads each image the new set uses, once. The checks run before the PUT, so a set that cannot
 * be uploaded leaves the finished game as it was. Errors read as in `hostSet`; a 409 throws
 * `NewGameTakenError`, and a failed upload throws `SetImagesError`.
 */
export async function hostNextSet(
  code: string,
  hostToken: string,
  set: QuestionSet,
  keepScores: boolean,
  loadImage = loadStoredImage,
): Promise<void> {
  const gathered = await gatherImages(set, loadImage);
  await replaceSet(code, hostToken, { set: gathered.set, keepScores });
  await uploadImages(code, hostToken, gathered.images, SetImagesError);
}

/** After a `SetImagesError`: uploads every image `set` uses again, once each. */
export async function uploadSetImages(
  code: string,
  hostToken: string,
  set: QuestionSet,
  loadImage = loadStoredImage,
): Promise<void> {
  const gathered = await gatherImages(set, loadImage);
  await uploadImages(code, hostToken, gathered.images, SetImagesError);
}

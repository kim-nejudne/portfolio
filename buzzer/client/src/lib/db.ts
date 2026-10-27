// This browser's question sets and image blobs, in IndexedDB through Dexie (Tech stack: Browser
// storage). Nothing here reaches the server until a room is created.

import Dexie, { type EntityTable } from 'dexie';
import { nanoid } from 'nanoid';
import { SET_TITLE_MAX } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import type { QuestionSet } from '../../../shared/types.js';

/** One image, referenced from a question by `imageId`. The editor's image pipeline comes with F29. */
export interface StoredImage {
  id: string;
  blob: Blob;
}

/** Title of a set made with **New set**, until the editor renames it. */
export const NEW_SET_TITLE = 'Untitled set';

const COPY_SUFFIX = ' (copy)';

class BuzzrDb extends Dexie {
  // Saved sets may be drafts: typed, not schema-checked, until play or export (DECISIONS F02).
  sets!: EntityTable<QuestionSet, 'id'>;
  images!: EntityTable<StoredImage, 'id'>;

  constructor() {
    super('buzzr');
    this.version(1).stores({ sets: 'id, updatedAt', images: 'id' });
    // `populate` runs once, when this browser first creates the database. A deleted sample stays
    // deleted. The add runs inside the creating transaction, so a failed seed fails `open()`.
    this.on('populate', (tx) => {
      const now = Date.now();
      return tx
        .table<QuestionSet, string>('sets')
        .add({ ...SAMPLE_SET, createdAt: now, updatedAt: now });
    });
  }
}

export const db = new BuzzrDb();

// Every helper is async, so a browser without IndexedDB (some private modes) gives a rejected
// promise the page can show, not a synchronous throw during render.

/** Every saved set, last edited first. */
export async function listSets(): Promise<QuestionSet[]> {
  return db.sets.orderBy('updatedAt').reverse().toArray();
}

export async function getSet(id: string): Promise<QuestionSet | undefined> {
  return db.sets.get(id);
}

/** **New set**: an empty draft with a fresh id. */
export async function createSet(now = Date.now()): Promise<QuestionSet> {
  const set: QuestionSet = {
    id: nanoid(),
    title: NEW_SET_TITLE,
    questions: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
  await db.sets.add(set);
  return set;
}

/** "Quiz" → "Quiz (copy)", cut so the result still fits `SET_TITLE_MAX`. */
export function copyTitle(title: string): string {
  return title.slice(0, SET_TITLE_MAX - COPY_SUFFIX.length) + COPY_SUFFIX;
}

/**
 * **Duplicate**: a new set with a fresh id and its own copy of every image, so deleting either set
 * never removes an image the other still uses. Question ids only need to be unique within a set.
 */
export async function duplicateSet(id: string, now = Date.now()): Promise<QuestionSet> {
  return db.transaction('rw', db.sets, db.images, async () => {
    const source = await db.sets.get(id);
    if (!source) throw new Error('That set no longer exists.');

    const newImageIds = new Map<string, string>();
    for (const question of source.questions) {
      if (question.imageId === undefined || newImageIds.has(question.imageId)) continue;
      const image = await db.images.get(question.imageId);
      if (!image) continue;
      const copyId = nanoid();
      await db.images.add({ id: copyId, blob: image.blob });
      newImageIds.set(question.imageId, copyId);
    }

    const copy: QuestionSet = {
      ...source,
      id: nanoid(),
      title: copyTitle(source.title),
      questions: source.questions.map((question) =>
        question.imageId === undefined
          ? { ...question }
          : { ...question, imageId: newImageIds.get(question.imageId) ?? question.imageId },
      ),
      createdAt: now,
      updatedAt: now,
    };
    await db.sets.add(copy);
    return copy;
  });
}

/** **Delete**: removes the set and the images its questions reference. */
export async function deleteSet(id: string): Promise<void> {
  return db.transaction('rw', db.sets, db.images, async () => {
    const set = await db.sets.get(id);
    if (!set) return;
    const imageIds = set.questions.flatMap((q) => (q.imageId === undefined ? [] : [q.imageId]));
    await db.images.bulkDelete(imageIds);
    await db.sets.delete(id);
  });
}

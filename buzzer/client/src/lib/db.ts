// This browser's question sets and image blobs, in IndexedDB through Dexie (Tech stack: Browser
// storage). Nothing here reaches the server until a room is created.

import Dexie, { type EntityTable } from 'dexie';
import { nanoid } from 'nanoid';
import { builtInSet } from '../../../shared/builtInSets.js';
import { SET_TITLE_MAX } from '../../../shared/constants.js';
import { SAMPLE_SET, SAMPLE_SET_ID } from '../../../shared/sampleSet.js';
import type { QuestionSet } from '../../../shared/types.js';
import { loadBuiltInSets } from './builtInSets.js';
import { sampleImages } from './sampleImages.js';

/** One image, referenced from a question by `imageId`. The editor stores it already shrunk (F29). */
export interface StoredImage {
  id: string;
  blob: Blob;
}

/** Title of a set made with **New set**, until the editor renames it. */
export const NEW_SET_TITLE = 'Untitled set';

const COPY_SUFFIX = ' (copy)';

/** The ids of the images `set`'s questions use, once per question that has one. */
function imageIdsOf(set: QuestionSet): string[] {
  return set.questions.flatMap((q) => (q.imageId === undefined ? [] : [q.imageId]));
}

/** Equal as JSON values: the same keys in any order (an undefined value counts as absent). */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = (value: object) =>
    Object.entries(value).flatMap(([key, v]) => (v === undefined ? [] : [key]));
  const [ka, kb] = [keys(a), keys(b)];
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return (
    ka.length === kb.length && ka.every((key) => kb.includes(key) && jsonEqual(ra[key], rb[key]))
  );
}

/**
 * Whether a stored copy of a built-in set is the bundled set as seeded: the same title, category,
 * difficulty and questions. A copy seeded before F53 has neither field, so it is compared as if it
 * had the bundled ones (DECISIONS F53).
 */
function isUnedited(stored: QuestionSet, bundled: QuestionSet): boolean {
  const preF53 = stored.category === undefined && stored.difficulty === undefined;
  return (
    stored.title === bundled.title &&
    (preF53 ||
      (stored.category === bundled.category && stored.difficulty === bundled.difficulty)) &&
    jsonEqual(stored.questions, bundled.questions)
  );
}

const STORES = { sets: 'id, updatedAt', images: 'id' };

class BuzzrDb extends Dexie {
  // Saved sets may be drafts: typed, not schema-checked, until play or export (DECISIONS F02).
  sets!: EntityTable<QuestionSet, 'id'>;
  images!: EntityTable<StoredImage, 'id'>;

  constructor() {
    super('buzzr');
    // v1 seeded the sample and v2 the starters (F25, F48). Built-in sets are never stored (DECISIONS
    // F54; from the server since F104), so a new database starts empty and neither seed runs any more.
    this.version(1).stores(STORES);
    this.version(2).stores(STORES);
    // v3 removes the seeded copies of built-in sets, compared against the bundled ones they were
    // seeded from. A copy the host edited stays in My sets under
    // a fresh id, so no stored id collides with a built-in one. The sample's pictures go with it
    // unless another set still uses them. Chained on Dexie's own promises: a native `await` here
    // can let the transaction close.
    this.version(3)
      .stores(STORES)
      .upgrade((tx) => {
        const sets = tx.table<QuestionSet, string>('sets');
        return sets.toArray().then((stored) => {
          const unedited = new Set<string>();
          const edited: QuestionSet[] = [];
          for (const set of stored) {
            const bundled = builtInSet(set.id);
            if (!bundled) continue;
            if (isUnedited(set, bundled)) unedited.add(set.id);
            else edited.push(set);
          }
          const used = new Set(stored.filter((s) => !unedited.has(s.id)).flatMap(imageIdsOf));
          const orphans = imageIdsOf(SAMPLE_SET).filter((id) => !used.has(id));
          return sets
            .bulkDelete([...unedited, ...edited.map((set) => set.id)])
            .then(() => sets.bulkAdd(edited.map((set) => ({ ...set, id: nanoid() }))))
            .then(() => tx.table<StoredImage, string>('images').bulkDelete(orphans));
        });
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

/**
 * **Host a game** and the **New game** picker: this browser's sets, last edited first, and the
 * server's built-in library after them. `builtIn` is null when it could not be fetched, so the
 * picker still lists My sets (DECISIONS F104).
 */
export async function listHostableSets(): Promise<{
  mine: QuestionSet[];
  builtIn: readonly QuestionSet[] | null;
}> {
  const [mine, builtIn] = await Promise.all([listSets(), loadBuiltInSets().catch(() => null)]);
  return { mine, builtIn };
}

export async function getSet(id: string): Promise<QuestionSet | undefined> {
  return db.sets.get(id);
}

/** One stored image blob, or undefined when it is gone. */
export async function getImage(id: string): Promise<StoredImage | undefined> {
  return db.images.get(id);
}

/** Stores an image the editor has shrunk, under a fresh id for the question to reference. */
export async function addImage(blob: Blob): Promise<string> {
  const id = nanoid();
  await db.images.add({ id, blob });
  return id;
}

/** Removes images no question uses any more. Unknown ids are ignored. */
export async function deleteImages(ids: readonly string[]): Promise<void> {
  await db.images.bulkDelete([...ids]);
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

/**
 * **Duplicate to My sets**: an editable copy of a built-in set, titled like Duplicate's, with its
 * own copy of the sample's pictures under fresh ids. The server's built-ins have no pictures.
 */
export async function duplicateBuiltIn(
  source: QuestionSet,
  now = Date.now(),
): Promise<QuestionSet> {
  const images = source.id === SAMPLE_SET_ID ? sampleImages() : [];
  return importSet({ ...source, title: copyTitle(source.title) }, images, now);
}

/** **Delete**: removes the set and the images its questions reference. */
export async function deleteSet(id: string): Promise<void> {
  return db.transaction('rw', db.sets, db.images, async () => {
    const set = await db.sets.get(id);
    if (!set) return;
    await db.images.bulkDelete(imageIdsOf(set));
    await db.sets.delete(id);
  });
}

/**
 * The editor's autosave: writes the whole set and stamps `updatedAt`, so the set list's "last
 * edited first" order follows edits. `createdAt` stays as stored.
 */
export async function saveSet(set: QuestionSet, now = Date.now()): Promise<void> {
  await db.sets.put({ ...set, updatedAt: now });
}

/**
 * **Import JSON**: stores a parsed file as a new set, under fresh set and image ids, so importing a
 * file twice or next to its original never overwrites anything.
 */
export async function importSet(
  set: QuestionSet,
  images: StoredImage[],
  now = Date.now(),
): Promise<QuestionSet> {
  return db.transaction('rw', db.sets, db.images, async () => {
    const newImageIds = new Map(images.map((image) => [image.id, nanoid()]));
    await db.images.bulkAdd(images.map((image) => ({ ...image, id: newImageIds.get(image.id)! })));

    const imported: QuestionSet = {
      ...set,
      id: nanoid(),
      questions: set.questions.map((question) =>
        question.imageId === undefined
          ? { ...question }
          : { ...question, imageId: newImageIds.get(question.imageId) ?? question.imageId },
      ),
      createdAt: now,
      updatedAt: now,
    };
    await db.sets.add(imported);
    return imported;
  });
}

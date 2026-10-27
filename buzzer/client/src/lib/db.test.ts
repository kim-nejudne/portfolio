import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SET_TITLE_MAX } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import type { QuestionSet } from '../../../shared/types.js';
import {
  addImage,
  copyTitle,
  createSet,
  db,
  deleteImages,
  deleteSet,
  duplicateSet,
  getSet,
  listSets,
  NEW_SET_TITLE,
  saveSet,
} from './db.js';

const FIRST_VISIT = 1_700_000_000_000;

function set(id: string, updatedAt: number, questions: QuestionSet['questions'] = []): QuestionSet {
  return { id, title: `Set ${id}`, questions, createdAt: 1, updatedAt, schemaVersion: 1 };
}

function imageQuestion(id: string, imageId: string) {
  return { id, text: '', imageId, answer: 'A', points: 100 };
}

beforeEach(async () => {
  // A fresh database each test, as on a first visit.
  vi.spyOn(Date, 'now').mockReturnValue(FIRST_VISIT);
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('question set database', () => {
  it('seeds the sample set on first visit, stamped with the visit time', async () => {
    const sets = await listSets();
    expect(sets).toEqual([{ ...SAMPLE_SET, createdAt: FIRST_VISIT, updatedAt: FIRST_VISIT }]);
  });

  it('does not seed the sample again once it was deleted', async () => {
    await deleteSet(SAMPLE_SET.id);
    db.close();
    await db.open();
    expect(await listSets()).toEqual([]);
  });

  it('lists sets last edited first', async () => {
    await db.sets.bulkAdd([set('old', 10), set('new', FIRST_VISIT + 5), set('mid', 500)]);
    expect((await listSets()).map((s) => s.id)).toEqual(['new', SAMPLE_SET.id, 'mid', 'old']);
  });

  it('New set saves an empty, untitled draft with a fresh id', async () => {
    const created = await createSet(42);
    expect(created).toMatchObject({ title: NEW_SET_TITLE, questions: [], createdAt: 42 });
    expect(created.id).not.toBe(SAMPLE_SET.id);
    expect(await getSet(created.id)).toEqual(created);
  });

  it('Duplicate saves a copy with a new id, a "(copy)" title and the same questions', async () => {
    const copy = await duplicateSet(SAMPLE_SET.id, 99);
    expect(copy.id).not.toBe(SAMPLE_SET.id);
    expect(copy).toMatchObject({
      title: `${SAMPLE_SET.title} (copy)`,
      createdAt: 99,
      updatedAt: 99,
    });
    expect(copy.questions).toEqual(SAMPLE_SET.questions);
    expect(await getSet(copy.id)).toEqual(copy);
    expect(await listSets()).toHaveLength(2);
  });

  it('Duplicate leaves the original unchanged', async () => {
    const before = await getSet(SAMPLE_SET.id);
    await duplicateSet(SAMPLE_SET.id, 99);
    expect(await getSet(SAMPLE_SET.id)).toEqual(before);
  });

  it('Duplicate copies image blobs, so the copy keeps them when the original is deleted', async () => {
    await db.images.add({ id: 'img-1', blob: new Blob(['png bytes'], { type: 'image/png' }) });
    await db.sets.add(set('pics', 5, [imageQuestion('q1', 'img-1'), imageQuestion('q2', 'img-1')]));

    const copy = await duplicateSet('pics');
    const copiedId = copy.questions[0]!.imageId!;
    expect(copiedId).not.toBe('img-1');
    expect(copy.questions[1]!.imageId).toBe(copiedId);

    await deleteSet('pics');
    const image = await db.images.get(copiedId);
    expect(await image!.blob.text()).toBe('png bytes');
    expect(image!.blob.type).toBe('image/png');
  });

  it('stores an added image under a fresh id and deletes it again by id', async () => {
    const first = await addImage(new Blob(['webp bytes'], { type: 'image/webp' }));
    const second = await addImage(new Blob(['other'], { type: 'image/webp' }));
    expect(first).not.toBe(second);
    const stored = await db.images.get(first);
    expect(await stored!.blob.text()).toBe('webp bytes');
    expect(stored!.blob.type).toBe('image/webp');

    await deleteImages([first, 'never-stored']);
    expect(await db.images.get(first)).toBeUndefined();
    expect(await db.images.get(second)).toBeDefined();
  });

  it('Duplicate of a missing set fails with a readable error', async () => {
    await expect(duplicateSet('gone')).rejects.toThrow('That set no longer exists.');
  });

  it("Delete removes the set and its images, and leaves other sets' images", async () => {
    await db.images.bulkAdd([
      { id: 'img-a', blob: new Blob(['a']) },
      { id: 'img-b', blob: new Blob(['b']) },
    ]);
    await db.sets.bulkAdd([
      set('a', 5, [imageQuestion('q1', 'img-a')]),
      set('b', 6, [imageQuestion('q1', 'img-b')]),
    ]);

    await deleteSet('a');
    expect(await getSet('a')).toBeUndefined();
    expect(await db.images.get('img-a')).toBeUndefined();
    expect(await db.images.get('img-b')).toBeDefined();
  });

  it('copy titles stay within the title limit', () => {
    expect(copyTitle('Quiz')).toBe('Quiz (copy)');
    const long = copyTitle('x'.repeat(SET_TITLE_MAX));
    expect(long).toHaveLength(SET_TITLE_MAX);
    expect(long.endsWith(' (copy)')).toBe(true);
  });

  it('saving an edited set stamps updatedAt, so it moves to the top of the list', async () => {
    await db.sets.add(set('other', FIRST_VISIT + 5));
    const sample = (await getSet(SAMPLE_SET.id))!;
    await saveSet({ ...sample, title: 'Renamed' }, FIRST_VISIT + 10);
    expect(await getSet(SAMPLE_SET.id)).toEqual({
      ...sample,
      title: 'Renamed',
      createdAt: FIRST_VISIT,
      updatedAt: FIRST_VISIT + 10,
    });
    expect((await listSets()).map((s) => s.id)).toEqual([SAMPLE_SET.id, 'other']);
  });
});

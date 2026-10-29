import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SET_TITLE_MAX } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
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

const STARTER_IDS = STARTER_SETS.map((s) => s.id);

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

/** Starters as seeded below `top`: the first one at `top - 1`, then one ms older each. */
function starterStamps(top: number): QuestionSet[] {
  return STARTER_SETS.map((s, i) => ({ ...s, createdAt: top - 1 - i, updatedAt: top - 1 - i }));
}

/** Replaces the database with a version-1 one (before the starters) holding `sets`. */
async function openAsV1(sets: QuestionSet[]): Promise<void> {
  db.close();
  await Dexie.delete('buzzr');
  const v1 = new Dexie('buzzr');
  v1.version(1).stores({ sets: 'id, updatedAt', images: 'id' });
  await v1.open();
  await v1.table('sets').bulkAdd(sets);
  v1.close();
}

describe('question set database', () => {
  it('seeds the sample, then the 60 starters in order, stamped from the visit time', async () => {
    const sets = await listSets();
    expect(sets).toHaveLength(61);
    expect(sets).toEqual([
      { ...SAMPLE_SET, createdAt: FIRST_VISIT, updatedAt: FIRST_VISIT },
      ...starterStamps(FIRST_VISIT),
    ]);
    expect(sets[1]!.title).toBe('Animals – Easy');
    expect(sets[60]!.title).toBe('Words & Language – Hard');
  });

  it('upgrades a v1 database: own sets stay first and unchanged, starters go below the oldest', async () => {
    const mine = [set('mine-new', 5_000), set('mine-old', 2_000)];
    await openAsV1(mine);
    await db.open();
    const sets = await listSets();
    expect(sets).toEqual([...mine, ...starterStamps(2_000)]);
    // Host a game preselects the first listed set: still the host's newest.
    expect(sets[0]!.id).toBe('mine-new');
  });

  it('upgrades an empty v1 database with the starters stamped from now', async () => {
    await openAsV1([]);
    await db.open();
    expect(await listSets()).toEqual(starterStamps(FIRST_VISIT));
  });

  it('upgrade keeps a stored set whose id is a starter id, and adds only the missing ones', async () => {
    const edited = { ...STARTER_SETS[0]!, title: 'My animals', createdAt: 3_000, updatedAt: 3_000 };
    await openAsV1([edited]);
    await db.open();
    const sets = await listSets();
    expect(sets).toHaveLength(60);
    expect(sets[0]).toEqual(edited);
    expect(sets.slice(1).map((s) => s.id)).toEqual(STARTER_IDS.slice(1));
    expect(sets[1]!.updatedAt).toBe(3_000 - 1 - 1);
  });

  it('does not seed a starter again once it was deleted', async () => {
    await deleteSet(STARTER_IDS[0]!);
    db.close();
    await db.open();
    const ids = (await listSets()).map((s) => s.id);
    expect(ids).toHaveLength(60);
    expect(ids).not.toContain(STARTER_IDS[0]);
  });

  it('does not seed a starter again after an upgrade and a delete', async () => {
    await openAsV1([set('mine', 2_000)]);
    await db.open();
    await deleteSet(STARTER_IDS[5]!);
    db.close();
    await db.open();
    expect((await listSets()).map((s) => s.id)).not.toContain(STARTER_IDS[5]);
  });

  it("seeds the sample's 2 pictures as PNG blobs under the ids its questions use", async () => {
    const used = SAMPLE_SET.questions.flatMap((q) => (q.imageId ? [q.imageId] : []));
    const images = await db.images.toArray();
    expect(images.map((i) => i.id).sort()).toEqual([...used].sort());
    for (const { blob } of images) {
      expect(blob.type).toBe('image/png');
      const signature = new Uint8Array(await blob.arrayBuffer()).slice(0, 8);
      expect([...signature]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }
  });

  it('does not seed the sample again once it was deleted', async () => {
    await deleteSet(SAMPLE_SET.id);
    db.close();
    await db.open();
    expect((await listSets()).map((s) => s.id)).toEqual(STARTER_IDS);
  });

  it('lists sets last edited first', async () => {
    await db.sets.bulkAdd([set('old', 10), set('new', FIRST_VISIT + 5), set('mid', 500)]);
    expect((await listSets()).map((s) => s.id)).toEqual([
      'new',
      SAMPLE_SET.id,
      ...STARTER_IDS,
      'mid',
      'old',
    ]);
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
    // Same questions, but each picture is copied under a new id (DECISIONS F25).
    expect(copy.questions).toEqual(
      SAMPLE_SET.questions.map((q) =>
        q.imageId === undefined ? q : { ...q, imageId: expect.not.stringMatching(q.imageId) },
      ),
    );
    expect(await getSet(copy.id)).toEqual(copy);
    expect(await listSets()).toHaveLength(62);
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
    expect((await listSets()).map((s) => s.id).slice(0, 2)).toEqual([SAMPLE_SET.id, 'other']);
  });
});

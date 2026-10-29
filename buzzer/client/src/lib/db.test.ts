import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SET_TITLE_MAX } from '../../../shared/constants.js';
import { BUILT_IN_SETS } from '../../../shared/builtInSets.js';
import { SAMPLE_FLAG_ID, SAMPLE_HEXAGON_ID, SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { QuestionSet } from '../../../shared/types.js';
import { sampleImages } from './sampleImages.js';
import {
  addImage,
  copyTitle,
  createSet,
  db,
  deleteImages,
  deleteSet,
  duplicateBuiltIn,
  duplicateSet,
  getSet,
  listHostableSets,
  listSets,
  NEW_SET_TITLE,
  saveSet,
} from './db.js';

const FIRST_VISIT = 1_700_000_000_000;

/** A copy of the sample stored as the host's own set, with its pictures. */
const OWN = 'own-sample';

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

/** The sample's two picture ids. */
const SAMPLE_IMAGE_IDS = [SAMPLE_FLAG_ID, SAMPLE_HEXAGON_ID];

/** The sample and the starters as F48's `populate` stored them, before category and difficulty. */
function seededV2(): QuestionSet[] {
  const seeded = [
    { ...SAMPLE_SET, createdAt: 2_000, updatedAt: 2_000 },
    ...STARTER_SETS.map((s, i) => ({ ...s, createdAt: 1_999 - i, updatedAt: 1_999 - i })),
  ];
  return seeded.map((set) => {
    const old = { ...set };
    delete old.category;
    delete old.difficulty;
    return old;
  });
}

/**
 * Replaces the database with a version-`version` one holding `sets` and `images`, as an older
 * build left it (v1 seeded the sample, v2 the starters too).
 */
async function openAsOld(
  version: 1 | 2,
  sets: QuestionSet[],
  images = sampleImages(),
): Promise<void> {
  db.close();
  await Dexie.delete('buzzr');
  const old = new Dexie('buzzr');
  old.version(version).stores({ sets: 'id, updatedAt', images: 'id' });
  await old.open();
  await old.table('sets').bulkAdd(sets);
  await old.table('images').bulkAdd(images);
  old.close();
}

const imageIds = async () => (await db.images.toCollection().primaryKeys()).sort();

describe('built-in sets', () => {
  it('BUILT_IN_SETS is the sample, then the 60 starters in their order', () => {
    expect(BUILT_IN_SETS).toEqual([SAMPLE_SET, ...STARTER_SETS]);
    expect(BUILT_IN_SETS).toHaveLength(61);
  });

  it('a fresh database holds no built-in sets and no pictures', async () => {
    expect(await listSets()).toEqual([]);
    expect(await db.images.count()).toBe(0);
  });

  it("Host a game's list is this browser's sets, last edited first, then the built-ins", async () => {
    await db.sets.bulkAdd([set('old', 10), set('new', 20)]);
    const { mine, builtIn } = await listHostableSets();
    expect(mine.map((s) => s.id)).toEqual(['new', 'old']);
    expect(builtIn).toBe(BUILT_IN_SETS);
  });

  it('Duplicate to My sets stores an editable "(copy)" of a starter under a fresh id', async () => {
    const starter = STARTER_SETS[4]!;
    const copy = await duplicateBuiltIn(starter.id, 99);
    expect(copy).toEqual({
      ...starter,
      id: expect.not.stringMatching(starter.id),
      title: `${starter.title} (copy)`,
      createdAt: 99,
      updatedAt: 99,
    });
    expect(await listSets()).toEqual([copy]);
  });

  it("Duplicate to My sets copies the sample's pictures under fresh ids", async () => {
    const copy = await duplicateBuiltIn(SAMPLE_SET.id, 99);
    const copied = copy.questions.flatMap((q) => (q.imageId ? [q.imageId] : []));
    expect(copied).toHaveLength(2);
    for (const id of copied) expect(SAMPLE_IMAGE_IDS).not.toContain(id);
    expect(await imageIds()).toEqual([...copied].sort());
    for (const id of copied) {
      const signature = new Uint8Array(await (await db.images.get(id))!.blob.arrayBuffer());
      expect([...signature.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  });

  it('Duplicate to My sets of an unknown id fails with a readable error', async () => {
    await expect(duplicateBuiltIn('gone')).rejects.toThrow('That set no longer exists.');
  });
});

describe('version 3 upgrade', () => {
  it('removes the untouched sample and starters from a v2 database, with the pictures', async () => {
    await openAsOld(2, seededV2());
    await db.open();
    expect(await listSets()).toEqual([]);
    expect(await db.images.count()).toBe(0);
  });

  it('removes untouched starters stored with category and difficulty (seeded after F53)', async () => {
    const withFields = STARTER_SETS.slice(0, 3).map((s) => ({ ...s, createdAt: 5, updatedAt: 5 }));
    await openAsOld(2, withFields, []);
    await db.open();
    expect(await listSets()).toEqual([]);
  });

  it("leaves the host's own sets and their pictures untouched", async () => {
    const own = [set('mine-new', 5_000), set('mine-pics', 3_000, [imageQuestion('q1', 'img-1')])];
    const ownImage = { id: 'img-1', blob: new Blob(['png'], { type: 'image/png' }) };
    await openAsOld(2, [...own, ...seededV2()], [...sampleImages(), ownImage]);
    await db.open();
    expect(await listSets()).toEqual(own);
    expect(await imageIds()).toEqual(['img-1']);
  });

  it('keeps an edited starter in My sets under a fresh id, with its content and dates', async () => {
    const [first, ...rest] = seededV2();
    const editedTitle = { ...rest[0]!, title: 'My animals' };
    const editedQuestion = {
      ...rest[1]!,
      questions: rest[1]!.questions.map((q, i) => (i === 0 ? { ...q, answer: 'Changed' } : q)),
    };
    const editedLevel = {
      ...STARTER_SETS[2]!,
      difficulty: 'easy' as const,
      createdAt: 9,
      updatedAt: 9,
    };
    await openAsOld(2, [first!, editedTitle, editedQuestion, editedLevel, ...rest.slice(3)]);
    await db.open();

    const kept = await listSets();
    expect(kept).toEqual(
      [editedTitle, editedQuestion, editedLevel].map((set) => ({ ...set, id: expect.any(String) })),
    );
    const builtInIds = new Set(BUILT_IN_SETS.map((s) => s.id));
    for (const { id } of kept) expect(builtInIds.has(id)).toBe(false);
  });

  it("keeps the sample's pictures while an edited sample still uses them", async () => {
    const [sample, ...starters] = seededV2();
    const edited = { ...sample!, title: 'Our sample', updatedAt: 3_000 };
    await openAsOld(2, [edited, ...starters]);
    await db.open();

    const [kept] = await listSets();
    expect(kept).toEqual({ ...edited, id: expect.not.stringMatching(SAMPLE_SET.id) });
    expect(await imageIds()).toEqual([...SAMPLE_IMAGE_IDS].sort());
  });

  it('removes the sample a v1 database seeded and keeps a copy the host made', async () => {
    const seededSample = { ...SAMPLE_SET, createdAt: 2_000, updatedAt: 2_000 };
    await openAsOld(1, [seededSample, set('mine', 1_000)]);
    await db.open();
    expect((await listSets()).map((s) => s.id)).toEqual(['mine']);
    expect(await db.images.count()).toBe(0);
  });
});

describe('question set database', () => {
  beforeEach(async () => {
    await db.sets.add({ ...SAMPLE_SET, id: OWN, createdAt: FIRST_VISIT, updatedAt: FIRST_VISIT });
    await db.images.bulkAdd(sampleImages());
  });

  it('lists sets last edited first', async () => {
    await db.sets.bulkAdd([set('old', 10), set('new', FIRST_VISIT + 5), set('mid', 500)]);
    expect((await listSets()).map((s) => s.id)).toEqual(['new', OWN, 'mid', 'old']);
  });

  it('New set saves an empty, untitled draft with a fresh id', async () => {
    const created = await createSet(42);
    expect(created).toMatchObject({ title: NEW_SET_TITLE, questions: [], createdAt: 42 });
    expect(created.id).not.toBe(OWN);
    expect(await getSet(created.id)).toEqual(created);
  });

  it('Duplicate saves a copy with a new id, a "(copy)" title and the same questions', async () => {
    const copy = await duplicateSet(OWN, 99);
    expect(copy.id).not.toBe(OWN);
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
    expect(await listSets()).toHaveLength(2);
  });

  it('Duplicate copies the category and difficulty', async () => {
    await db.sets.add({ ...set('tagged', 5), category: 'Science', difficulty: 'hard' });
    const copy = await duplicateSet('tagged', 99);
    expect(copy).toMatchObject({ category: 'Science', difficulty: 'hard' });
    expect(await getSet(copy.id)).toMatchObject({ category: 'Science', difficulty: 'hard' });
  });

  it('Duplicate leaves the original unchanged', async () => {
    const before = await getSet(OWN);
    await duplicateSet(OWN, 99);
    expect(await getSet(OWN)).toEqual(before);
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
    const sample = (await getSet(OWN))!;
    await saveSet({ ...sample, title: 'Renamed' }, FIRST_VISIT + 10);
    expect(await getSet(OWN)).toEqual({
      ...sample,
      title: 'Renamed',
      createdAt: FIRST_VISIT,
      updatedAt: FIRST_VISIT + 10,
    });
    expect((await listSets()).map((s) => s.id).slice(0, 2)).toEqual([OWN, 'other']);
  });
});

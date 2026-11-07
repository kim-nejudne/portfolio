import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoriesFileSchema } from '#shared/schemas.js';
import type { Category, Photo, Place } from '#shared/types.js';
import { snapshotPool } from './placePicker.js';
import {
  CategoryStore,
  CategoryStoreError,
  adminRow,
  autoDisplayName,
  loadCategoryStore,
  publishProblems,
} from './categoryStore.js';

function place(id: string, kind: Place['kind'] = 'city'): Place {
  return {
    id,
    kind,
    name: id,
    displayName: id,
    autoDisplayName: true,
    fact: 'A fact.',
    lat: 10,
    lng: 20,
    coordsSource: 'wikidata',
    wikidataId: 'Q1',
    countryId: 'Q2',
    countryName: 'Somewhere',
  };
}

function category(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    name: id,
    emoji: null,
    box: { south: 0, west: 0, north: 20, east: 30 },
    labelStyle: 'city',
    draftMeta: null,
    hidden: false,
    live: { easy: { places: [place(`${id}-a`), place(`${id}-b`)], reviewed: true, updatedAt: 1 } },
    draft: {},
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

async function dataDir(file?: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pinpoint-categories-'));
  if (file !== undefined) {
    const text = typeof file === 'string' ? file : JSON.stringify(file);
    await writeFile(join(dir, 'categories.json'), text);
  }
  return dir;
}

describe('adminRow', () => {
  it('shows a draft level over its live one, with the draft counts, and missing levels as zero', () => {
    const row = adminRow(
      category('japan', {
        emoji: '🗾',
        hidden: true,
        draft: {
          easy: { places: [place('a'), place('b', 'landmark')], reviewed: false, updatedAt: 2 },
          medium: { places: [place('c')], reviewed: true, updatedAt: 2 },
        },
      }),
    );
    expect(row).toEqual({
      id: 'japan',
      name: 'japan',
      emoji: '🗾',
      hidden: true,
      levels: {
        easy: { state: 'review', published: true, city: 1, landmark: 1 },
        medium: { state: 'draft', published: false, city: 1, landmark: 0 },
        hard: { state: 'missing', published: false, city: 0, landmark: 0 },
      },
    });
    expect(adminRow(category('x')).levels.easy).toEqual({
      state: 'live',
      published: true,
      city: 2,
      landmark: 0,
    });
  });
});

describe('loadCategoryStore', () => {
  it('loads a valid file and summarises its live categories without places', async () => {
    const japan = category('japan', {
      emoji: '🗾',
      live: {
        easy: {
          places: [place('a'), place('b'), place('c', 'landmark')],
          reviewed: true,
          updatedAt: 1,
        },
        hard: { places: [place('d')], reviewed: true, updatedAt: 1 },
      },
      draft: { medium: { places: [place('draft-1')], reviewed: false, updatedAt: 1 } },
    });
    const store = await loadCategoryStore({
      dataDir: await dataDir({ schemaVersion: 1, categories: [japan] }),
      production: true,
    });

    expect(store.summaries()).toEqual([
      {
        id: 'japan',
        name: 'japan',
        emoji: '🗾',
        box: japan.box,
        labelStyle: 'city',
        counts: { easy: { city: 2, landmark: 1 }, hard: { city: 1, landmark: 0 } },
      },
    ]);
    expect(store.get('japan')?.live.easy?.places).toHaveLength(3);
  });

  it('stops with an error naming an invalid file', async () => {
    const dir = await dataDir({ schemaVersion: 1, categories: [{ id: 'broken' }] });
    await expect(loadCategoryStore({ dataDir: dir, production: true })).rejects.toThrow(
      join(dir, 'categories.json'),
    );
    const notJson = await dataDir('{not json');
    await expect(loadCategoryStore({ dataDir: notJson, production: false })).rejects.toThrow(
      join(notJson, 'categories.json'),
    );
  });

  it('excludes hidden categories and ones with nothing live', async () => {
    const file = {
      schemaVersion: 1,
      categories: [
        category('shown'),
        category('hidden', { hidden: true }),
        category('draft-only', {
          live: {},
          draft: { easy: { places: [place('x')], reviewed: false, updatedAt: 1 } },
        }),
      ],
    };
    const store = await loadCategoryStore({ dataDir: await dataDir(file), production: false });
    expect(store.summaries().map((c) => c.id)).toEqual(['shown']);
    expect(store.get('hidden')).toBeUndefined();
    expect(store.get('draft-only')).toBeUndefined();
  });

  it('serves the dev fixture only outside production and only with no categories', async () => {
    const missing = await dataDir();
    const dev = await loadCategoryStore({ dataDir: missing, production: false });
    expect(dev.summaries().map((c) => c.name)).toEqual(['World (dev)']);
    expect(await readdir(missing)).toEqual([]); // never written to categories.json

    const empty = await dataDir({ schemaVersion: 1, categories: [] });
    expect(
      (await loadCategoryStore({ dataDir: empty, production: false })).summaries(),
    ).toHaveLength(1);
    expect((await loadCategoryStore({ dataDir: empty, production: true })).summaries()).toEqual([]);
    expect((await loadCategoryStore({ dataDir: missing, production: true })).summaries()).toEqual(
      [],
    );

    const hiddenOnly = await dataDir({
      schemaVersion: 1,
      categories: [category('h', { hidden: true })],
    });
    expect(
      (await loadCategoryStore({ dataDir: hiddenOnly, production: false })).summaries(),
    ).toEqual([]);
  });

  it('ships a fixture with 15 cities and 15 photographed landmarks per level that passes the schema', () => {
    const raw: unknown = JSON.parse(
      readFileSync(new URL('./fixtures/dev-world.json', import.meta.url), 'utf8'),
    );
    const [world] = categoriesFileSchema.parse(raw).categories;
    const photoIds = new Set<string>();
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const places = world!.live[level]!.places;
      expect(places.filter((p) => p.kind === 'city')).toHaveLength(15);
      expect(places.filter((p) => p.kind === 'landmark')).toHaveLength(15);
      for (const p of places) {
        expect(p.id).toMatch(/^dev-/);
        expect(Math.round(p.lat * 100) / 100).toBe(p.lat);
        expect(Math.round(p.lng * 100) / 100).toBe(p.lng);
        if (p.kind === 'city') continue;
        expect(p.photo).toBeDefined();
        // Random, so the photo id names neither the place nor anything about it.
        expect(p.photo!.id).toMatch(/^[\w-]{20}$/);
        photoIds.add(p.photo!.id);
      }
    }
    expect(photoIds.size).toBe(45);
  });
});

const PHOTO: Photo = {
  id: 'ph1',
  width: 1600,
  height: 1200,
  author: 'A. Author',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  commonsFile: 'File:Thing.jpg',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Thing.jpg',
};

/** A store over a real file with one category; `now` counts up from 100. */
async function fileStore(categories: Category[]) {
  const dir = await dataDir({ schemaVersion: 1, categories });
  let t = 100;
  const store = new CategoryStore(structuredClone(categories), {
    file: join(dir, 'categories.json'),
    now: () => t++,
  });
  const onDisk = async () =>
    categoriesFileSchema.parse(JSON.parse(await readFile(join(dir, 'categories.json'), 'utf8')))
      .categories;
  return { dir, store, onDisk };
}

const refused = (status: number, message: string | RegExp) =>
  expect.objectContaining({
    name: 'CategoryStoreError',
    status,
    message: expect.stringMatching(message),
  }) as unknown as CategoryStoreError;

describe('CategoryStore writes', () => {
  it('writes atomically through a temp file and leaves no temp behind', async () => {
    const { dir, store, onDisk } = await fileStore([category('japan')]);
    await store.setEmoji('japan', '🗾');
    expect((await onDisk())[0]!.emoji).toBe('🗾');
    expect(await readdir(dir)).toEqual(['categories.json']);

    // A failed write (here: the rename target is a directory) changes nothing in memory.
    const blocked = await mkdtemp(join(tmpdir(), 'pinpoint-blocked-'));
    await mkdir(join(blocked, 'categories.json'));
    const broken = new CategoryStore([category('japan')], {
      file: join(blocked, 'categories.json'),
    });
    await expect(broken.setHidden('japan', true)).rejects.toThrow();
    expect(broken.find('japan')!.hidden).toBe(false);
    expect((await readdir(blocked)).filter((n) => n.endsWith('.tmp'))).toEqual([]);
    // The queue goes on after a failure.
    await expect(store.setHidden('japan', true)).resolves.toMatchObject({ hidden: true });
  });

  it('creates a missing data directory on the first write', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pinpoint-fresh-'));
    const file = join(root, '.data', 'categories.json');
    const store = new CategoryStore([category('japan')], { file });
    await store.setEmoji('japan', '🗾');
    expect(await readdir(join(root, '.data'))).toEqual(['categories.json']);
  });

  it('runs concurrent changes in order, each seeing the last', async () => {
    const { store, onDisk } = await fileStore([category('japan')]);
    await Promise.all([
      store.setEmoji('japan', '🗾'),
      store.setHidden('japan', true),
      store.create({ name: 'Japan', emoji: null, box: category('x').box, labelStyle: 'city' }),
    ]);
    const disk = await onDisk();
    expect(disk.map((c) => c.id)).toEqual(['japan', 'japan-2']);
    expect(disk[0]).toMatchObject({ emoji: '🗾', hidden: true });
  });

  it('creates a category with a unique slug id and no levels', async () => {
    const { store } = await fileStore([category('sao-paulo')]);
    const box = { south: -25, west: -50, north: -20, east: -44 };
    const made = await store.create({ name: 'São Paulo!', emoji: null, box, labelStyle: 'city' });
    expect(made).toMatchObject({ id: 'sao-paulo-2', name: 'São Paulo!', live: {}, draft: {} });
    expect(made).toMatchObject({ draftMeta: null, hidden: false, createdAt: 100 });
    expect((await store.create({ name: '!!!', emoji: null, box, labelStyle: 'city' })).id).toBe(
      'category',
    );
  });

  it('refuses a box with a scale under 150 km and takes one at 150 km or more', async () => {
    const { store } = await fileStore([category('japan', { live: {} })]);
    // 1.3° × 1.3° near the equator: S ≈ 144.6 km.
    const small = { south: 0, west: 0, north: 1.3, east: 1.3 };
    await expect(store.updateMeta('japan', { box: small })).rejects.toEqual(
      refused(400, /too small: scale 145 km, at least 150 km/),
    );
    const ok = { south: 0, west: 0, north: 1.4, east: 1.4 };
    const saved = await store.updateMeta('japan', { box: ok });
    // No live level: the box is the category's own.
    expect(saved).toMatchObject({ box: ok, draftMeta: null });
  });

  it('puts meta changes of a live category into draftMeta until Publish', async () => {
    const { store } = await fileStore([category('japan')]);
    const box = { south: -5, west: -5, north: 25, east: 35 };
    const saved = await store.updateMeta('japan', { box });
    expect(saved.box).toEqual(category('x').box);
    expect(saved.draftMeta).toEqual({ box, labelStyle: 'city' });
    expect(store.get('japan')!.box).toEqual(category('x').box);

    const { category: live, levels } = await store.publish('japan');
    expect(levels).toBe(0);
    expect(live).toMatchObject({ box, draftMeta: null });
  });

  it('rewrites only automatic city display names on a label style change', async () => {
    const auto = { ...place('lima'), name: 'Lima', countryName: 'Peru', displayName: 'Lima' };
    const edited = {
      ...place('osaka'),
      name: 'Osaka',
      countryName: 'Japan',
      displayName: 'Ōsaka city',
      autoDisplayName: false,
    };
    const landmark = {
      ...place('tower', 'landmark'),
      name: 'Tokyo Tower',
      countryName: 'Japan',
      displayName: 'Tokyo Tower',
      photo: PHOTO,
    };
    const draft = { easy: { places: [auto, edited, landmark], reviewed: true, updatedAt: 1 } };
    const { store } = await fileStore([category('peru', { live: {}, draft })]);

    const saved = await store.updateMeta('peru', { labelStyle: 'cityCountry' });
    expect(saved.labelStyle).toBe('cityCountry');
    expect(saved.draft.easy!.places.map((p) => p.displayName)).toEqual([
      'Lima, Peru',
      'Ōsaka city',
      'Tokyo Tower',
    ]);
    const back = await store.updateMeta('peru', { labelStyle: 'city' });
    expect(back.draft.easy!.places.map((p) => p.displayName)).toEqual([
      'Lima',
      'Ōsaka city',
      'Tokyo Tower',
    ]);
  });

  it('applies a draft label style to live-only levels on Publish', async () => {
    const lima = { ...place('lima'), name: 'Lima', countryName: 'Peru', displayName: 'Lima' };
    const live = { easy: { places: [lima], reviewed: true, updatedAt: 1 } };
    const { store } = await fileStore([category('peru', { live })]);
    await store.updateMeta('peru', { labelStyle: 'cityCountry' });
    expect(store.get('peru')!.live.easy!.places[0]!.displayName).toBe('Lima');
    const { category: published } = await store.publish('peru');
    expect(published.labelStyle).toBe('cityCountry');
    expect(published.live.easy!.places[0]!.displayName).toBe('Lima, Peru');
  });

  it('builds automatic display names within 40 characters', () => {
    const p = { ...place('a'), name: 'Llanfairpwllgwyngyll', countryName: 'United Kingdom' };
    expect(autoDisplayName(p, 'cityCountry')).toBe('Llanfairpwllgwyngyll, United Kingdom');
    const long = { ...p, name: 'Santa Cruz de la Sierra', countryName: 'Bolivia (Plurinational)' };
    expect(autoDisplayName(long, 'cityCountry')).toBe('Santa Cruz de la Sierra');
    expect(autoDisplayName({ ...p, kind: 'landmark' }, 'cityCountry')).toBe(p.name);
  });

  it('edits a place in the draft, forking it from live with its reviewed mark', async () => {
    const { store, onDisk } = await fileStore([category('japan')]);
    const saved = await store.editPlace('japan', 'easy', 'japan-a', {
      fact: 'New fact.',
      lat: 5,
      lng: 6,
      displayName: 'Custom',
    });
    expect(saved.live.easy!.places[0]).toMatchObject({ fact: 'A fact.', lat: 10 });
    expect(saved.draft.easy).toMatchObject({ reviewed: true, updatedAt: 100 });
    expect(saved.draft.easy!.places[0]).toMatchObject({
      fact: 'New fact.',
      lat: 5,
      lng: 6,
      coordsSource: 'admin',
      displayName: 'Custom',
      autoDisplayName: false,
    });
    expect((await onDisk())[0]!.draft.easy!.places[0]!.fact).toBe('New fact.');

    // Renaming an automatic name follows the label style; an edited one stays.
    const renamed = await store.editPlace('japan', 'easy', 'japan-b', { name: 'Kyoto' });
    expect(renamed.draft.easy!.places[1]).toMatchObject({ name: 'Kyoto', displayName: 'Kyoto' });

    await expect(store.editPlace('japan', 'easy', 'japan-a', { lat: 50, lng: 6 })).rejects.toEqual(
      refused(400, 'The pin must stay inside the box'),
    );
    await expect(store.editPlace('japan', 'easy', 'nope', { fact: 'x' })).rejects.toEqual(
      refused(404, 'No such place'),
    );
    await expect(store.editPlace('japan', 'hard', 'japan-a', { fact: 'x' })).rejects.toEqual(
      refused(404, 'Hard has no places'),
    );
    await expect(store.editPlace('nope', 'easy', 'japan-a', { fact: 'x' })).rejects.toEqual(
      refused(404, 'No such category'),
    );
  });

  it('keeps a landmark display name equal to its name', async () => {
    const draft = {
      easy: { places: [place('tower', 'landmark')], reviewed: false, updatedAt: 1 },
    };
    const { store } = await fileStore([category('japan', { draft })]);
    const saved = await store.editPlace('japan', 'easy', 'tower', {
      name: 'Tokyo Tower',
      displayName: 'ignored',
    });
    expect(saved.draft.easy!.places[0]).toMatchObject({
      name: 'Tokyo Tower',
      displayName: 'Tokyo Tower',
    });
  });

  it('swaps a landmark photo: the pick leaves the candidates and the old photo joins them first', async () => {
    const candidate = (n: number) => ({
      commonsFile: `File:Thing ${n}.jpg`,
      thumbUrl: `https://upload.wikimedia.org/t${n}.jpg`,
      author: `Author ${n}`,
      licence: 'CC0',
      licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      width: 1600,
      height: 1200,
    });
    const tower: Place = {
      ...place('tower', 'landmark'),
      photo: {
        ...PHOTO,
        commonsThumbUrl: 'https://upload.wikimedia.org/old.jpg',
        signCheck: 'flagged',
      },
      photoCandidates: [candidate(1), candidate(2)],
    };
    const draft = { easy: { places: [tower], reviewed: true, updatedAt: 1 } };
    const { store } = await fileStore([category('japan', { draft })]);
    const next = { ...PHOTO, id: 'ph2', commonsFile: 'File:Thing 2.jpg' };
    const saved = await store.swapPhoto('japan', 'easy', 'tower', 'File:Thing 2.jpg', next);
    const swapped = saved.draft.easy!.places[0]!;
    expect(swapped.photo).toEqual(next);
    expect(swapped.photoCandidates).toEqual([
      {
        commonsFile: 'File:Thing.jpg',
        thumbUrl: 'https://upload.wikimedia.org/old.jpg',
        author: 'A. Author',
        licence: 'CC BY-SA 4.0',
        licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        width: 1600,
        height: 1200,
        namesPlace: true,
      },
      candidate(1),
    ]);
    expect(saved.draft.easy!.reviewed).toBe(true);
    // A photo with no known Commons thumbnail (`next`) is not offered again.
    const again = await store.swapPhoto('japan', 'easy', 'tower', 'File:Thing 1.jpg', PHOTO);
    expect(again.draft.easy!.places[0]!.photoCandidates!.map((c) => c.commonsFile)).toEqual([
      'File:Thing.jpg',
    ]);
    await expect(store.swapPhoto('japan', 'easy', 'tower', 'File:Nope.jpg', PHOTO)).rejects.toEqual(
      refused(404, "That photo is not one of this place's candidates"),
    );
    await expect(store.swapPhoto('japan', 'easy', 'nope', 'File:Thing.jpg', PHOTO)).rejects.toEqual(
      refused(404, 'No such place'),
    );
  });

  it('removes a place and marks levels reviewed', async () => {
    const { store } = await fileStore([category('japan')]);
    const saved = await store.removePlace('japan', 'easy', 'japan-a');
    expect(saved.draft.easy!.places.map((p) => p.id)).toEqual(['japan-b']);
    expect(saved.live.easy!.places).toHaveLength(2);
    expect((await store.setReviewed('japan', 'easy', false)).draft.easy!.reviewed).toBe(false);
    await expect(store.setReviewed('japan', 'hard', true)).rejects.toEqual(
      refused(404, 'Hard has no draft'),
    );
  });

  it('adds a place to a draft forked from live under a new id; refuses a duplicate or bad field', async () => {
    const { store, onDisk } = await fileStore([category('japan')]);
    const fresh: Omit<Place, 'id'> = { ...place('x'), wikidataId: 'Q9', name: 'Fresh' };
    const saved = await store.addPlace('japan', 'easy', fresh);
    const added = saved.draft.easy!.places[2]!;
    expect(added).toEqual({ ...fresh, id: expect.stringMatching(/^[\w-]{20}$/) });
    expect(saved.draft.easy!.reviewed).toBe(true);
    expect((await onDisk())[0]!.draft.easy!.places).toHaveLength(3);
    // Two adds of one Q-id racing past the route's check: the store refuses the second.
    await expect(store.addPlace('japan', 'easy', fresh)).rejects.toEqual(
      refused(422, 'Already in the category'),
    );
    await expect(
      store.addPlace('japan', 'easy', { ...fresh, wikidataId: 'Q10', name: 'x'.repeat(61) }),
    ).rejects.toEqual(refused(422, 'Wikidata gave this place a bad field'));
    await expect(store.addPlace('japan', 'hard', { ...fresh, wikidataId: 'Q11' })).rejects.toEqual(
      refused(404, 'Hard has no places'),
    );
    expect(store.find('japan')!.draft.easy!.places).toHaveLength(3);
  });

  it('replaces a place in a draft forked from live under the old id and position; refuses a duplicate', async () => {
    const { store, onDisk } = await fileStore([category('japan')]);
    const fresh: Omit<Place, 'id'> = { ...place('x'), wikidataId: 'Q9', name: 'Fresh' };
    const saved = await store.replacePlace('japan', 'easy', 'japan-a', fresh);
    expect(saved.draft.easy!.places).toEqual([{ ...fresh, id: 'japan-a' }, place('japan-b')]);
    expect(saved.draft.easy!.reviewed).toBe(true);
    expect((await onDisk())[0]!.draft.easy!.places[0]!.name).toBe('Fresh');
    await expect(store.replacePlace('japan', 'easy', 'japan-b', fresh)).rejects.toEqual(
      refused(422, 'Already in the category'),
    );
    await expect(store.replacePlace('japan', 'easy', 'gone', fresh)).rejects.toEqual(
      refused(404, 'No such place'),
    );
  });

  describe('publish gates', () => {
    const unreviewed = { places: [place('d1')], reviewed: false, updatedAt: 1 };

    it('refuses with nothing to publish', async () => {
      const { store } = await fileStore([category('japan')]);
      await expect(store.publish('japan')).rejects.toEqual(refused(409, 'Nothing to publish'));
    });

    it('refuses while a draft level is unreviewed, then publishes every draft at once', async () => {
      const draft = {
        medium: unreviewed,
        hard: { places: [place('d2')], reviewed: true, updatedAt: 1 },
      };
      const { store, onDisk } = await fileStore([category('japan', { draft })]);
      await expect(store.publish('japan')).rejects.toEqual(refused(409, 'Review Medium first'));
      expect(store.get('japan')!.live.medium).toBeUndefined();

      await store.setReviewed('japan', 'medium', true);
      expect(publishProblems(store.find('japan')!)).toEqual([]);
      const { category: published, levels } = await store.publish('japan');
      expect(levels).toBe(2);
      expect(Object.keys(published.live).sort()).toEqual(['easy', 'hard', 'medium']);
      expect(published.draft).toEqual({});
      expect((await onDisk())[0]!.live.hard!.places[0]!.id).toBe('d2');
    });

    it('refuses a place outside the box, also a live one under a new draft box', async () => {
      const outside = { ...place('far'), lat: 60 };
      const draft = { medium: { places: [outside], reviewed: true, updatedAt: 1 } };
      const { store } = await fileStore([category('japan', { draft })]);
      await expect(store.publish('japan')).rejects.toEqual(
        refused(409, 'far \\(Medium\\) lies outside the box'),
      );

      const other = await fileStore([category('japan')]);
      await other.store.updateMeta('japan', { box: { south: 30, west: 0, north: 50, east: 30 } });
      await expect(other.store.publish('japan')).rejects.toEqual(
        refused(409, 'japan-a \\(Easy\\) lies outside the box'),
      );
    });

    it('refuses a place without coordinates and a landmark without a photo', () => {
      const noCoords = { ...place('nowhere'), lat: Number.NaN };
      const c = category('japan', {
        draft: {
          easy: { places: [noCoords, place('tower', 'landmark')], reviewed: true, updatedAt: 1 },
        },
      });
      expect(publishProblems(c)).toEqual([
        'nowhere (Easy) has no coordinates',
        'tower (Easy) has no photo',
      ]);
      const withPhoto = structuredClone(c);
      withPhoto.draft.easy!.places = [{ ...place('tower', 'landmark'), photo: PHOTO }];
      expect(publishProblems(withPhoto)).toEqual([]);
    });
  });

  it('hides, shows, sets the emoji and deletes', async () => {
    const { store, onDisk } = await fileStore([category('japan'), category('peru')]);
    await store.setHidden('japan', true);
    expect(store.get('japan')).toBeUndefined();
    expect(store.find('japan')!.hidden).toBe(true);
    await store.setHidden('japan', false);
    expect(store.get('japan')).toBeDefined();
    expect((await store.setEmoji('japan', '🗾')).emoji).toBe('🗾');
    expect((await store.setEmoji('japan', null)).emoji).toBeNull();
    await store.remove('peru');
    expect((await onDisk()).map((c) => c.id)).toEqual(['japan']);
    await expect(store.remove('peru')).rejects.toEqual(refused(404, 'No such category'));
  });

  it("leaves a running game's snapshot alone; the next game sees the new live data", async () => {
    const { store } = await fileStore([category('japan')]);
    const running = store.get('japan')!;
    const before = structuredClone(running);
    const pool = snapshotPool(running, 'name', ['easy']);

    await store.editPlace('japan', 'easy', 'japan-a', { name: 'Renamed', lat: 1, lng: 1 });
    await store.updateMeta('japan', { box: { south: -10, west: -10, north: 25, east: 35 } });
    await store.publish('japan');
    await store.setHidden('japan', true);

    expect(running).toEqual(before);
    expect(pool.easy!.map((p) => p.name)).toEqual(['japan-a', 'japan-b']);
    await store.setHidden('japan', false);
    const next = snapshotPool(store.get('japan')!, 'name', ['easy']);
    expect(next.easy!.map((p) => p.name)).toEqual(['Renamed', 'japan-b']);
    expect(store.get('japan')!.box.south).toBe(-10);
  });

  it('never writes the dev fixture to disk', async () => {
    const dir = await dataDir();
    const dev = await loadCategoryStore({ dataDir: dir, production: false });
    await dev.setEmoji('world-dev', '🌍');
    const box = { south: 0, west: 0, north: 20, east: 30 };
    await dev.create({ name: 'Japan', emoji: null, box, labelStyle: 'city' });
    const written = categoriesFileSchema.parse(
      JSON.parse(await readFile(join(dir, 'categories.json'), 'utf8')),
    );
    expect(written.categories.map((c) => c.id)).toEqual(['japan']);
  });
});

describe('photo clean-up at start', () => {
  async function withPhotos(file: unknown, names: string[]) {
    const dir = await dataDir(file);
    await mkdir(join(dir, 'photos'));
    for (const n of names) await writeFile(join(dir, 'photos', n), 'x');
    return dir;
  }
  const files = ['ph1.webp', 'ph1-thumb.webp', 'ph2.webp', 'ph2-thumb.webp', 'draft.webp'];

  it('deletes unreferenced photo files after logging the count', async () => {
    const live = {
      easy: { places: [{ ...place('t', 'landmark'), photo: PHOTO }], reviewed: true, updatedAt: 1 },
    };
    const draft = {
      hard: {
        places: [{ ...place('u', 'landmark'), photo: { ...PHOTO, id: 'draft' } }],
        reviewed: false,
        updatedAt: 1,
      },
    };
    const dir = await withPhotos(
      { schemaVersion: 1, categories: [category('japan', { live, draft })] },
      [...files, 'notes.txt'],
    );
    const log: string[] = [];
    await loadCategoryStore({ dataDir: dir, production: true, log: (l) => log.push(l) });
    expect(log).toEqual(['Photos: deleting 2 unreferenced file(s)']);
    expect((await readdir(join(dir, 'photos'))).sort()).toEqual([
      'draft.webp',
      'notes.txt',
      'ph1-thumb.webp',
      'ph1.webp',
    ]);
  });

  it('deletes nothing when the file is missing, empty or fails to load', async () => {
    const log: string[] = [];
    const opts = { production: true, log: (l: string) => log.push(l) };
    const missing = await withPhotos(undefined, files);
    await loadCategoryStore({ dataDir: missing, ...opts });
    const empty = await withPhotos({ schemaVersion: 1, categories: [] }, files);
    await loadCategoryStore({ dataDir: empty, ...opts });
    await loadCategoryStore({ dataDir: empty, ...opts, production: false });
    const broken = await withPhotos('{not json', files);
    await expect(loadCategoryStore({ dataDir: broken, ...opts })).rejects.toThrow();
    const invalid = await withPhotos({ schemaVersion: 1, categories: [{ id: 'x' }] }, files);
    await expect(loadCategoryStore({ dataDir: invalid, ...opts })).rejects.toThrow();

    for (const dir of [missing, empty, broken, invalid]) {
      expect(await readdir(join(dir, 'photos'))).toHaveLength(files.length);
    }
    expect(log).toEqual([]);
  });
});

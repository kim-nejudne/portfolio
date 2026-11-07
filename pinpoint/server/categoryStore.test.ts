import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoriesFileSchema } from '#shared/schemas.js';
import type { Category, Place } from '#shared/types.js';
import { loadCategoryStore } from './categoryStore.js';

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

  it('ships a fixture with 15 two-decimal cities per level that passes the schema', () => {
    const raw: unknown = JSON.parse(
      readFileSync(new URL('./fixtures/dev-world.json', import.meta.url), 'utf8'),
    );
    const [world] = categoriesFileSchema.parse(raw).categories;
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const places = world!.live[level]!.places;
      expect(places).toHaveLength(15);
      for (const p of places) {
        expect(p.kind).toBe('city');
        expect(Math.round(p.lat * 100) / 100).toBe(p.lat);
        expect(Math.round(p.lng * 100) / 100).toBe(p.lng);
      }
    }
  });
});

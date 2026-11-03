// The CategoryStore (spec: Word pack format; Admin, Data volume and environment): seeding, no
// re-seed, atomic writes, validation. Each test works in its own temp DATA_DIR.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CATEGORIES_FILE,
  CategoryStoreError,
  openCategoryStore,
  openCategoryStoreForStart,
  SEED_CATEGORIES,
  seedCategories,
  type Category,
  type CategoryFs,
} from './categoryStore.js';
import { loadPacks, parsePack, type Pack } from './packs.js';

const SHIPPED = fileURLToPath(new URL('../data/packs', import.meta.url));

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sketchy-store-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function pack(id: string, rating: 'family' | 'spicy' = 'family'): Pack {
  return parsePack(
    {
      schemaVersion: 1,
      id,
      title: `Title ${id}`,
      language: 'en',
      rating,
      words: [
        { id: 'apple', word: 'apple', difficulty: 1 },
        { id: 'ice-cream', word: 'ice cream', alt: ['icecream'], difficulty: 2 },
      ],
    },
    `${id}.json`,
  );
}

function category(id: string, words: Category['words'] = []): Category {
  return { id, title: `Title ${id}`, emoji: '🎨', defaultOn: true, hidden: false, words };
}

function fileOf(dir: string): unknown {
  return JSON.parse(readFileSync(join(dir, CATEGORIES_FILE), 'utf8'));
}

const realFs: CategoryFs = {
  readFile: (path) => readFile(path, 'utf8'),
  writeFile: (path, data) => writeFile(path, data, { encoding: 'utf8', flush: true }),
  rename,
  mkdir: async () => undefined,
  remove: (path) => rm(path, { force: true }),
};

describe('seedCategories', () => {
  it('turns each pack into a category with short word ids and no rating', () => {
    const [food] = seedCategories([pack('en-food')]);
    expect(food).toEqual({
      id: 'en-food',
      title: 'Title en-food',
      emoji: '🍔',
      defaultOn: true,
      hidden: false,
      words: [
        { id: 'apple', word: 'apple', alt: [], difficulty: 1 },
        { id: 'ice-cream', word: 'ice cream', alt: ['icecream'], difficulty: 2 },
      ],
    });
    expect(food).not.toHaveProperty('rating');
    expect(food).not.toHaveProperty('language');
  });

  it('seeds the 9 shipped packs: family packs on, Spicy off, none hidden, each with its emoji', () => {
    const packs = loadPacks(SHIPPED);
    const seeded = seedCategories(packs);
    expect(seeded).toHaveLength(9);
    for (const [i, c] of seeded.entries()) {
      const p = packs[i]!;
      expect(c.id).toBe(p.id);
      expect(c.title).toBe(p.title);
      expect(c.defaultOn).toBe(p.rating === 'family');
      expect(c.hidden).toBe(false);
      expect(c.emoji).toBe(SEED_CATEGORIES[p.id]!.emoji);
      expect(c.words.map((w) => `${c.id}/${w.id}`)).toEqual(p.words.map((w) => w.id));
    }
    expect(seeded.find((c) => c.id === 'en-spicy')).toMatchObject({ defaultOn: false });
    expect(new Set(seeded.map((c) => c.emoji)).size).toBe(9);
  });

  it('gives a pack it has no entry for a default emoji, on by default', () => {
    expect(seedCategories([pack('zz-new')])[0]).toMatchObject({ emoji: '🎨', defaultOn: true });
  });
});

describe('openCategoryStore', () => {
  it('seeds a missing file from the packs, once, creating DATA_DIR', async () => {
    const dir = join(tempDir(), 'nested', 'data');
    const store = await openCategoryStore(dir, { seed: [pack('en-food'), pack('en-spicy')] });
    expect(store.seeded).toBe(true);
    expect(store.read().map((c) => c.id)).toEqual(['en-food', 'en-spicy']);
    expect(fileOf(dir)).toEqual({ version: 1, categories: store.read() });
    expect(readdirSync(dir)).toEqual([CATEGORIES_FILE]);
  });

  it('never re-seeds: a second start keeps an edited store, even with other packs', async () => {
    const dir = tempDir();
    const first = await openCategoryStore(dir, { seed: [pack('en-food')] });
    await first.update((cats) => cats.map((c) => ({ ...c, title: 'Edited', hidden: true })));

    const second = await openCategoryStore(dir, { seed: [pack('en-food'), pack('en-animals')] });
    expect(second.seeded).toBe(false);
    expect(second.read()).toEqual([expect.objectContaining({ title: 'Edited', hidden: true })]);
  });

  it('keeps an emptied store empty rather than seeding it again', async () => {
    const dir = tempDir();
    const first = await openCategoryStore(dir, { seed: [pack('en-food')] });
    await first.update(() => []);
    const second = await openCategoryStore(dir, { seed: [pack('en-food')] });
    expect(second.seeded).toBe(false);
    expect(second.read()).toEqual([]);
  });

  it('returns frozen contents', async () => {
    const store = await openCategoryStore(tempDir(), { seed: [pack('en-food')] });
    const cats = store.read();
    expect(Object.isFrozen(cats)).toBe(true);
    expect(Object.isFrozen(cats[0])).toBe(true);
    expect(Object.isFrozen(cats[0]!.words[0])).toBe(true);
  });

  it('refuses a file that is not JSON, and leaves it as it was', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, CATEGORIES_FILE), '{"version": 1, "categ');
    await expect(openCategoryStore(dir, { seed: [pack('en-food')] })).rejects.toThrow(
      /categories\.json is not valid JSON.*will not overwrite it/s,
    );
    expect(readFileSync(join(dir, CATEGORIES_FILE), 'utf8')).toBe('{"version": 1, "categ');
  });

  it('refuses a file with an invalid word, naming the field', async () => {
    const dir = tempDir();
    const bad = { version: 1, categories: [category('en-food', [])] };
    bad.categories[0]!.words = [{ id: 'x', word: 'a', alt: [], difficulty: 1 }];
    writeFileSync(join(dir, CATEGORIES_FILE), JSON.stringify(bad));
    const err = await openCategoryStore(dir, { seed: [] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CategoryStoreError);
    expect((err as Error).message).toMatch(/categories\.0\.words\.0\.word: must keep at least 3/);
  });

  it('refuses the pack rules the store shares: unknown word fields, 7 alternates, bad ids', async () => {
    const cases: unknown[] = [
      { id: 'cat', word: 'cat', alt: [], difficulty: 1, gloss: 'a pet' },
      {
        id: 'cat',
        word: 'cat',
        alt: ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg'],
        difficulty: 1,
      },
      { id: 'Cat!', word: 'cat', alt: [], difficulty: 1 },
      { id: 'cat', word: 'cat', alt: [], difficulty: 4 },
    ];
    for (const word of cases) {
      const dir = tempDir();
      writeFileSync(
        join(dir, CATEGORIES_FILE),
        JSON.stringify({ version: 1, categories: [{ ...category('c'), words: [word] }] }),
      );
      await expect(openCategoryStore(dir, { seed: [] })).rejects.toThrow(CategoryStoreError);
    }
  });

  it('refuses a category without its store fields, or with a rating', async () => {
    const noEmoji: Partial<Category> = category('c');
    delete noEmoji.emoji;
    for (const c of [
      noEmoji,
      { ...category('c'), rating: 'family' },
      { ...category('c'), emoji: '' },
    ]) {
      const dir = tempDir();
      writeFileSync(join(dir, CATEGORIES_FILE), JSON.stringify({ version: 1, categories: [c] }));
      await expect(openCategoryStore(dir, { seed: [] })).rejects.toThrow(CategoryStoreError);
    }
  });

  it('refuses duplicate category ids and duplicate word ids within a category', async () => {
    const word = { id: 'cat', word: 'cat', alt: [], difficulty: 1 as const };
    const dupCategories = { version: 1, categories: [category('c'), category('c')] };
    const dupWords = {
      version: 1,
      categories: [category('c', [word, { ...word, word: 'kitty' }])],
    };
    for (const [file, message] of [
      [dupCategories, /categories\.1\.id: duplicate category id "c"/],
      [dupWords, /categories\.0\.words\.1\.id: duplicate word id "cat"/],
    ] as const) {
      const dir = tempDir();
      writeFileSync(join(dir, CATEGORIES_FILE), JSON.stringify(file));
      await expect(openCategoryStore(dir, { seed: [] })).rejects.toThrow(message);
    }
  });

  it('allows the same word id in two categories', async () => {
    const word = { id: 'cat', word: 'cat', alt: [], difficulty: 1 as const };
    const dir = tempDir();
    writeFileSync(
      join(dir, CATEGORIES_FILE),
      JSON.stringify({ version: 1, categories: [category('a', [word]), category('b', [word])] }),
    );
    const store = await openCategoryStore(dir, { seed: [] });
    expect(store.read()).toHaveLength(2);
  });

  it('reports a DATA_DIR it cannot create or write', async () => {
    const failing: CategoryFs = {
      ...realFs,
      mkdir: () => Promise.reject(new Error('EACCES: permission denied')),
    };
    await expect(
      openCategoryStore(join(tempDir(), 'x'), { seed: [pack('en-food')], fs: failing }),
    ).rejects.toThrow(/Cannot create .*categories\.json: EACCES.*DATA_DIR is writable/);
  });
});

describe('CategoryStore.update', () => {
  it('writes the change to the file and to memory', async () => {
    const dir = tempDir();
    const store = await openCategoryStore(dir, { seed: [pack('en-food')] });
    const next = await store.update((cats) => [...cats, category('extra')]);
    expect(next.map((c) => c.id)).toEqual(['en-food', 'extra']);
    expect(store.read()).toBe(next);
    expect(fileOf(dir)).toEqual({ version: 1, categories: next });
  });

  it('refuses a change that breaks the rules, writing nothing', async () => {
    const dir = tempDir();
    const store = await openCategoryStore(dir, { seed: [pack('en-food')] });
    const before = readFileSync(join(dir, CATEGORIES_FILE), 'utf8');
    const word = { id: 'dog', word: 'dog', alt: [], difficulty: 1 as const };

    await expect(store.update((cats) => [...cats, category('en-food')])).rejects.toThrow(
      /duplicate category id "en-food"/,
    );
    await expect(
      store.update((cats) => [
        { ...cats[0]!, words: [...cats[0]!.words, { ...word, id: 'apple' }] },
      ]),
    ).rejects.toThrow(/duplicate word id "apple"/);
    await expect(
      store.update((cats) => [{ ...cats[0]!, words: [{ ...word, word: 'x'.repeat(31) }] }]),
    ).rejects.toThrow(CategoryStoreError);

    expect(readFileSync(join(dir, CATEGORIES_FILE), 'utf8')).toBe(before);
    expect(store.read().map((c) => c.words.length)).toEqual([2]);
  });

  it('a crash mid-write leaves the old file whole, memory unchanged and no temp file', async () => {
    const dir = tempDir();
    const store = await openCategoryStore(dir, { seed: [pack('en-food')] });
    const before = readFileSync(join(dir, CATEGORIES_FILE), 'utf8');

    // The process "dies" after half the bytes reach the temp file, before the rename.
    const crashing: CategoryFs = {
      ...realFs,
      writeFile: async (path, data) => {
        await writeFile(path, data.slice(0, data.length / 2));
        throw new Error('ENOSPC: no space left on device');
      },
    };
    const fragile = await openCategoryStore(dir, { seed: [], fs: crashing });
    await expect(fragile.update((cats) => [...cats, category('extra')])).rejects.toThrow(/ENOSPC/);

    expect(readFileSync(join(dir, CATEGORIES_FILE), 'utf8')).toBe(before);
    expect(fragile.read().map((c) => c.id)).toEqual(['en-food']);
    expect(readdirSync(dir)).toEqual([CATEGORIES_FILE]);
    // The untouched file still opens.
    expect((await openCategoryStore(dir, { seed: [] })).read()).toEqual(store.read());
  });

  it('a failed rename leaves the old file too', async () => {
    const dir = tempDir();
    const before = (await openCategoryStore(dir, { seed: [pack('en-food')] })).read();
    const failing: CategoryFs = {
      ...realFs,
      rename: () => Promise.reject(new Error('EXDEV')),
    };
    const store = await openCategoryStore(dir, { seed: [], fs: failing });
    await expect(store.update(() => [])).rejects.toThrow(/EXDEV/);
    expect(fileOf(dir)).toEqual({ version: 1, categories: before });
    expect(readdirSync(dir)).toEqual([CATEGORIES_FILE]);
  });

  it('runs updates one at a time, in call order, and a failure does not block the next', async () => {
    const dir = tempDir();
    const store = await openCategoryStore(dir, { seed: [] });
    const a = store.update((cats) => [...cats, category('a')]);
    const bad = store.update((cats) => [...cats, category('a')]);
    const b = store.update((cats) => [...cats, category('b')]);
    await a;
    await expect(bad).rejects.toThrow(CategoryStoreError);
    await b;
    expect(store.read().map((c) => c.id)).toEqual(['a', 'b']);
    expect(fileOf(dir)).toEqual({ version: 1, categories: store.read() });
  });
});

describe('openCategoryStoreForStart', () => {
  it('seeds and says so', async () => {
    const dir = tempDir();
    const result = await openCategoryStoreForStart(dir, [pack('en-food'), pack('en-animals')]);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.summary).toBe(
      `Seeded ${join(dir, CATEGORIES_FILE)} from 2 word packs: 2 categories (4 words)`,
    );
    const again = await openCategoryStoreForStart(dir, [pack('en-food')]);
    expect(again).toMatchObject({
      ok: true,
      summary: `Loaded ${join(dir, CATEGORIES_FILE)}: 2 categories (4 words)`,
    });
  });

  it('turns a malformed file into the message the server prints before exit 1', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, CATEGORIES_FILE), '[]');
    const result = await openCategoryStoreForStart(dir, [pack('en-food')]);
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.message).toMatch(/^Sketchy can't start\.\n.*categories\.json is not a valid/);
  });
});

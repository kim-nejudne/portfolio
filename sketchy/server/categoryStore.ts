// The CategoryStore (spec: Word pack format; Admin, Data volume and environment): every word
// category, with its words, in one JSON file in DATA_DIR. Ported from Buzzr's
// server/builtInStore.ts. Seeded once from the repo's packs (`data/packs/`) when the file is
// missing; after that the file is the only truth, and a malformed one stops the server rather than
// being replaced. Server state only: no word or alternate leaves the server from here.
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { CATEGORY_EMOJI_MAX } from '../shared/constants.js';
import {
  packIdSchema,
  packTitleSchema,
  packWordSchema,
  refineUniqueWordIds,
  type Pack,
} from './packs.js';

export const CATEGORIES_FILE = 'categories.json';

/**
 * The stored emoji is only held to "one short string": an emoji a newer Unicode accepted must
 * never stop the server. The admin's editor checks for a single emoji when it saves (F81).
 */
const storedEmojiSchema = z
  .string()
  .trim()
  .refine((s) => s.length >= 1 && s.length <= CATEGORY_EMOJI_MAX, {
    message: `must be one emoji (1–${CATEGORY_EMOJI_MAX} characters)`,
  });

/**
 * A category: a pack's `id`, `title` and `words` (every category is English, so no `language`;
 * pack `rating` is gone), plus `emoji`, `defaultOn` and `hidden`. Words follow the pack schema
 * itself. A category may be empty, as one just made in the admin is; Start counts words anyway.
 */
export const categorySchema = z
  .strictObject({
    id: packIdSchema,
    title: packTitleSchema,
    emoji: storedEmojiSchema,
    defaultOn: z.boolean(),
    hidden: z.boolean(),
    words: z.array(packWordSchema),
  })
  .superRefine(refineUniqueWordIds);

export const categoriesFileSchema = z
  .strictObject({
    version: z.literal(1),
    categories: z.array(categorySchema),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.categories.forEach((c, i) => {
      if (seen.has(c.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['categories', i, 'id'],
          message: `duplicate category id ${JSON.stringify(c.id)}`,
        });
      }
      seen.add(c.id);
    });
  });

export type Category = z.output<typeof categorySchema>;
export type CategoryWord = Category['words'][number];

/**
 * What each repo pack seeds: its emoji, and whether new rooms start with it ticked. Every family
 * pack is on; Spicy is off (spec: Word pack format).
 */
export const SEED_CATEGORIES: Readonly<Record<string, { emoji: string; defaultOn: boolean }>> = {
  'en-actions': { emoji: '🏃', defaultOn: true },
  'en-animals': { emoji: '🐾', defaultOn: true },
  'en-everyday': { emoji: '🔑', defaultOn: true },
  'en-food': { emoji: '🍔', defaultOn: true },
  'en-home': { emoji: '🏠', defaultOn: true },
  'en-jobs': { emoji: '👷', defaultOn: true },
  'en-outdoors': { emoji: '🌳', defaultOn: true },
  'en-spicy': { emoji: '🌶️', defaultOn: false },
  'en-sports': { emoji: '⚽', defaultOn: true },
};
const SEED_DEFAULT = { emoji: '🎨', defaultOn: true };

/** The categories a missing file is seeded with: one per pack, in pack order, none hidden. */
export function seedCategories(packs: readonly Pack[]): Category[] {
  return packs.map((pack) => {
    const { emoji, defaultOn } = SEED_CATEGORIES[pack.id] ?? SEED_DEFAULT;
    return {
      id: pack.id,
      title: pack.title,
      emoji,
      defaultOn,
      hidden: false,
      words: pack.words.map((w) => ({
        // A loaded pack's word ids are full (`en-food/doughnut`); the store keeps the short one.
        id: w.id.slice(pack.id.length + 1),
        word: w.word,
        alt: [...w.alt],
        difficulty: w.difficulty,
      })),
    };
  });
}

/** A store file or change that can't be used. The message names the file and the field. */
export class CategoryStoreError extends Error {
  override name = 'CategoryStoreError';
}

/** The file system calls the store makes. Tests swap one to fail or crash a write. */
export interface CategoryFs {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, data: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  mkdir: (path: string) => Promise<unknown>;
  /** Removes a file, and does nothing when it is missing. */
  remove: (path: string) => Promise<void>;
}

const nodeFs: CategoryFs = {
  readFile: (path) => readFile(path, 'utf8'),
  // `flush` fsyncs the bytes before the rename makes them the file.
  writeFile: (path, data) => writeFile(path, data, { encoding: 'utf8', flush: true }),
  rename,
  mkdir: (path) => mkdir(path, { recursive: true }),
  remove: (path) => rm(path, { force: true }),
};

export interface CategoryStore {
  /** `DATA_DIR/categories.json`. */
  readonly path: string;
  /** Whether this start created the file from the seed packs. */
  readonly seeded: boolean;
  /** The current categories, frozen. Change them through `update`. */
  read(): readonly Category[];
  /**
   * Runs `change` on the current categories, checks the result with the file schema and writes
   * it. Updates run one at a time, in call order, each seeing the one before. A refused change
   * or a failed write rejects and leaves file and memory as they were.
   */
  update(
    change: (categories: readonly Category[]) => readonly Category[],
  ): Promise<readonly Category[]>;
}

export interface OpenCategoryStoreOptions {
  /** The packs a missing file is seeded with. */
  seed: readonly Pack[];
  fs?: CategoryFs;
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === 'ENOENT';
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Checks the whole file; returns its categories, frozen, or throws with one line per problem. */
function check(raw: unknown, intro: string): readonly Category[] {
  const result = categoriesFileSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      const where = issue.path.length > 0 ? issue.path.join('.') : '(file)';
      return `  ${where}: ${issue.message}`;
    });
    throw new CategoryStoreError([intro, ...lines].join('\n'));
  }
  return deepFreeze(result.data.categories);
}

/**
 * Opens `<dir>/categories.json`, creating `dir` and seeding the file from `seed` when it is
 * missing. Rejects with a `CategoryStoreError` naming the file when it can't be read, isn't JSON
 * or isn't a valid store, and never writes over it.
 */
export async function openCategoryStore(
  dir: string,
  { seed, fs = nodeFs }: OpenCategoryStoreOptions,
): Promise<CategoryStore> {
  const path = join(dir, CATEGORIES_FILE);
  let temps = 0;

  // Write beside the file, then rename over it: a crash mid-write leaves the old file whole.
  async function save(categories: readonly Category[]): Promise<void> {
    const temp = `${path}.${process.pid}-${++temps}.tmp`;
    try {
      await fs.writeFile(temp, `${JSON.stringify({ version: 1, categories }, null, 2)}\n`);
      await fs.rename(temp, path);
    } catch (err) {
      // No stray temp file; the write's own error is the one to report.
      await fs.remove(temp).catch(() => undefined);
      throw err;
    }
  }

  let text: string | undefined;
  try {
    text = await fs.readFile(path);
  } catch (err) {
    if (!isMissing(err)) {
      throw new CategoryStoreError(`Cannot read ${path}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  let current: readonly Category[];
  const seeded = text === undefined;
  if (text === undefined) {
    current = check(
      { version: 1, categories: seedCategories(seed) },
      `The seed packs are not valid categories:`,
    );
    try {
      await fs.mkdir(dir);
      await save(current);
    } catch (err) {
      throw new CategoryStoreError(
        `Cannot create ${path}: ${(err as Error).message}. Check that DATA_DIR is writable.`,
        { cause: err },
      );
    }
  } else {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new CategoryStoreError(
        `${path} is not valid JSON (${(err as Error).message}). Restore it from a backup; the server will not overwrite it.`,
        { cause: err },
      );
    }
    current = check(
      json,
      `${path} is not a valid categories file (restore it from a backup; the server will not overwrite it):`,
    );
  }

  let queue: Promise<unknown> = Promise.resolve();

  return {
    path,
    seeded,
    read: () => current,
    update(change) {
      const run = queue.then(async () => {
        const next = check({ version: 1, categories: change(current) }, 'Change refused:');
        await save(next);
        current = next;
        return next;
      });
      // A failed update must not block the ones queued behind it.
      queue = run.catch(() => undefined);
      return run;
    },
  };
}

/**
 * What the server does at start: the store and a one-line summary, or the message it prints
 * before exiting. Errors other than `CategoryStoreError` are bugs and still throw.
 */
export async function openCategoryStoreForStart(
  dir: string,
  seed: readonly Pack[],
): Promise<{ ok: true; store: CategoryStore; summary: string } | { ok: false; message: string }> {
  try {
    const store = await openCategoryStore(dir, { seed });
    const categories = store.read();
    const words = categories.reduce((n, c) => n + c.words.length, 0);
    const counts = `${categories.length} categories (${words} words)`;
    const summary = store.seeded
      ? `Seeded ${store.path} from ${seed.length} word packs: ${counts}`
      : `Loaded ${store.path}: ${counts}`;
    return { ok: true, store, summary };
  } catch (err) {
    if (!(err instanceof CategoryStoreError)) throw err;
    return { ok: false, message: `Sketchy can't start.\n${err.message}` };
  }
}

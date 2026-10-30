// The server's built-in sets (M26): one JSON file in DATA_DIR holding the live sets, the admin's
// drafts and whether the bundled sample is hidden. Seeded once from the 60 starters when the file
// is missing; after that the file is the only truth, and a corrupt one stops the server rather
// than being replaced (DECISIONS F103).

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { SAMPLE_SET_ID } from '../shared/sampleSet.js';
import { idSchema, questionSetSchema } from '../shared/schemas.js';
import { STARTER_SETS } from '../shared/starterSets/index.js';
import type { QuestionSet } from '../shared/types.js';

export const BUILT_IN_FILE = 'built-in-sets.json';

/** The file's shape. Drafts are checked loosely until F107 gives them their own schema. */
export const builtInFileSchema = z.object({
  version: z.literal(1),
  sets: z
    .array(questionSetSchema)
    .refine((sets) => new Set(sets.map((s) => s.id)).size === sets.length, {
      message: 'Set ids must be unique',
    })
    // Server built-ins are text only: their pictures would have nowhere to live.
    .refine((sets) => sets.every((s) => s.questions.every((q) => q.imageId === undefined)), {
      message: 'Built-in sets cannot have pictures',
    })
    // The bundled sample's pictures are found by its id, and the Built-in tab reads "the sample is
    // listed" as "the sample is shown" (F106), so no server set may take it.
    .refine((sets) => sets.every((s) => s.id !== SAMPLE_SET_ID), {
      message: "No built-in set may take the bundled sample's id",
    }),
  drafts: z.record(idSchema, z.unknown()),
  sampleHidden: z.boolean(),
});

export interface BuiltInData {
  version: 1;
  sets: QuestionSet[];
  drafts: Record<string, unknown>;
  sampleHidden: boolean;
}

/** The file system calls the store makes. Tests swap one to fail or stall a write. */
export interface BuiltInFs {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, data: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  mkdir: (path: string) => Promise<unknown>;
  /** Removes a file, and does nothing when it is missing. */
  remove: (path: string) => Promise<void>;
}

const nodeFs: BuiltInFs = {
  readFile: (path) => readFile(path, 'utf8'),
  // `flush` syncs the bytes to disk before the rename makes them the file.
  writeFile: (path, data) => writeFile(path, data, { encoding: 'utf8', flush: true }),
  rename,
  mkdir: (path) => mkdir(path, { recursive: true }),
  remove: (path) => rm(path, { force: true }),
};

export interface BuiltInStore {
  /** The current contents. Treat as read-only; change them through `update`. */
  read(): BuiltInData;
  /**
   * Runs `change` on the current contents and writes the result. Updates run one at a time, in
   * call order, each seeing the one before. A failed write rejects and leaves file and memory as
   * they were.
   */
  update(change: (data: BuiltInData) => BuiltInData): Promise<BuiltInData>;
}

export interface OpenBuiltInStoreOptions {
  /** The sets a missing file is seeded with. Defaults to the 60 starters. */
  seed?: readonly QuestionSet[];
  fs?: BuiltInFs;
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === 'ENOENT';
}

/**
 * Opens `<dir>/built-in-sets.json`, creating the directory and seeding the file when it is
 * missing. Rejects with a message naming the file when it is not valid JSON or not a valid built-in
 * file, and never writes over it.
 */
export async function openBuiltInStore(
  dir: string,
  { seed = STARTER_SETS, fs = nodeFs }: OpenBuiltInStoreOptions = {},
): Promise<BuiltInStore> {
  const path = join(dir, BUILT_IN_FILE);
  let temps = 0;

  // Write beside the file, then rename over it: a crash mid-write leaves the old file whole.
  async function save(data: BuiltInData): Promise<void> {
    const temp = `${path}.${process.pid}-${++temps}.tmp`;
    try {
      await fs.writeFile(temp, `${JSON.stringify(data, null, 2)}\n`);
      await fs.rename(temp, path);
    } catch (err) {
      // A failed write leaves no stray temp file; the write's own error is the one to report.
      await fs.remove(temp).catch(() => undefined);
      throw err;
    }
  }

  let current: BuiltInData;
  let text: string | undefined;
  try {
    text = await fs.readFile(path);
  } catch (err) {
    if (!isMissing(err)) {
      throw new Error(`Cannot read ${path}: ${(err as Error).message}`, { cause: err });
    }
  }

  if (text === undefined) {
    current = { version: 1, sets: [...seed], drafts: {}, sampleHidden: false };
    try {
      await fs.mkdir(dir);
      await save(current);
    } catch (err) {
      throw new Error(
        `Cannot create ${path}: ${(err as Error).message}. Check that DATA_DIR is writable.`,
        { cause: err },
      );
    }
  } else {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new Error(
        `${path} is not valid JSON (${(err as Error).message}). Restore it from a backup; the server will not overwrite it.`,
        { cause: err },
      );
    }
    const parsed = builtInFileSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `${path} is not a valid built-in sets file:\n${z.prettifyError(parsed.error)}\nRestore it from a backup; the server will not overwrite it.`,
      );
    }
    current = parsed.data;
  }

  let queue: Promise<unknown> = Promise.resolve();

  return {
    read: () => current,
    update(change) {
      const run = queue.then(async () => {
        const next = change(current);
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

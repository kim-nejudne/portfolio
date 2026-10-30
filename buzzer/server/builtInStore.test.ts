import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_SET_ID } from '../shared/sampleSet.js';
import { STARTER_SETS } from '../shared/starterSets/index.js';
import { BUILT_IN_FILE, openBuiltInStore, type BuiltInFs } from './builtInStore.js';
import { makeSet } from './test/rooms.js';

let dir: string;
let path: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'buzzr-builtins-'));
  path = join(dir, BUILT_IN_FILE);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function onDisk(): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

const realFs: BuiltInFs = {
  readFile: (p) => readFile(p, 'utf8'),
  writeFile: (p, data) => writeFile(p, data),
  rename,
  mkdir: async () => undefined,
  remove: (p) => rm(p, { force: true }),
};

describe('openBuiltInStore', () => {
  it('seeds a missing file once from the 60 starters, with no drafts and the sample shown', async () => {
    const store = await openBuiltInStore(dir);
    expect(store.read()).toEqual({
      version: 1,
      sets: STARTER_SETS,
      drafts: {},
      sampleHidden: false,
    });
    expect(store.read().sets).toHaveLength(60);
    expect(await onDisk()).toEqual(store.read());
  });

  it('reopens the seeded file on the next boot, so the starters pass the file schema', async () => {
    await openBuiltInStore(dir);
    const before = await readFile(path, 'utf8');
    const next = await openBuiltInStore(dir, { seed: [] });
    expect(next.read().sets).toEqual(STARTER_SETS);
    expect(await readFile(path, 'utf8')).toBe(before);
  });

  it('creates DATA_DIR when it does not exist', async () => {
    const nested = join(dir, 'a', 'b');
    const store = await openBuiltInStore(nested, { seed: [makeSet()] });
    expect(store.read().sets.map((s) => s.id)).toEqual(['set1']);
    expect(JSON.parse(await readFile(join(nested, BUILT_IN_FILE), 'utf8'))).toEqual(store.read());
  });

  it('never reseeds a file that exists, even with every set deleted', async () => {
    const first = await openBuiltInStore(dir);
    await first.update((data) => ({ ...data, sets: [], sampleHidden: true }));

    const second = await openBuiltInStore(dir);
    expect(second.read()).toEqual({ version: 1, sets: [], drafts: {}, sampleHidden: true });
    expect(await onDisk()).toEqual(second.read());
  });

  it('loads the sets, drafts and sampleHidden a later boot finds', async () => {
    const set = makeSet();
    const data = { version: 1, sets: [set], drafts: { set1: { title: '' } }, sampleHidden: true };
    await writeFile(path, JSON.stringify(data));
    const store = await openBuiltInStore(dir);
    expect(store.read()).toEqual(data);
  });

  it('refuses a file that is not JSON, naming it, and leaves it untouched', async () => {
    await writeFile(path, '{"version": 1, "sets": [');
    await expect(openBuiltInStore(dir)).rejects.toThrow(
      new RegExp(`${BUILT_IN_FILE} is not valid JSON`),
    );
    expect(await readFile(path, 'utf8')).toBe('{"version": 1, "sets": [');
    expect(await readdir(dir)).toEqual([BUILT_IN_FILE]);
  });

  it('refuses a file that is not a valid built-in file, naming the problem', async () => {
    const cases: [unknown, RegExp][] = [
      [{ version: 2, sets: [], drafts: {}, sampleHidden: false }, /version/],
      [{ version: 1, drafts: {}, sampleHidden: false }, /sets/],
      [{ version: 1, sets: [{ id: 'x' }], drafts: {}, sampleHidden: false }, /sets/],
      [{ version: 1, sets: [makeSet(), makeSet()], drafts: {}, sampleHidden: false }, /unique/],
      [{ version: 1, sets: [], drafts: { 'bad id': {} }, sampleHidden: false }, /drafts/],
      [{ version: 1, sets: [], drafts: {}, sampleHidden: 'no' }, /sampleHidden/],
      [[], /expected object/],
    ];
    for (const [data, message] of cases) {
      const text = JSON.stringify(data);
      await writeFile(path, text);
      const opening = openBuiltInStore(dir);
      await expect(opening).rejects.toThrow(/is not a valid built-in sets file/);
      await expect(opening).rejects.toThrow(message);
      expect(await readFile(path, 'utf8')).toBe(text);
    }
  });

  it('refuses a set with a picture', async () => {
    const set = makeSet();
    set.questions[0]!.imageId = 'img1';
    await writeFile(
      path,
      JSON.stringify({ version: 1, sets: [set], drafts: {}, sampleHidden: false }),
    );
    await expect(openBuiltInStore(dir)).rejects.toThrow(/cannot have pictures/);
  });

  it("refuses a set with the bundled sample's id (F106)", async () => {
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        sets: [{ ...makeSet(), id: SAMPLE_SET_ID }],
        drafts: {},
        sampleHidden: false,
      }),
    );
    await expect(openBuiltInStore(dir)).rejects.toThrow(/bundled sample's id/);
  });

  it('reports a DATA_DIR it cannot write', async () => {
    const fs: BuiltInFs = {
      ...realFs,
      readFile: () => Promise.reject(Object.assign(new Error('nope'), { code: 'ENOENT' })),
      writeFile: () => Promise.reject(new Error('EACCES: permission denied')),
    };
    await expect(openBuiltInStore(dir, { fs })).rejects.toThrow(
      /Cannot create .*built-in-sets\.json: EACCES.*DATA_DIR is writable/,
    );
  });

  it('reports a file it cannot read, rather than reseeding it', async () => {
    const fs: BuiltInFs = {
      ...realFs,
      readFile: () => Promise.reject(Object.assign(new Error('EACCES'), { code: 'EACCES' })),
      writeFile: () => Promise.reject(new Error('must not write')),
    };
    await expect(openBuiltInStore(dir, { fs })).rejects.toThrow(/Cannot read .*built-in-sets/);
  });
});

describe('BuiltInStore.update', () => {
  it('writes the change to disk and leaves no temp file', async () => {
    const store = await openBuiltInStore(dir, { seed: [makeSet()] });
    const next = await store.update((data) => ({ ...data, sampleHidden: true }));
    expect(next.sampleHidden).toBe(true);
    expect(store.read()).toBe(next);
    expect(await onDisk()).toEqual(next);
    expect(await readdir(dir)).toEqual([BUILT_IN_FILE]);
  });

  it('writes a temp file, then renames it over the file', async () => {
    const calls: string[] = [];
    const fs: BuiltInFs = {
      ...realFs,
      writeFile: async (p, data) => {
        calls.push(`write ${p.slice(dir.length + 1)}`);
        await writeFile(p, data);
      },
      rename: async (from, to) => {
        calls.push(`rename ${from.slice(dir.length + 1)} ${to.slice(dir.length + 1)}`);
        await rename(from, to);
      },
    };
    await openBuiltInStore(dir, { seed: [], fs });
    expect(calls).toHaveLength(2);
    const temp = calls[0]!.slice('write '.length);
    expect(temp).toMatch(/^built-in-sets\.json\..+\.tmp$/);
    expect(calls[1]).toBe(`rename ${temp} ${BUILT_IN_FILE}`);
  });

  it('keeps the old file and the old contents when a write fails', async () => {
    const store = await openBuiltInStore(dir, { seed: [makeSet()] });
    const before = await readFile(path, 'utf8');
    const failing = await openBuiltInStore(dir, {
      fs: { ...realFs, rename: () => Promise.reject(new Error('disk full')) },
    });

    await expect(failing.update((data) => ({ ...data, sets: [] }))).rejects.toThrow('disk full');
    expect(failing.read().sets).toHaveLength(1);
    expect(await readFile(path, 'utf8')).toBe(before);
    expect(store.read().sets).toHaveLength(1);
    expect(await readdir(dir)).toEqual([BUILT_IN_FILE]);
  });

  it('runs updates one at a time, each seeing the one before', async () => {
    // Each write waits until the test releases it, so a second write starting early is seen.
    let started = 0;
    const releases: (() => void)[] = [];
    let gated = false;
    const fs: BuiltInFs = {
      ...realFs,
      writeFile: async (p, data) => {
        if (gated) {
          started += 1;
          await new Promise<void>((resolve) => releases.push(resolve));
        }
        await writeFile(p, data);
      },
    };
    const store = await openBuiltInStore(dir, { seed: [], fs });
    gated = true;
    const sets = [1, 2, 3, 4, 5].map((n) => ({ ...makeSet(1), id: `set${n}` }));
    const updates = sets.map((set) =>
      store.update((data) => ({ ...data, sets: [...data.sets, set] })),
    );

    for (let n = 1; n <= 5; n++) {
      await vi.waitFor(() => expect(releases).toHaveLength(n));
      expect(started).toBe(n);
      releases[n - 1]!();
    }
    const results = await Promise.all(updates);

    expect(results.map((r) => r.sets.length)).toEqual([1, 2, 3, 4, 5]);
    expect(store.read().sets.map((s) => s.id)).toEqual(['set1', 'set2', 'set3', 'set4', 'set5']);
    expect(await onDisk()).toEqual(store.read());
  });

  it('carries on after a failed update', async () => {
    const store = await openBuiltInStore(dir, { seed: [] });
    const failed = store.update(() => {
      throw new Error('bad change');
    });
    const next = store.update((data) => ({ ...data, sampleHidden: true }));
    await expect(failed).rejects.toThrow('bad change');
    await expect(next).resolves.toMatchObject({ sampleHidden: true });
    expect(await onDisk()).toMatchObject({ sampleHidden: true });
  });
});

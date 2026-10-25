// The lib loader behind `openProject` (§2 Compiler assets and options, §12 F2 criterion 2):
// following `/// <reference lib>` directives from lib.es2025.d.ts fetches exactly the chain
// the compiler resolves (76 files, pinned by scripts/copy-ts-libs.test.ts) and nothing from
// dom, webworker or scripthost; a file already held is never fetched again; dom is one more
// file, once; concurrent loads share fetches; a failed fetch leaves nothing half-loaded.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  libFileName,
  libPath,
  loadLibs,
  parseLibReferences,
  type FetchLib,
} from './libs';
import { countingFetchLib, nodeFetchLib, TS_LIB_DIR } from './node/fetch-lib';

/** The chain on disk, walked independently of the module under test. */
function chainOnDisk(start: string): string[] {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const name = stack.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    const text = readFileSync(path.join(TS_LIB_DIR, name), 'utf8');
    for (const match of text.matchAll(
      /\/\/\/\s*<reference\s+lib="([^"]+)"\s*\/>/g,
    )) {
      stack.push(`lib.${match[1] as string}.d.ts`);
    }
  }
  return [...seen].sort();
}

const ES2025_CHAIN = chainOnDisk('lib.es2025.d.ts');

describe('lib names', () => {
  it('maps a lib name to its file and keeps a file name', () => {
    expect(libFileName('es2025')).toBe('lib.es2025.d.ts');
    expect(libFileName('DOM')).toBe('lib.dom.d.ts');
    expect(libFileName('lib.dom.iterable.d.ts')).toBe('lib.dom.iterable.d.ts');
    expect(libPath('lib.es5.d.ts')).toBe('/lib.es5.d.ts');
  });

  it('parses the reference directives of a lib file', () => {
    expect(
      parseLibReferences(
        readFileSync(path.join(TS_LIB_DIR, 'lib.es2025.d.ts'), 'utf8'),
      ),
    ).toEqual([
      'lib.es2024.d.ts',
      'lib.es2025.collection.d.ts',
      'lib.es2025.float16.d.ts',
      'lib.es2025.intl.d.ts',
      'lib.es2025.iterator.d.ts',
      'lib.es2025.promise.d.ts',
      'lib.es2025.regexp.d.ts',
    ]);
    expect(parseLibReferences('declare var x: number;')).toEqual([]);
  });
});

describe('loadLibs (§12 F2: openProject fetches only what the lib set needs)', () => {
  it('lib.es2025.d.ts fetches exactly its 76-file chain: ES files and the two decorators files, nothing from dom, webworker or scripthost', async () => {
    const files = new Map<string, string>();
    const { fetchLib, fetched } = countingFetchLib();
    const result = await loadLibs(['lib.es2025.d.ts'], files, fetchLib);

    expect([...result].sort()).toEqual(ES2025_CHAIN);
    expect(result).toHaveLength(76);
    expect(new Set(fetched).size, 'no file fetched twice').toBe(fetched.length);
    expect(fetched.sort()).toEqual(ES2025_CHAIN);
    for (const name of result) {
      expect(name).toMatch(
        /^lib\.(es[0-9a-z.]+|decorators(\.legacy)?)\.d\.ts$/,
      );
      expect(name).not.toMatch(/dom|webworker|scripthost/);
      expect(files.get(libPath(name))).toBe(
        readFileSync(path.join(TS_LIB_DIR, name), 'utf8'),
      );
    }
    expect(files.size).toBe(76);
  });

  it('a second load of the same set fetches nothing; adding dom fetches lib.dom.d.ts once and nothing else; a third load fetches nothing', async () => {
    const files = new Map<string, string>();
    const { fetchLib, fetched } = countingFetchLib();
    await loadLibs(['lib.es2025.d.ts'], files, fetchLib);
    const before = fetched.length;

    expect(await loadLibs(['lib.es2025.d.ts'], files, fetchLib)).toEqual([]);
    expect(fetched).toHaveLength(before);

    expect(
      await loadLibs(['lib.es2025.d.ts', 'lib.dom.d.ts'], files, fetchLib),
    ).toEqual(['lib.dom.d.ts']);
    expect(fetched.filter((name) => name === 'lib.dom.d.ts')).toHaveLength(1);
    expect(files.size).toBe(77);

    expect(
      await loadLibs(['lib.es2025.d.ts', 'lib.dom.d.ts'], files, fetchLib),
    ).toEqual([]);
    expect(fetched).toHaveLength(before + 1);
  });

  it('concurrent loads that share the in-flight map fetch every file once', async () => {
    const files = new Map<string, string>();
    const inFlight = new Map<string, Promise<void>>();
    const { fetchLib, fetched } = countingFetchLib();
    await Promise.all([
      loadLibs(['lib.es2025.d.ts'], files, fetchLib, inFlight),
      loadLibs(['lib.es2024.d.ts'], files, fetchLib, inFlight),
      loadLibs(['lib.es5.d.ts'], files, fetchLib, inFlight),
    ]);
    expect(fetched.sort()).toEqual(ES2025_CHAIN);
    expect(inFlight.size).toBe(0);
  });

  it('a failed fetch rejects, holds back the file whose references failed, and a retry completes the chain', async () => {
    const files = new Map<string, string>();
    let failOnce = true;
    const flaky: FetchLib = (name) => {
      if (name === 'lib.es5.d.ts' && failOnce) {
        failOnce = false;
        return Promise.reject(new Error('HTTP 503'));
      }
      return nodeFetchLib(name);
    };
    await expect(loadLibs(['lib.es2025.d.ts'], files, flaky)).rejects.toThrow(
      'HTTP 503',
    );
    expect(files.has('/lib.es2015.d.ts'), 'es2015 references es5').toBe(false);
    expect(files.has('/lib.es2025.d.ts')).toBe(false);

    await loadLibs(['lib.es2025.d.ts'], files, flaky);
    expect([...files.keys()].sort()).toEqual(
      ES2025_CHAIN.map((name) => libPath(name)),
    );
  });
});

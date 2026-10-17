// Proves §12 Prep: public/ts/6.0.3/ holds every lib.*.d.ts from typescript@6.0.3, and pins
// the §2 sizes and the knownLibFilesForCompilerOptions finding recorded in docs/progress.md.
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { knownLibFilesForCompilerOptions } from '@typescript/vfs';
import { describe, expect, it } from 'vitest';
import {
  copyTsLibs,
  isLibFile,
  libTarget,
  TS_LIB_DIR,
  typescriptVersion,
} from './copy-ts-libs.ts';

const source = readdirSync(TS_LIB_DIR).filter(isLibFile).sort();
const size = (name: string): number =>
  statSync(path.join(TS_LIB_DIR, name)).size;
const sum = (names: string[]): number =>
  names.reduce((total, name) => total + size(name), 0);

/** Every lib file the compiler resolves from `start` by following /// <reference lib="..." /> directives. */
function referenceChain(start: string): string[] {
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
      stack.push(`lib.${match[1]}.d.ts`);
    }
  }
  return [...seen].sort();
}

describe('scripts/copy-ts-libs.ts', () => {
  it('copies from typescript 6.0.3, the version spec §2 pins', () => {
    expect(typescriptVersion()).toBe('6.0.3');
    expect(source).toHaveLength(107);
  });

  it('copies every lib.*.d.ts byte for byte into a directory and removes stale lib files there', () => {
    const to = mkdtempSync(path.join(tmpdir(), 'ts-dojo-libs-'));
    try {
      writeFileSync(path.join(to, 'lib.stale.d.ts'), 'stale');
      writeFileSync(path.join(to, 'notes.txt'), 'kept: not a lib file');
      const result = copyTsLibs({ to });
      expect(result.files.map((file) => file.name)).toEqual(source);
      expect(result.removed).toEqual(['lib.stale.d.ts']);
      expect(result.total).toBe(sum(source));
      expect(readdirSync(to).sort()).toEqual([...source, 'notes.txt'].sort());
      for (const name of source) {
        expect(
          readFileSync(path.join(to, name)).equals(
            readFileSync(path.join(TS_LIB_DIR, name)),
          ),
        ).toBe(true);
      }
    } finally {
      rmSync(to, { recursive: true, force: true });
    }
  });

  it('public/ts/6.0.3/ holds every lib.*.d.ts from typescript@6.0.3 and nothing else (§12 Prep)', () => {
    const target = libTarget();
    expect(target).toBe(
      path.resolve(import.meta.dirname, '..', 'public', 'ts', '6.0.3'),
    );
    copyTsLibs({ to: target });
    expect(readdirSync(target).sort()).toEqual(source);
    for (const name of source) {
      expect(
        readFileSync(path.join(target, name)).equals(
          readFileSync(path.join(TS_LIB_DIR, name)),
        ),
      ).toBe(true);
    }
  });
});

describe('§2 sizes, measured (the record is in docs/progress.md)', () => {
  it('all 107 lib files are 3,783,805 bytes', () => {
    expect(sum(source)).toBe(3_783_805);
  });

  it('lib.dom.d.ts is 2,349,483 bytes (§2 says 2,351,349: corrected)', () => {
    expect(size('lib.dom.d.ts')).toBe(2_349_483);
  });

  it('decorators 13,153 + 1,287 bytes and scripthost 9,412 bytes (§2 says 14 KB and 9 KB: confirmed)', () => {
    expect(size('lib.decorators.d.ts')).toBe(13_153);
    expect(size('lib.decorators.legacy.d.ts')).toBe(1_287);
    expect(size('lib.scripthost.d.ts')).toBe(9_412);
  });

  it('the chain lib.es2025.d.ts resolves is 76 files, 573,813 bytes: 74 ES files (559,373) plus the two decorators files lib.es5.d.ts references (§2 says 569,639: corrected)', () => {
    const chain = referenceChain('lib.es2025.d.ts');
    const es = chain.filter((name) => name.startsWith('lib.es'));
    expect(chain).toHaveLength(76);
    expect(sum(chain)).toBe(573_813);
    expect(es).toHaveLength(74);
    expect(sum(es)).toBe(559_373);
    expect(chain.filter((name) => !name.startsWith('lib.es'))).toEqual([
      'lib.decorators.d.ts',
      'lib.decorators.legacy.d.ts',
    ]);
    expect(chain).not.toContain('lib.dom.d.ts');
  });

  it('lib.es2025.full.d.ts (the default lib when `lib` is unset) pulls in DOM, webworker.importscripts and scripthost, which is why §2 always sets lib explicitly', () => {
    const full = referenceChain('lib.es2025.full.d.ts');
    expect(full).toEqual(
      expect.arrayContaining([
        'lib.dom.d.ts',
        'lib.dom.iterable.d.ts',
        'lib.dom.asynciterable.d.ts',
        'lib.webworker.importscripts.d.ts',
        'lib.scripthost.d.ts',
      ]),
    );
    expect(ts.getDefaultLibFileName({ target: ts.ScriptTarget.ES2025 })).toBe(
      'lib.es2025.full.d.ts',
    );
  });
});

describe('knownLibFilesForCompilerOptions with the §2 default options (the Prep check §11 asks for)', () => {
  const DEFAULTS = {
    strict: true,
    target: 'es2025',
    module: 'esnext',
    moduleResolution: 'bundler',
    lib: ['es2025'],
    types: [],
    skipLibCheck: true,
    isolatedModules: true,
    useDefineForClassFields: true,
  };

  it('with lib names as written in JSON it returns a 101-name prefix of a fixed list: DOM, webworker, scripthost, and five files typescript 6.0.3 does not ship, so not only ES files', () => {
    const libs = knownLibFilesForCompilerOptions(
      { target: ts.ScriptTarget.ES2025, lib: ['es2025'] },
      ts,
    );
    expect(libs).toHaveLength(101);
    expect(libs).toEqual(
      expect.arrayContaining([
        'lib.d.ts',
        'lib.dom.d.ts',
        'lib.webworker.d.ts',
        'lib.scripthost.d.ts',
      ]),
    );
    expect(
      libs.filter((name) => !existsSync(path.join(TS_LIB_DIR, name))),
    ).toEqual([
      'lib.core.d.ts',
      'lib.es7.d.ts',
      'lib.core.es6.d.ts',
      'lib.core.es7.d.ts',
      'lib.es2022.sharedmemory.d.ts',
    ]);
    expect(libs.filter((name) => name.startsWith('lib.es'))).not.toEqual(
      referenceChain('lib.es2025.d.ts').filter((name) =>
        name.startsWith('lib.es'),
      ),
    );
  });

  it('with the options converted by ts.convertCompilerOptionsFromJson it returns only lib.d.ts, because ScriptTarget[12] reads back as "LatestStandard" and lib entries become file names', () => {
    const { options, errors } = ts.convertCompilerOptionsFromJson(
      DEFAULTS,
      '/',
    );
    expect(errors).toEqual([]);
    expect(options.target).toBe(ts.ScriptTarget.ES2025);
    expect(ts.ScriptTarget[ts.ScriptTarget.ES2025]).toBe('LatestStandard');
    expect(options.lib).toEqual(['lib.es2025.d.ts']);
    expect(knownLibFilesForCompilerOptions(options, ts)).toEqual(['lib.d.ts']);
  });
});

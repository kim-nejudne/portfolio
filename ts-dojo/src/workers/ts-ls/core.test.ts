// §12 F2 on the pure core in Node (spec §2: the worker core runs without a browser): `init`
// reports 6.0.3 and warms the es2025 libs; `openProject` fetches only the ES chain and, with
// `libs: [dom]`, lib.dom.d.ts once; diagnostics on the 200-line fixture stay under 300 ms p95
// after warm-up; quick info carries display text and docs; `^?` queries answer per line with
// an error entry over whitespace; emit has an inline source map per file and elides type-only
// imports; every §5 rule reports file and line; type cases group as §5 says, TS2578 included.
// Plus the requests F3 needs (completions, signature help, definition) and the path checks.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OpenProjectSpec } from '@/protocol/ts-ls';
import type { RuleId } from '@/verify/rules';
import { AMBIENT_RUNTIME_PATH } from './ambient';
import {
  createTsLsCore,
  TsLsError,
  TWOSLASH_NO_SYMBOL,
  TWOSLASH_NO_TARGET,
  validatePath,
  type TsLsCore,
} from './core';
import { countingFetchLib, nodeFetchLib, readFixture } from './node/fetch-lib';

const FIXTURE = readFixture('two-hundred-lines.ts.txt');

const lines = (...text: string[]): string => `${text.join('\n')}\n`;

/** The offset of the first occurrence of `needle` in `text`. */
function at(text: string, needle: string): number {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error(`${needle} is not in the text`);
  return index;
}

const TYPE_UTILS: OpenProjectSpec['dtsFiles'] = [
  {
    path: '/types/type-utils.d.ts',
    text: lines(
      "declare module '@dojo/type-utils' {",
      '  export type Expect<T extends true> = T;',
      '  export type Equal<X, Y> =',
      '    (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;',
      '}',
    ),
  },
];

let core: TsLsCore;

beforeAll(async () => {
  core = createTsLsCore({ fetchLib: nodeFetchLib });
  await core.init();
});

afterAll(() => {
  core.dispose();
});

describe('init (§12 F2: ready with tsVersion 6.0.3; §9 warm-up)', () => {
  it('reports tsVersion 6.0.3 and opens an empty default project with the es2025 libs parsed and no DOM', async () => {
    const fresh = createTsLsCore({ fetchLib: nodeFetchLib });
    expect(await fresh.init()).toEqual({ tsVersion: '6.0.3' });
    expect(fresh.projectPaths()).toEqual([AMBIENT_RUNTIME_PATH]);
    const program = fresh.getProgram();
    expect(program).toBeDefined();
    expect(program?.getSourceFile('/lib.es2025.d.ts')).toBeDefined();
    expect(program?.getSourceFile('/lib.es5.d.ts')).toBeDefined();
    expect(program?.getSourceFile('/lib.decorators.d.ts')).toBeDefined();
    expect(program?.getSourceFile('/lib.dom.d.ts')).toBeUndefined();
    fresh.dispose();
    expect(fresh.getProgram()).toBeUndefined();
  });
});

describe('openProject lib fetching (§12 F2 criterion 2)', () => {
  it('lib: ["es2025"] fetches only the ES chain; libs: ["dom"] adds lib.dom.d.ts once; nothing is fetched twice', async () => {
    const { fetchLib, fetched } = countingFetchLib();
    const counted = createTsLsCore({ fetchLib });
    await counted.init();
    expect(fetched).toHaveLength(76);
    expect(fetched.every((name) => /^lib\.(es|decorators)/.test(name))).toBe(
      true,
    );
    expect(fetched.some((name) => /dom|webworker|scripthost/.test(name))).toBe(
      false,
    );

    await counted.openProject({
      files: [{ path: '/index.ts', text: 'export const n: number = 1;\n' }],
    });
    expect(fetched, 'a second default project fetches nothing').toHaveLength(
      76,
    );

    await counted.openProject({
      files: [
        {
          path: '/index.ts',
          text: 'export const title = document.title;\nconsole.log(title);\n',
        },
      ],
      libs: ['dom'],
    });
    expect(fetched).toHaveLength(77);
    expect(fetched[76]).toBe('lib.dom.d.ts');
    expect(counted.getDiagnostics(['/index.ts']).diagnostics).toEqual([]);
    expect(
      counted.projectPaths(),
      'the DOM lib declares console itself, so the ambient file stays out',
    ).toEqual(['/index.ts']);

    await counted.openProject({
      files: [{ path: '/index.ts', text: 'export const n = 2;\n' }],
      libs: ['dom'],
    });
    expect(fetched, 'dom is fetched once').toHaveLength(77);

    await counted.openProject({ files: [] });
    expect(fetched).toHaveLength(77);
    expect(new Set(fetched).size).toBe(77);
    counted.dispose();
  });

  it('reuses the parsed lib SourceFiles across projects (one DocumentRegistry, §2 one service across exercises)', async () => {
    await core.openProject({
      files: [{ path: '/a.ts', text: 'export const a = 1;\n' }],
    });
    const before = core.getProgram()?.getSourceFile('/lib.es5.d.ts');
    expect(before).toBeDefined();
    await core.openProject({
      files: [{ path: '/b.ts', text: 'export const b = [1, 2].at(-1);\n' }],
      compilerOptions: { strictNullChecks: false },
    });
    expect(core.getProgram()?.getSourceFile('/lib.es5.d.ts')).toBe(before);
    expect(core.getProgram()?.getSourceFile('/a.ts')).toBeUndefined();
    expect(core.getDiagnostics(['/b.ts']).diagnostics).toEqual([]);
  });

  it('declares console and the timers for every project without DOM (the ambient runtime file)', async () => {
    await core.openProject({
      files: [
        {
          path: '/index.ts',
          text: lines(
            'console.log("hi", 1, { a: 2 });',
            'console.error(new Error("x"));',
            'const id = setTimeout(() => clearTimeout(id), 10);',
            'queueMicrotask(() => {});',
            'export {};',
          ),
        },
      ],
    });
    expect(core.projectPaths()).toEqual(['/index.ts', AMBIENT_RUNTIME_PATH]);
    expect(core.getDiagnostics(['/index.ts']).diagnostics).toEqual([]);
  });
});

describe('getDiagnostics (§12 F2 criterion 3, §9 budget)', () => {
  it('on the 200-line fixture, warm: zero diagnostics, the file version echoed, and p95 under 300 ms over 40 edits', async () => {
    expect(FIXTURE.trimEnd().split('\n')).toHaveLength(200);
    await core.openProject({ files: [{ path: '/index.ts', text: FIXTURE }] });
    const first = core.getDiagnostics(['/index.ts']);
    expect(first.diagnostics).toEqual([]);
    expect(first.versions).toEqual({ '/index.ts': 0 });

    const samples: number[] = [];
    for (let version = 1; version <= 40; version++) {
      core.updateFile(
        '/index.ts',
        FIXTURE.replace('revision = 0', `revision = ${version}`),
        version,
      );
      const started = performance.now();
      const result = core.getDiagnostics(['/index.ts']);
      samples.push(performance.now() - started);
      expect(result.diagnostics).toEqual([]);
      expect(result.versions['/index.ts']).toBe(version);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1] as number;
    expect(
      p95,
      `p95 ${p95.toFixed(1)} ms over ${samples.length} samples`,
    ).toBeLessThan(300);
  });

  it('maps a diagnostic to file, 0-based start and length, 1-based line and column, code, message and category', async () => {
    await core.openProject({
      files: [
        {
          path: '/index.ts',
          text: lines('const n: number = "one";', 'export const m = n +;'),
        },
      ],
    });
    const { diagnostics, versions } = core.getDiagnostics(['/index.ts']);
    expect(versions).toEqual({ '/index.ts': 0 });
    expect(diagnostics.map((d) => [d.code, d.line, d.column])).toEqual([
      [1109, 2, 21],
      [2322, 1, 7],
    ]);
    expect(diagnostics[1]).toMatchObject({
      file: '/index.ts',
      start: 6,
      length: 1,
      category: 'error',
      message: "Type 'string' is not assignable to type 'number'.",
    });
  });
});

describe('getQuickInfo and getTwoslashQueries (§12 F2 criterion 4)', () => {
  const text = lines(
    '/**',
    ' * Greets someone by name.',
    ' * @param name who to greet',
    ' */',
    'export function greet(name: string): string {',
    '  return `hi ${name}`;',
    '}',
    "const message = greet('dojo');",
    '//    ^?',
    "const again = greet('x');",
    '//            ^?',
    'const n = 42;',
    '//    ^?',
    'const spaced   = 1;',
    '//           ^?',
    '//^?',
  );

  beforeAll(async () => {
    await core.openProject({ files: [{ path: '/index.ts', text }] });
  });

  it('getQuickInfo returns the display string, the docs and the tags for an identifier, and null over whitespace', () => {
    const { info, path, version } = core.getQuickInfo(
      '/index.ts',
      at(text, "greet('dojo')"),
    );
    expect(path).toBe('/index.ts');
    expect(version).toBe(0);
    expect(info?.text).toBe('function greet(name: string): string');
    expect(info?.documentation).toBe('Greets someone by name.');
    expect(info?.tags).toEqual([{ name: 'param', text: 'name who to greet' }]);
    expect(info?.kind).toBe('function');
    expect(info?.start).toBe(at(text, "greet('dojo')"));
    expect(info?.length).toBe('greet'.length);

    expect(
      core.getQuickInfo('/index.ts', at(text, 'spaced   =') + 'spaced '.length)
        .info,
    ).toBeNull();
  });

  it('getTwoslashQueries returns one entry per ^? with the comment line, the caret column and the type text, and an error entry over whitespace', () => {
    const { queries } = core.getTwoslashQueries('/index.ts');
    expect(queries).toHaveLength(5);
    expect(queries[0]).toEqual({
      line: 9,
      column: 7,
      offset: at(text, 'message'),
      text: 'const message: string',
    });
    expect(queries[1]).toEqual({
      line: 11,
      column: 15,
      offset: at(text, "greet('x')"),
      text: 'function greet(name: string): string',
      docs: 'Greets someone by name.',
    });
    expect(queries[2]).toEqual({
      line: 13,
      column: 7,
      offset: at(text, 'n = 42'),
      text: 'const n: 42',
    });
    expect(queries[3]).toEqual({
      line: 15,
      column: 14,
      offset: at(text, 'spaced   =') + 'spaced '.length,
      error: TWOSLASH_NO_SYMBOL,
    });
    expect(queries[4]).toMatchObject({
      line: 16,
      column: 3,
      error: TWOSLASH_NO_SYMBOL,
    });
    expect(queries[3]).not.toHaveProperty('text');
  });

  it('a ^? on the first line has nothing above it', async () => {
    await core.openProject({
      files: [{ path: '/first.ts', text: '//  ^?\nconst x = 1;\n' }],
    });
    expect(core.getTwoslashQueries('/first.ts').queries).toEqual([
      { line: 1, column: 5, offset: null, error: TWOSLASH_NO_TARGET },
    ]);
  });

  it('refreshes with an edit and reports the new version', async () => {
    await core.openProject({
      files: [{ path: '/index.ts', text: 'const a = 1;\n//    ^?\n' }],
    });
    expect(core.getTwoslashQueries('/index.ts').queries[0]?.text).toBe(
      'const a: 1',
    );
    core.updateFile('/index.ts', 'const a = "s";\n//    ^?\n', 1);
    const result = core.getTwoslashQueries('/index.ts');
    expect(result.version).toBe(1);
    expect(result.queries[0]?.text).toBe('const a: "s"');
  });
});

describe('emit (§12 F2 criterion 5)', () => {
  it('returns JavaScript with an inline source map for every file and elides type-only imports', async () => {
    const shapes = lines(
      "export interface Shape { kind: 'circle'; radius: number }",
      "export type Unit = 'cm' | 'in';",
      'export function area(shape: Shape): number {',
      '  return Math.PI * shape.radius ** 2;',
      '}',
    );
    const index = lines(
      "import type { Shape } from './shapes';",
      "import { area } from './shapes';",
      "import { Unit } from './shapes';",
      "const shape: Shape = { kind: 'circle', radius: 2 };",
      "const unit: Unit = 'cm';",
      'export const value = `${area(shape)} ${unit}`;',
    );
    await core.openProject({
      files: [
        { path: '/index.ts', text: index },
        { path: '/shapes.ts', text: shapes },
      ],
    });
    expect(
      core.getDiagnostics(['/index.ts', '/shapes.ts']).diagnostics,
    ).toEqual([]);

    const { files, versions } = core.emit(['/index.ts', '/shapes.ts']);
    expect(versions).toEqual({ '/index.ts': 0, '/shapes.ts': 0 });
    expect(files.map((file) => file.path)).toEqual(['/index.ts', '/shapes.ts']);
    const sources = { '/index.ts': index, '/shapes.ts': shapes };
    for (const file of files) {
      const match =
        /\/\/# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)\s*$/.exec(
          file.js,
        );
      expect(
        match,
        `${file.path} ends with an inline source map`,
      ).not.toBeNull();
      const map = JSON.parse(
        Buffer.from(match?.[1] ?? '', 'base64').toString('utf8'),
      ) as { version: number; sources: string[]; sourcesContent?: string[] };
      expect(map.version).toBe(3);
      expect(map.sources).toHaveLength(1);
      expect(map.sourcesContent).toEqual([
        sources[file.path as keyof typeof sources],
      ]);
    }

    const js = files[0]?.js ?? '';
    expect(js).toContain("import { area } from './shapes';");
    expect(js).not.toContain('Shape');
    expect(js).not.toContain('Unit');
    expect(js).not.toContain('import type');
    expect(js).toContain('export const value = `${area(shape)} ${unit}`;');
    expect(files[1]?.js).toContain('export function area(shape) {');
  });

  it('refuses a declaration file', async () => {
    await core.openProject({
      files: [{ path: '/index.ts', text: 'export const n = 1;\n' }],
      dtsFiles: [
        { path: '/types/extra.d.ts', text: 'declare const extra: 1;\n' },
      ],
    });
    expect(() => core.emit(['/types/extra.d.ts'])).toThrow(TsLsError);
  });
});

describe('lintAst (§12 F2 criterion 7)', () => {
  const index = lines(
    '// @ts-ignore',
    'const a: any = 1;',
    'export function f(p) {',
    '  return (p as unknown as string).length;',
    '}',
    'export const b = a!;',
    'export const c = <string>b;',
    "eval('1');",
    "new Function('return 1');",
    '/* @ts-expect-error */',
    "export const d: number = 'x';",
    'const e = (0, eval);',
    "globalThis.eval('2');",
    "export const sizes = [a, c, e, Function('return 2')];",
  );
  const tests = lines(
    '// @ts-expect-error',
    "const bad: number = 'x';",
    "test.skip('later', () => {});",
    "test('now', () => {});",
    "const alias = test['skip'];",
  );
  const everyRule: RuleId[] = [
    'explicit-any',
    'implicit-any',
    'as-unknown-as',
    'non-null-assertion',
    'angle-cast',
  ];

  beforeAll(async () => {
    await core.openProject({
      files: [
        { path: '/index.ts', text: index },
        { path: '/tests.ts', text: tests },
      ],
      compilerOptions: { noImplicitAny: false },
    });
  });

  it('reports every §5 rule on the fixture with file, line and column', () => {
    const { hits, versions } = core.lintAst(
      ['/index.ts', '/tests.ts'],
      everyRule,
    );
    expect(versions).toEqual({ '/index.ts': 0, '/tests.ts': 0 });
    expect(
      hits.map((hit) => [hit.file, hit.line, hit.column, hit.rule]),
    ).toEqual([
      ['/index.ts', 1, 1, 'ts-directive'],
      ['/index.ts', 2, 10, 'explicit-any'],
      ['/index.ts', 3, 19, 'implicit-any'],
      ['/index.ts', 4, 11, 'as-unknown-as'],
      ['/index.ts', 6, 19, 'non-null-assertion'],
      ['/index.ts', 7, 18, 'angle-cast'],
      ['/index.ts', 8, 1, 'eval'],
      ['/index.ts', 9, 1, 'eval'],
      ['/index.ts', 10, 1, 'ts-directive'],
      ['/index.ts', 12, 15, 'eval'],
      ['/index.ts', 13, 1, 'eval'],
      ['/index.ts', 14, 32, 'eval'],
      ['/tests.ts', 3, 1, 'no-skipped-tests'],
      ['/tests.ts', 5, 15, 'no-skipped-tests'],
    ]);
    expect(hits[2]?.message).toBe(
      "Parameter 'p' implicitly has an 'any' type.",
    );
    expect(hits[7]?.message).toBe('new Function is not allowed');
    expect(hits[11]?.message).toBe('Function() is not allowed');
    for (const hit of hits) expect(hit.message).toMatch(/\S/);
  });

  it('implicit-any is reported by the rule although noImplicitAny is off for the project', () => {
    expect(
      core.getDiagnostics(['/index.ts']).diagnostics.map((d) => d.code),
    ).not.toContain(7006);
  });

  it('with rules: [] only the always-on rules fire, and tests.ts may use @ts-expect-error', () => {
    const { hits } = core.lintAst(['/index.ts', '/tests.ts'], []);
    expect(hits.map((hit) => [hit.file, hit.line, hit.rule])).toEqual([
      ['/index.ts', 1, 'ts-directive'],
      ['/index.ts', 8, 'eval'],
      ['/index.ts', 9, 'eval'],
      ['/index.ts', 10, 'ts-directive'],
      ['/index.ts', 12, 'eval'],
      ['/index.ts', 13, 'eval'],
      ['/index.ts', 14, 'eval'],
      ['/tests.ts', 3, 'no-skipped-tests'],
      ['/tests.ts', 5, 'no-skipped-tests'],
    ]);
  });

  it('a clean file has no hits, a user object with an eval method is fine, and an unknown rule is refused', async () => {
    await core.openProject({
      files: [
        {
          path: '/index.ts',
          text: lines(
            'const calculator = { eval: (s: string) => s.length };',
            'export const n = calculator.eval("1 + 1");',
            'export const kind = typeof Function;',
          ),
        },
      ],
    });
    expect(
      core.lintAst(['/index.ts'], ['explicit-any', 'angle-cast']).hits,
    ).toEqual([]);
    expect(() => core.lintAst(['/index.ts'], ['no-console' as RuleId])).toThrow(
      /unknown rule no-console/,
    );
  });
});

describe('runTypeTests (§12 F2 criterion 8)', () => {
  it('groups diagnostics into cases as §5 describes, including the TS2578 case, and reports stray diagnostics as outsideCases', async () => {
    const tests = lines(
      "import type { Equal, Expect } from '@dojo/type-utils';",
      "import { answer, id, type Pick2 } from './index';",
      '',
      'type cases = [',
      "  Expect<Equal<Pick2<{ a: 1; b: 2 }, 'a'>, { a: 1 }>>, // picks one key",
      '  Expect<Equal<typeof answer, string>>, // answer is a string',
      '  // @ts-expect-error',
      "  Pick2<{ a: 1 }, 'z'>,",
      '  // @ts-expect-error',
      "  Pick2<{ a: 1 }, 'a'>,",
      '];',
      '',
      '// @ts-expect-error',
      'const wrong: string = answer;',
      'const stray: string = id(answer);',
      '// @ts-expect-error',
      'const fine: number = answer; // assignment that is fine',
      'export { wrong, stray, fine };',
    );
    await core.openProject({
      files: [
        {
          path: '/index.ts',
          text: lines(
            'export type Pick2<T, K extends keyof T> = { [P in K]: T[P] };',
            'export function id<T>(x: T): T {',
            '  return x;',
            '}',
            'export const answer = 42;',
          ),
        },
        { path: '/tests.ts', text: tests },
      ],
      dtsFiles: TYPE_UTILS,
    });
    const { cases, outsideCases, versions } = core.runTypeTests(['/tests.ts']);
    expect(versions).toEqual({ '/tests.ts': 0 });
    expect(cases.map((c) => [c.name, c.ok])).toEqual([
      ['picks one key', true],
      ['answer is a string', false],
      ['case 3', true],
      ['case 4', false],
      ['case 5', true],
      ['assignment that is fine', false],
    ]);
    expect(cases[1]?.diagnostics.map((d) => [d.code, d.line])).toEqual([
      [2344, 6],
    ]);
    expect(cases[3]?.diagnostics.map((d) => [d.code, d.line])).toEqual([
      [2578, 9],
    ]);
    expect(cases[5]?.diagnostics.map((d) => [d.code, d.line])).toEqual([
      [2578, 16],
    ]);
    expect(outsideCases.map((d) => [d.code, d.line])).toEqual([[2322, 15]]);
    expect(core.getDiagnostics(['/index.ts']).diagnostics).toEqual([]);
  });

  it('a test file with no cases and no errors yields nothing', async () => {
    await core.openProject({
      files: [{ path: '/tests.ts', text: 'export const ok = true;\n' }],
    });
    expect(core.runTypeTests(['/tests.ts'])).toEqual({
      cases: [],
      outsideCases: [],
      versions: { '/tests.ts': 0 },
    });
  });
});

describe('the requests the editor needs (§2 protocol, F3)', () => {
  // Two files: `dojo.` followed by `twice(` on the next line would parse as one expression.
  const members = lines(
    'export const dojo = { lessons: 3, name: "ts" };',
    'dojo.',
  );
  const calls = lines(
    '/** Doubles. */',
    'export function twice(n: number): number {',
    '  return n * 2;',
    '}',
    'twice(',
  );

  beforeAll(async () => {
    await core.openProject({
      files: [
        { path: '/members.ts', text: members },
        { path: '/calls.ts', text: calls },
      ],
    });
  });

  it('getCompletions lists the members after a dot and getCompletionDetails explains one', () => {
    const offset = at(members, 'dojo.\n') + 'dojo.'.length;
    const { completions } = core.getCompletions('/members.ts', offset);
    expect(completions?.entries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['lessons', 'name']),
    );
    const { details } = core.getCompletionDetails(
      '/members.ts',
      offset,
      'lessons',
    );
    expect(details?.text).toBe('(property) lessons: number');
  });

  it('getSignatureHelp returns the signature at the open parenthesis', () => {
    const offset = at(calls, 'twice(\n') + 'twice('.length;
    const { help } = core.getSignatureHelp('/calls.ts', offset);
    expect(help?.items[0]?.label).toBe('twice(n: number): number');
    expect(help?.items[0]?.documentation).toBe('Doubles.');
    expect(help?.items[0]?.parameters).toEqual([
      { label: 'n: number', documentation: '' },
    ]);
    expect(help?.argumentIndex).toBe(0);
  });

  it('getDefinition crosses files', async () => {
    await core.openProject({
      files: [
        { path: '/a.ts', text: 'export const shared = 1;\n' },
        {
          path: '/b.ts',
          text: "import { shared } from './a';\nexport const twice = shared * 2;\n",
        },
      ],
    });
    const text =
      "import { shared } from './a';\nexport const twice = shared * 2;\n";
    const { locations } = core.getDefinition('/b.ts', at(text, 'shared * 2'));
    expect(locations).toEqual([
      { path: '/a.ts', start: 13, length: 6, line: 1, column: 14 },
    ]);
  });

  it('updateFile only touches editable files and getDiagnostics only project files', async () => {
    await core.openProject({
      files: [{ path: '/index.ts', text: 'export const n = 1;\n' }],
      dtsFiles: [{ path: '/types/x.d.ts', text: 'declare const x: 1;\n' }],
    });
    expect(() => core.updateFile('/types/x.d.ts', '', 1)).toThrow(
      /not an editable file/,
    );
    expect(() => core.updateFile(AMBIENT_RUNTIME_PATH, '', 1)).toThrow(
      TsLsError,
    );
    expect(() => core.updateFile('/other.ts', '', 1)).toThrow(TsLsError);
    expect(() => core.getDiagnostics(['/other.ts'])).toThrow(
      /not a file of the project/,
    );
    expect(() => core.getQuickInfo('/other.ts', 0)).toThrow(TsLsError);
  });
});

describe('openProject validation', () => {
  it('refuses relative, unnormalised, reserved and non-TypeScript paths, duplicates and bad options', async () => {
    const bad: [OpenProjectSpec, RegExp][] = [
      [{ files: [{ path: 'index.ts', text: '' }] }, /not an absolute path/],
      [
        { files: [{ path: '/../index.ts', text: '' }] },
        /not a normalised path/,
      ],
      [{ files: [{ path: '/a//b.ts', text: '' }] }, /not a normalised path/],
      [
        { files: [{ path: '/index.js', text: '' }] },
        /not a \.ts, \.tsx or \.d\.ts/,
      ],
      [
        { files: [{ path: '/dojo/mine.ts', text: '' }] },
        /reserved for ts-dojo/,
      ],
      [
        { files: [{ path: '/lib.es5.d.ts', text: '' }] },
        /reserved for the compiler libs/,
      ],
      [
        { files: [], dtsFiles: [{ path: '/types/x.ts', text: '' }] },
        /not a \.d\.ts file/,
      ],
      [
        {
          files: [
            { path: '/index.ts', text: '' },
            { path: '/index.ts', text: '' },
          ],
        },
        /listed twice/,
      ],
      [{ files: [], compilerOptions: { lib: ['es2026'] } }, /compilerOptions/],
      [{ files: [], compilerOptions: { target: 'es3000' } }, /compilerOptions/],
    ];
    for (const [spec, message] of bad) {
      await expect(core.openProject(spec)).rejects.toThrow(message);
      await expect(core.openProject(spec)).rejects.toBeInstanceOf(TsLsError);
    }
    expect(validatePath('/src/deep/file.tsx', 'files')).toBe(
      '/src/deep/file.tsx',
    );
    expect(() => validatePath(42, 'files')).toThrow(TsLsError);
  });

  it('keeps the previous project when the new one is refused', async () => {
    await core.openProject({
      files: [{ path: '/keep.ts', text: 'export const keep = 1;\n' }],
    });
    await expect(
      core.openProject({ files: [{ path: 'nope.ts', text: '' }] }),
    ).rejects.toThrow(TsLsError);
    expect(core.getDiagnostics(['/keep.ts']).diagnostics).toEqual([]);
  });
});

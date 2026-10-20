// The §5 verdict over the shipped fixture exercises, in Node with the app's own core and
// sandbox modules (§12 F6 criterion 2): solutions pass, starters fail for their kind's reason,
// Compiles failing stops the other groups, `explicit-any` is on for type-challenge, and a
// runtime failure carries expected and actual.
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  exerciseFiles,
  isEditorExercise,
  type EditorExercise,
  type Registry,
} from '@/content/build-registry';
import { loadContent } from '@/content/node/load';
import { createNodeSandboxRunner } from '@/workers/sandbox/node/spawn';
import type { RunState } from '@/workers/sandbox/runner';
import { createTsLsCore, type TsLsCore } from '@/workers/ts-ls/core';
import { nodeFetchLib } from '@/workers/ts-ls/node/fetch-lib';
import {
  hasRuntimeTests,
  rulesFor,
  runtimeGroup,
  runtimeTestsOn,
  verifyExercise,
  TEST_FILE_NOTE,
} from './exercise';

const CONTENT = path.resolve(import.meta.dirname, '..', '..', 'content');

let registry: Registry;
let core: TsLsCore;
let runner: ReturnType<typeof createNodeSandboxRunner>;

beforeAll(async () => {
  registry = (await loadContent(CONTENT)).registry;
  core = createTsLsCore({ fetchLib: nodeFetchLib });
  await core.init();
  runner = createNodeSandboxRunner((paths) =>
    Promise.resolve(core.emit(paths, 'commonjs').files),
  );
});

afterAll(() => {
  runner.dispose();
  core.dispose();
});

function editor(id: string): EditorExercise {
  const exercise = registry.exercise(id);
  if (exercise === undefined || !isEditorExercise(exercise)) {
    throw new Error(`${id} is not an editor exercise of the fixture tree`);
  }
  return exercise;
}

function verify(exercise: EditorExercise, which: 'starter' | 'solution') {
  return verifyExercise(
    core,
    runtimeTestsOn(runner),
    exercise,
    exerciseFiles(exercise, which),
  );
}

describe('rulesFor and hasRuntimeTests', () => {
  it('adds explicit-any for type-challenge and runs runtime tests only where §1 says', () => {
    expect(rulesFor({ kind: 'type-challenge', forbid: [] })).toEqual([
      'explicit-any',
    ]);
    expect(
      rulesFor({ kind: 'type-challenge', forbid: ['explicit-any', 'eval'] }),
    ).toEqual(['explicit-any', 'eval']);
    expect(
      rulesFor({ kind: 'implement', forbid: ['non-null-assertion'] }),
    ).toEqual(['non-null-assertion']);
    expect(hasRuntimeTests({ kind: 'implement', tests: 'tests.ts' })).toBe(
      true,
    );
    expect(hasRuntimeTests({ kind: 'type-challenge', tests: 'tests.ts' })).toBe(
      false,
    );
    expect(hasRuntimeTests({ kind: 'fix' })).toBe(false);
  });
});

describe('fix', () => {
  const id = 'm99-fixtures/01-fix/01-handle-the-new-shape';

  it('the solution passes every group', async () => {
    const result = await verify(editor(id), 'solution');
    expect(result.compiles.diagnostics).toEqual([]);
    expect(result.runtime.tests.map((t) => t.status)).toEqual([
      'pass',
      'pass',
      'pass',
    ]);
    expect(result).toMatchObject({
      compiles: { ok: true },
      typeCases: { ok: true, cases: [] },
      runtime: { ok: true },
      rules: { ok: true, hits: [] },
      passed: true,
    });
  });

  it('the starter fails Compiles and the other groups are not run', async () => {
    const result = await verify(editor(id), 'starter');
    expect(result.passed).toBe(false);
    expect(result.compiles.ok).toBe(false);
    expect(result.compiles.diagnostics.map((d) => d.code)).toEqual([2322]);
    expect(result.compiles.diagnostics[0]).toMatchObject({
      file: '/index.ts',
      line: 13,
    });
    expect(result.typeCases).toEqual({ ok: false, cases: [] });
    expect(result.runtime).toEqual({ ok: false, tests: [] });
    expect(result.rules).toEqual({ ok: false, hits: [] });
  });
});

describe('implement', () => {
  const id = 'm99-fixtures/02-implement/01-largest-shape';

  it('the solution passes; the starter compiles but fails its runtime tests with expected and actual', async () => {
    expect((await verify(editor(id), 'solution')).passed).toBe(true);
    const result = await verify(editor(id), 'starter');
    expect(result.compiles.ok).toBe(true);
    expect(result.rules.ok).toBe(true);
    expect(result.runtime.ok).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.runtime.tests).toHaveLength(7);
    expect(result.runtime.tests[0]).toMatchObject({
      name: 'area of a circle',
      status: 'fail',
      message: 'not implemented for circle',
    });
  });

  it('a wrong answer reports expected and actual, serialized like console output', async () => {
    const exercise = editor('m99-fixtures/03-type-challenge/02-area-by-kind');
    const files = exerciseFiles(exercise, 'solution').map((file) =>
      file.path === '/index.ts'
        ? { ...file, text: file.text.replace('r=', 'radius=') }
        : file,
    );
    const result = await verifyExercise(
      core,
      runtimeTestsOn(runner),
      exercise,
      files,
    );
    expect(result.runtime.tests[0]).toMatchObject({
      status: 'fail',
      expected: "'circle r=1'",
      actual: "'circle radius=1'",
    });
    expect(result.runtime.tests[1]?.status).toBe('pass');
    expect(result.passed).toBe(false);
  });

  it('a wrong export name fails Compiles with the test-file note', async () => {
    const exercise = editor(id);
    const files = exerciseFiles(exercise, 'solution').map((file) =>
      file.path === '/index.ts'
        ? {
            ...file,
            text: file.text.replace(
              'export function largest',
              'export function biggest',
            ),
          }
        : file,
    );
    const result = await verifyExercise(
      core,
      runtimeTestsOn(runner),
      exercise,
      files,
    );
    expect(result.compiles.ok).toBe(false);
    expect(result.compiles.diagnostics[0]).toMatchObject({
      file: '/tests.ts',
      message: expect.stringContaining(TEST_FILE_NOTE) as string,
    });
  });
});

describe('type-challenge', () => {
  const id = 'm99-fixtures/03-type-challenge/01-describe-the-events';

  it('the solution passes every case and the starter fails them, including the unused @ts-expect-error lines', async () => {
    const solution = await verify(editor(id), 'solution');
    expect(solution.passed).toBe(true);
    expect(solution.typeCases.cases.map((c) => [c.name, c.ok])).toEqual([
      ['exactly the three members', true],
      ['narrowing by type finds the keydown', true],
      ['case 3', true],
      ['case 4', true],
    ]);
    expect(solution.runtime).toEqual({ ok: true, tests: [] });
    const starter = await verify(editor(id), 'starter');
    expect(starter.compiles.ok).toBe(true);
    expect(starter.typeCases.ok).toBe(false);
    expect(starter.typeCases.cases.map((c) => c.ok)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(
      starter.typeCases.cases.map((c) => c.diagnostics.map((d) => d.code)),
    ).toEqual([[2344], [2344], [2578], [2578]]);
    expect(starter.passed).toBe(false);
  });

  it('`any` in the solution fails Rules without the exercise listing the rule', async () => {
    const exercise = { ...editor(id), forbid: [] };
    const files = exerciseFiles(exercise, 'solution').map((file) =>
      file.path === '/index.ts'
        ? { ...file, text: `${file.text}\nexport const leak: any = 1;` }
        : file,
    );
    const result = await verifyExercise(
      core,
      runtimeTestsOn(runner),
      exercise,
      files,
    );
    expect(result.rules.ok).toBe(false);
    expect(result.rules.hits).toEqual([
      expect.objectContaining({
        rule: 'explicit-any',
        file: '/index.ts',
        line: 6,
      }),
    ]);
    expect(result.passed).toBe(false);
  });
});

describe('runtimeGroup', () => {
  const base: RunState = {
    status: { kind: 'done', durationMs: 3 },
    entries: [],
    tests: [{ name: 'a', status: 'pass', ms: 1 }],
    testSummary: { passed: 1, failed: 0, timedOut: 0, skipped: 0, ms: 1 },
    format: 'esm',
    run: 1,
  };

  it('passes only a finished run whose tests all passed or were skipped', () => {
    expect(runtimeGroup(base).ok).toBe(true);
    expect(
      runtimeGroup({ ...base, tests: [{ name: 'a', status: 'skip', ms: 0 }] })
        .ok,
    ).toBe(true);
    expect(runtimeGroup({ ...base, testSummary: null }).ok).toBe(false);
    expect(
      runtimeGroup({
        ...base,
        tests: [{ name: 'a', status: 'timeout', ms: 1000 }],
      }).ok,
    ).toBe(false);
  });

  it('adds a synthetic entry for a killed or failed run and for a load error', () => {
    const killed = runtimeGroup({
      ...base,
      status: { kind: 'killed', afterMs: 5000, byDeadline: true },
    });
    expect(killed.ok).toBe(false);
    expect(killed.tests.at(-1)).toEqual({
      name: '(run)',
      status: 'timeout',
      message: 'killed after 5000 ms',
      ms: 5000,
    });
    const failed = runtimeGroup({
      ...base,
      status: { kind: 'failed', message: 'no entry' },
    });
    expect(failed.tests.at(-1)).toMatchObject({
      name: '(run)',
      status: 'fail',
      message: 'no entry',
    });
    const load = runtimeGroup({
      ...base,
      entries: [
        { kind: 'error', message: 'Error: boom', stack: '', loc: null },
      ],
    });
    expect(load.ok).toBe(false);
    expect(load.tests.at(-1)).toMatchObject({
      name: '(load)',
      message: 'Error: boom',
    });
  });
});

/** The exercise's solution files with `index.ts` passed through `edit`. */
function editedSolution(
  exercise: EditorExercise,
  edit: (text: string) => string,
): ReturnType<typeof exerciseFiles> {
  return exerciseFiles(exercise, 'solution').map((file) =>
    file.path === '/index.ts' ? { ...file, text: edit(file.text) } : file,
  );
}

const IMPLEMENT_ID = 'm99-fixtures/02-implement/01-largest-shape';

// §12 F7 criterion 3: "`forbid: [explicit-any]` fails a solution with `any` and names the
// line; without the rule the same solution passes."
describe('§12 F7: forbid: [explicit-any] fails a solution with any and names the line; without the rule the same solution passes', () => {
  it('fails Rules on line 24 with the rule, and passes every group once the rule is not listed', async () => {
    const exercise: EditorExercise = {
      ...editor(IMPLEMENT_ID),
      forbid: ['explicit-any'],
    };
    const files = editedSolution(exercise, (text) =>
      text.replace('let best: Shape | undefined;', 'let best: any;'),
    );
    const withRule = await verifyExercise(
      core,
      runtimeTestsOn(runner),
      exercise,
      files,
    );
    expect(withRule.compiles.ok).toBe(true);
    expect(withRule.runtime.ok).toBe(true);
    expect(withRule.rules.ok).toBe(false);
    expect(withRule.rules.hits).toEqual([
      expect.objectContaining({
        rule: 'explicit-any',
        file: '/index.ts',
        line: 24,
        message: 'explicit `any` is not allowed',
      }),
    ]);
    expect(withRule.passed).toBe(false);

    const withoutRule = await verifyExercise(
      core,
      runtimeTestsOn(runner),
      { ...exercise, forbid: [] },
      files,
    );
    expect(withoutRule.rules).toEqual({ ok: true, hits: [] });
    expect(withoutRule.passed).toBe(true);
  });
});

// §12 F7 criterion 4: "A `@ts-ignore`, `@ts-nocheck` or `@ts-expect-error` in a non-test user
// file always fails, and so does `eval`." Every case runs with `forbid: []`, so only the
// always-on rules can fire.
describe('§12 F7: a @ts-ignore, @ts-nocheck or @ts-expect-error in a non-test user file always fails, and so does eval', () => {
  const CASES: [label: string, edit: (text: string) => string, rule: string][] =
    [
      [
        '@ts-ignore',
        (text) => text.replace('  let best', '  // @ts-ignore\n  let best'),
        'ts-directive',
      ],
      ['@ts-nocheck', (text) => `// @ts-nocheck\n${text}`, 'ts-directive'],
      [
        '@ts-expect-error (used, so the file compiles)',
        (text) =>
          `${text}\n// @ts-expect-error\nexport const wrong: number = 'one';\n`,
        'ts-directive',
      ],
      ['eval', (text) => `${text}\nexport const one = eval('1');\n`, 'eval'],
      [
        'new Function',
        (text) => `${text}\nexport const make = new Function('return 1');\n`,
        'eval',
      ],
    ];

  for (const [label, edit, rule] of CASES) {
    it(`${label} fails Rules with ${rule} although forbid is empty`, async () => {
      const exercise = { ...editor(IMPLEMENT_ID), forbid: [] };
      const result = await verifyExercise(
        core,
        runtimeTestsOn(runner),
        exercise,
        editedSolution(exercise, edit),
      );
      expect(result.compiles.ok).toBe(true);
      expect(result.rules.ok).toBe(false);
      expect(
        result.rules.hits.map((hit) => [hit.rule, hit.file]),
      ).toContainEqual([rule, '/index.ts']);
      expect(result.passed).toBe(false);
    });
  }

  it('the same directives in tests.ts are fine (they are how type cases are written)', async () => {
    const exercise = { ...editor(IMPLEMENT_ID), forbid: [] };
    const files = exerciseFiles(exercise, 'solution').map((file) =>
      file.path === '/tests.ts'
        ? {
            ...file,
            text: `${file.text}\n// @ts-expect-error a string is not a shape\nlargest(['circle']);\n`,
          }
        : file,
    );
    const result = await verifyExercise(
      core,
      runtimeTestsOn(runner),
      exercise,
      files,
    );
    expect(result.rules).toEqual({ ok: true, hits: [] });
    expect(result.passed).toBe(true);
  });
});

// §12 F7 criterion 5: "A `fix` exercise passes only when every file has zero diagnostics."
describe('§12 F7: a fix exercise passes only when every file has zero diagnostics', () => {
  const FIX_ID = 'm99-fixtures/01-fix/01-handle-the-new-shape';

  it('the solution passes, and the same solution with one error in tests.ts fails Compiles with the test-file note', async () => {
    const exercise = editor(FIX_ID);
    expect((await verify(exercise, 'solution')).passed).toBe(true);
    const files = exerciseFiles(exercise, 'solution').map((file) =>
      file.path === '/tests.ts'
        ? { ...file, text: `${file.text}\nconst count: number = 'three';\n` }
        : file,
    );
    const result = await verifyExercise(
      core,
      runtimeTestsOn(runner),
      exercise,
      files,
    );
    expect(result.compiles.ok).toBe(false);
    expect(result.compiles.diagnostics).toEqual([
      expect.objectContaining({
        file: '/tests.ts',
        code: 2322,
        message: expect.stringContaining(TEST_FILE_NOTE) as string,
      }),
    ]);
    expect(result.passed).toBe(false);
  });

  it('a warning-free starter edit that leaves one error anywhere still fails', async () => {
    const exercise = editor(FIX_ID);
    const files = editedSolution(
      exercise,
      (text) => `${text}\nexport const extra: string = 1;\n`,
    );
    const result = await verifyExercise(
      core,
      runtimeTestsOn(runner),
      exercise,
      files,
    );
    expect(result.compiles.ok).toBe(false);
    expect(result.compiles.diagnostics.map((d) => [d.file, d.code])).toEqual([
      ['/index.ts', 2322],
    ]);
    expect(result.passed).toBe(false);
  });
});

describe('progress', () => {
  it('reports each group as it finishes, in §5 order, with the phase that runs next', async () => {
    const events: { phase: string | null; groups: string[] }[] = [];
    const result = await verifyExercise(
      core,
      runtimeTestsOn(runner),
      editor(IMPLEMENT_ID),
      exerciseFiles(editor(IMPLEMENT_ID), 'solution'),
      {
        onProgress: ({ phase, groups }) =>
          events.push({ phase, groups: Object.keys(groups) }),
      },
    );
    expect(result.passed).toBe(true);
    expect(events).toEqual([
      { phase: 'compiles', groups: [] },
      { phase: 'rules', groups: ['compiles', 'typeCases'] },
      { phase: 'runtime', groups: ['compiles', 'typeCases', 'rules'] },
      { phase: null, groups: ['compiles', 'typeCases', 'rules', 'runtime'] },
    ]);
  });

  it('stops after Compiles when it fails', async () => {
    const phases: (string | null)[] = [];
    await verifyExercise(
      core,
      runtimeTestsOn(runner),
      editor('m99-fixtures/01-fix/01-handle-the-new-shape'),
      exerciseFiles(
        editor('m99-fixtures/01-fix/01-handle-the-new-shape'),
        'starter',
      ),
      { onProgress: ({ phase }) => phases.push(phase) },
    );
    expect(phases).toEqual(['compiles', null]);
  });
});

describe('progress without runtime tests', () => {
  it('a type-challenge never reports a runtime phase (it has no runtime tests)', async () => {
    const id = 'm99-fixtures/03-type-challenge/01-describe-the-events';
    const phases: (string | null)[] = [];
    const result = await verifyExercise(
      core,
      runtimeTestsOn(runner),
      editor(id),
      exerciseFiles(editor(id), 'solution'),
      { onProgress: ({ phase }) => phases.push(phase) },
    );
    expect(result.passed).toBe(true);
    expect(phases).toEqual(['compiles', 'rules', null]);
  });
});

// §12 F7 criterion 6: "Compiles failing stops the other groups, with the reason shown." The
// reason is the Tests tab's (src/verify/tests-view.test.ts); this proves nothing else runs.
describe('§12 F7: Compiles failing stops the other groups', () => {
  it('never lints, emits or runs the tests once Compiles has failed', async () => {
    const exercise = editor(IMPLEMENT_ID);
    const spy = {
      openProject: vi.fn(),
      getDiagnostics: vi.fn(() => ({
        diagnostics: [
          {
            file: '/index.ts',
            start: 0,
            length: 1,
            line: 1,
            column: 1,
            code: 2322,
            message: 'no',
            category: 'error' as const,
          },
        ],
      })),
      runTypeTests: vi.fn(() => ({ cases: [], outsideCases: [] })),
      lintAst: vi.fn(() => ({ hits: [] })),
      emit: vi.fn(() => ({ files: [] })),
    };
    const runtime = vi.fn(() => Promise.reject(new Error('must not run')));
    const result = await verifyExercise(
      spy,
      runtime,
      exercise,
      exerciseFiles(exercise, 'solution'),
    );
    expect(result.compiles.ok).toBe(false);
    expect(result.passed).toBe(false);
    expect(spy.lintAst).not.toHaveBeenCalled();
    expect(spy.emit).not.toHaveBeenCalled();
    expect(runtime).not.toHaveBeenCalled();
  });
});

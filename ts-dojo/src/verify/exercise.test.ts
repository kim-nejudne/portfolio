// The §5 verdict over the shipped fixture exercises, in Node with the app's own core and
// sandbox modules (§12 F6 criterion 2): solutions pass, starters fail for their kind's reason,
// Compiles failing stops the other groups, `explicit-any` is on for type-challenge, and a
// runtime failure carries expected and actual.
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
      ['case 2', true],
      ['case 3', true],
    ]);
    expect(solution.runtime).toEqual({ ok: true, tests: [] });
    const starter = await verify(editor(id), 'starter');
    expect(starter.compiles.ok).toBe(true);
    expect(starter.typeCases.ok).toBe(false);
    expect(starter.typeCases.cases.map((c) => c.ok)).toEqual([
      false,
      false,
      false,
    ]);
    expect(starter.typeCases.cases[1]?.diagnostics.map((d) => d.code)).toEqual([
      2578,
    ]);
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

// The Tests tab's row model (§5 Verdict; §12 F7 criteria 6 and 7): four group rows in §5
// order, each with a status and a one-line summary; a failed group expanded by default and
// listing its diagnostics, cases, tests or hits; Compiles failing marks the other three
// "not run" with the reason; `Enter` targets for a diagnostic, a rule hit, a failed case and a
// failed runtime test (found in tests.ts by its name).
import { describe, expect, it } from 'vitest';
import type { Diag, RuleHit } from '@/protocol/ts-ls';
import type { RunState, TestEntry } from '@/workers/sandbox/runner';
import type { ExerciseResult } from './exercise';
import {
  buildRows,
  currentTestRun,
  groupStatuses,
  jumpTarget,
  locateTest,
  NOT_RUN_REASON,
  verdictLine,
  type TestsRow,
} from './tests-view';
import { IDLE_VERIFIER, type VerifierState } from './verifier';

function diag(file: string, line: number, code = 2322): Diag {
  return {
    file,
    start: 10 * line,
    length: 3,
    line,
    column: 5,
    code,
    message: `message ${String(code)}`,
    category: 'error',
  };
}

const HIT: RuleHit = {
  rule: 'explicit-any',
  file: '/index.ts',
  line: 24,
  column: 13,
  message: 'explicit `any` is not allowed',
};

const PASSED: ExerciseResult = {
  compiles: { ok: true, diagnostics: [] },
  typeCases: {
    ok: true,
    cases: [
      { name: 'one', ok: true, diagnostics: [] },
      { name: 'two', ok: true, diagnostics: [] },
    ],
  },
  runtime: {
    ok: true,
    tests: [{ name: 'adds', status: 'pass', ms: 1 }],
  },
  rules: { ok: true, hits: [] },
  passed: true,
};

function done(result: ExerciseResult): VerifierState {
  return {
    run: 1,
    status: 'done',
    phase: null,
    groups: {
      compiles: result.compiles,
      typeCases: result.typeCases,
      runtime: result.runtime,
      rules: result.rules,
    },
    result,
    error: null,
  };
}

const NO_OVERRIDES = new Map();

const kinds = (rows: TestsRow[]): string[] =>
  rows.map((row) => (row.kind === 'group' ? `group:${row.group}` : row.kind));

describe('groupStatuses', () => {
  it('is pending everywhere before the first :test', () => {
    expect(groupStatuses(IDLE_VERIFIER)).toEqual({
      compiles: 'pending',
      typeCases: 'pending',
      runtime: 'pending',
      rules: 'pending',
    });
  });

  it('follows the phases while a verification runs', () => {
    const compiling: VerifierState = {
      ...IDLE_VERIFIER,
      run: 1,
      status: 'running',
      phase: 'compiles',
    };
    expect(groupStatuses(compiling)).toEqual({
      compiles: 'running',
      typeCases: 'pending',
      runtime: 'pending',
      rules: 'pending',
    });
    const testing: VerifierState = {
      ...compiling,
      phase: 'runtime',
      groups: {
        compiles: PASSED.compiles,
        typeCases: { ok: false, cases: [] },
        rules: PASSED.rules,
      },
    };
    expect(groupStatuses(testing)).toEqual({
      compiles: 'pass',
      typeCases: 'fail',
      runtime: 'running',
      rules: 'pass',
    });
  });
});

// §12 F7 criterion 6: "Compiles failing stops the other groups, with the reason shown."
describe('§12 F7: Compiles failing stops the other groups, with the reason shown', () => {
  const failed: ExerciseResult = {
    compiles: { ok: false, diagnostics: [diag('/index.ts', 13)] },
    typeCases: { ok: false, cases: [] },
    runtime: { ok: false, tests: [] },
    rules: { ok: false, hits: [] },
    passed: false,
  };

  it('marks the other three groups not-run with the reason, and Compiles failed and expanded', () => {
    const rows = buildRows(done(failed), [], NO_OVERRIDES);
    expect(kinds(rows)).toEqual([
      'group:compiles',
      'diagnostic',
      'group:typeCases',
      'group:runtime',
      'group:rules',
    ]);
    const groups = rows.filter((row) => row.kind === 'group');
    expect(groups.map((row) => [row.group, row.status, row.summary])).toEqual([
      ['compiles', 'fail', '1 error'],
      ['typeCases', 'not-run', NOT_RUN_REASON],
      ['runtime', 'not-run', NOT_RUN_REASON],
      ['rules', 'not-run', NOT_RUN_REASON],
    ]);
    expect(NOT_RUN_REASON).toBe('not run: fix the compile errors first');
  });

  it('says so in the verdict line', () => {
    expect(verdictLine(done(failed))).toEqual({
      kind: 'failed',
      text: 'Failed: Compiles failed, so the other groups did not run.',
    });
  });
});

// §12 F7 criterion 7: "The Tests tab shows the four groups; `j`/`k` move, `Enter` expands or
// jumps to the source." The keys live in the output pane; this is what they act on.
describe('§12 F7: the Tests tab shows the four groups; Enter expands or jumps to the source', () => {
  it('shows the four groups in §5 order, collapsed when they passed, with summaries', () => {
    const rows = buildRows(done(PASSED), [], NO_OVERRIDES);
    expect(
      rows.map((row) =>
        row.kind === 'group'
          ? [row.label, row.status, row.summary, row.expanded]
          : row.kind,
      ),
    ).toEqual([
      ['Compiles', 'pass', 'no errors', false],
      ['Type cases', 'pass', '2 of 2 cases pass', false],
      ['Runtime tests', 'pass', '1 of 1 tests pass', false],
      ['Rules', 'pass', 'no forbidden constructs', false],
    ]);
    expect(verdictLine(done(PASSED))).toEqual({
      kind: 'passed',
      text: 'Passed. :next opens the next exercise.',
    });
  });

  it('says "none in this exercise" for a group the exercise does not define (it counts as passed)', () => {
    const rows = buildRows(
      done({
        ...PASSED,
        typeCases: { ok: true, cases: [] },
        runtime: { ok: true, tests: [] },
      }),
      [],
      NO_OVERRIDES,
    );
    const summaries = rows.flatMap((row) =>
      row.kind === 'group' ? [[row.group, row.status, row.summary]] : [],
    );
    expect(summaries.slice(1, 3)).toEqual([
      ['typeCases', 'pass', 'none in this exercise'],
      ['runtime', 'pass', 'none in this exercise'],
    ]);
  });

  it('expands a failed group by default and lists its children; an override collapses or expands it', () => {
    const result: ExerciseResult = {
      compiles: { ok: true, diagnostics: [] },
      typeCases: {
        ok: false,
        cases: [
          { name: 'exactly', ok: false, diagnostics: [diag('/tests.ts', 4)] },
          { name: 'case 2', ok: true, diagnostics: [] },
          {
            name: 'case 3',
            ok: false,
            diagnostics: [diag('/tests.ts', 20, 2578)],
          },
        ],
      },
      runtime: {
        ok: false,
        tests: [
          { name: 'adds', status: 'pass', ms: 1 },
          {
            name: 'area of a square',
            status: 'fail',
            message: 'expected 0 to be 9',
            expected: '9',
            actual: '0',
            ms: 2,
          },
          { name: 'hangs', status: 'timeout', ms: 1001 },
        ],
      },
      rules: { ok: false, hits: [HIT] },
      passed: false,
    };
    const rows = buildRows(done(result), [], NO_OVERRIDES);
    expect(kinds(rows)).toEqual([
      'group:compiles',
      'group:typeCases',
      'case',
      'diagnostic',
      'case',
      'case',
      'diagnostic',
      'group:runtime',
      'test',
      'test',
      'test',
      'group:rules',
      'hit',
    ]);
    const summaries = rows.flatMap((row) =>
      row.kind === 'group' ? [row.summary] : [],
    );
    expect(summaries).toEqual([
      'no errors',
      '1 of 3 cases pass',
      '1 of 3 tests pass',
      '1 forbidden construct',
    ]);

    const overridden = buildRows(
      done(result),
      [],
      new Map([
        ['typeCases', false],
        ['compiles', true],
        ['runtime', false],
        ['rules', false],
      ]),
    );
    expect(kinds(overridden)).toEqual([
      'group:compiles',
      'group:typeCases',
      'group:runtime',
      'group:rules',
    ]);
  });

  it('lists the streamed tests under Runtime tests while they run', () => {
    const live: TestEntry[] = [
      { name: 'first', status: 'pass', ms: 1 },
      { name: 'hangs', status: 'timeout', ms: 1000 },
    ];
    const state: VerifierState = {
      run: 2,
      status: 'running',
      phase: 'runtime',
      groups: {
        compiles: PASSED.compiles,
        typeCases: PASSED.typeCases,
        rules: PASSED.rules,
      },
      result: null,
      error: null,
    };
    const rows = buildRows(state, live, NO_OVERRIDES);
    const runtime = rows.find(
      (row) => row.kind === 'group' && row.group === 'runtime',
    );
    expect(runtime).toMatchObject({
      status: 'running',
      expanded: true,
      summary: '2 finished',
    });
    expect(
      rows.flatMap((row) =>
        row.kind === 'test' ? [[row.test.name, row.test.status]] : [],
      ),
    ).toEqual([
      ['first', 'pass'],
      ['hangs', 'timeout'],
    ]);
    expect(verdictLine(state)).toEqual({
      kind: 'running',
      text: 'checking: Runtime tests',
    });
  });

  it('jumps to a diagnostic, a rule hit, a failed case and a failed or timed-out test; not to a group or a passed test', () => {
    const tests = [
      "import { area } from './index';",
      '',
      "test('adds', () => {});",
      'test("area of a square", () => {',
      '  expect(area(square)).toBe(9);',
      '});',
      '  test(`hangs`, () => new Promise<void>(() => {}));',
    ].join('\n');
    const locate = (name: string) => locateTest('/tests.ts', tests, name);
    const row = (value: TestsRow): TestsRow => value;
    expect(
      jumpTarget(
        row({
          kind: 'diagnostic',
          key: 'd',
          group: 'compiles',
          depth: 1,
          diag: diag('/index.ts', 13),
        }),
        locate,
      ),
    ).toEqual({ file: '/index.ts', line: 13, column: 5 });
    expect(
      jumpTarget(row({ kind: 'hit', key: 'h', hit: HIT }), locate),
    ).toEqual({ file: '/index.ts', line: 24, column: 13 });
    expect(
      jumpTarget(
        row({
          kind: 'case',
          key: 'c',
          typeCase: {
            name: 'case 3',
            ok: false,
            diagnostics: [diag('/tests.ts', 20, 2578)],
          },
        }),
        locate,
      ),
    ).toEqual({ file: '/tests.ts', line: 20, column: 5 });
    expect(
      jumpTarget(
        row({
          kind: 'case',
          key: 'c',
          typeCase: { name: 'case 2', ok: true, diagnostics: [] },
        }),
        locate,
      ),
    ).toBeNull();
    expect(
      jumpTarget(
        row({
          kind: 'test',
          key: 't',
          test: { name: 'area of a square', status: 'fail', ms: 1 },
        }),
        locate,
      ),
    ).toEqual({ file: '/tests.ts', line: 4, column: 1 });
    expect(
      jumpTarget(
        row({
          kind: 'test',
          key: 't',
          test: { name: 'hangs', status: 'timeout', ms: 1000 },
        }),
        locate,
      ),
    ).toEqual({ file: '/tests.ts', line: 7, column: 3 });
    expect(
      jumpTarget(
        row({
          kind: 'test',
          key: 't',
          test: { name: 'adds', status: 'pass', ms: 1 },
        }),
        locate,
      ),
    ).toBeNull();
    expect(
      jumpTarget(
        row({
          kind: 'test',
          key: 't',
          test: { name: '(run)', status: 'timeout', ms: 5000 },
        }),
        locate,
      ),
    ).toBeNull();
    const [group] = buildRows(done(PASSED), [], NO_OVERRIDES);
    expect(jumpTarget(group as TestsRow, locate)).toBeNull();
  });

  it('finds a test by its exact name only, regex characters included', () => {
    const text = "test('a.b', () => {});\ntest('a+b (c)', () => {});";
    expect(locateTest('/tests.ts', text, 'a+b (c)')).toEqual({
      file: '/tests.ts',
      line: 2,
      column: 1,
    });
    expect(locateTest('/tests.ts', text, 'axb')).toBeNull();
  });
});

describe('verdictLine', () => {
  it('names the failed groups, the idle prompt and an error', () => {
    expect(verdictLine(IDLE_VERIFIER)).toEqual({
      kind: 'idle',
      text: 'Run :test to check this exercise.',
    });
    expect(
      verdictLine(
        done({
          ...PASSED,
          typeCases: { ok: false, cases: [] },
          rules: { ok: false, hits: [HIT] },
          passed: false,
        }),
      ),
    ).toEqual({ kind: 'failed', text: 'Failed: Type cases, Rules.' });
    expect(
      verdictLine({
        ...IDLE_VERIFIER,
        run: 3,
        status: 'error',
        error: 'the compiler restarted',
      }),
    ).toEqual({
      kind: 'error',
      text: ':test could not finish: the compiler restarted',
    });
  });
});

describe('currentTestRun', () => {
  const previous = {
    status: { kind: 'done', durationMs: 4 },
    entries: [],
    tests: [{ name: 'old', status: 'pass', ms: 1 }],
    testSummary: { passed: 1, failed: 0, timedOut: 0, skipped: 0, ms: 1 },
    format: 'esm',
    run: 3,
  } as const satisfies RunState;

  it("hides the previous run's tests and status until this :test's own run starts", () => {
    expect(currentTestRun(previous, 3)).toEqual({
      ...previous,
      status: { kind: 'idle' },
      tests: [],
      testSummary: null,
    });
    const started = { ...previous, run: 4, tests: [] };
    expect(currentTestRun(started, 3)).toBe(started);
  });
});

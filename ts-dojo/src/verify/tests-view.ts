// The Tests tab as rows (§5 Verdict: "four rows with a check or a cross, expandable with
// `Enter`, navigable with `j`/`k`; `Enter` on a diagnostic, a failed test or a rule hit moves
// the cursor to it"). Pure: the output pane renders the rows and keeps the selection; this
// file decides what each group shows, which groups start expanded (a failed one, and Runtime
// tests while its results stream in), why a group did not run, and where `Enter` goes. A
// runtime test carries no position, so its target is the `test('name'` line in tests.ts.
import type { SourceLoc } from '@/protocol/sandbox';
import type { Diag, RuleHit, TypeCase } from '@/protocol/ts-ls';
import type { RunState, TestEntry } from '@/workers/sandbox/runner';
import { VERDICT_GROUPS, type GroupName } from './exercise';
import type { VerifierState } from './verifier';

export type GroupStatus = 'pass' | 'fail' | 'running' | 'not-run' | 'pending';

export const GROUP_LABELS: Record<GroupName, string> = {
  compiles: 'Compiles',
  typeCases: 'Type cases',
  runtime: 'Runtime tests',
  rules: 'Rules',
};

/** §5: "the other groups mean nothing on code that doesn't compile". */
export const NOT_RUN_REASON = 'not run: fix the compile errors first';

export type TestsRow =
  | {
      kind: 'group';
      key: string;
      group: GroupName;
      label: string;
      status: GroupStatus;
      summary: string;
      expanded: boolean;
    }
  | {
      kind: 'diagnostic';
      key: string;
      group: GroupName;
      /** 1 under a group, 2 under a type case. */
      depth: 1 | 2;
      diag: Diag;
    }
  | { kind: 'case'; key: string; typeCase: TypeCase }
  | { kind: 'test'; key: string; test: TestEntry }
  | { kind: 'hit'; key: string; hit: RuleHit };

export function groupStatuses(
  state: VerifierState,
): Record<GroupName, GroupStatus> {
  const { groups } = state;
  const compileFailed = groups.compiles !== undefined && !groups.compiles.ok;
  const status = (group: GroupName): GroupStatus => {
    if (state.status === 'idle') return 'pending';
    if (group !== 'compiles' && compileFailed) return 'not-run';
    const known = groups[group];
    if (known !== undefined) return known.ok ? 'pass' : 'fail';
    if (state.status === 'running') {
      return state.phase === group ? 'running' : 'pending';
    }
    // An error ended the run before this group was reached.
    return 'not-run';
  };
  return {
    compiles: status('compiles'),
    typeCases: status('typeCases'),
    runtime: status('runtime'),
    rules: status('rules'),
  };
}

/** A failed group opens on its own, and Runtime tests while results stream in. */
export function expandedByDefault(status: GroupStatus): boolean {
  return status === 'fail' || status === 'running';
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

function summary(
  group: GroupName,
  status: GroupStatus,
  state: VerifierState,
  live: readonly TestEntry[],
): string {
  if (status === 'pending') return 'waiting';
  if (status === 'not-run') {
    return state.status === 'error' ? 'not run' : NOT_RUN_REASON;
  }
  if (status === 'running') {
    return group === 'runtime' ? `${String(live.length)} finished` : 'checking';
  }
  const { groups } = state;
  switch (group) {
    case 'compiles': {
      const count = groups.compiles?.diagnostics.length ?? 0;
      return count === 0 ? 'no errors' : plural(count, 'error');
    }
    case 'typeCases': {
      const cases = groups.typeCases?.cases ?? [];
      if (cases.length === 0) return 'none in this exercise';
      const passed = cases.filter((c) => c.ok).length;
      return `${String(passed)} of ${String(cases.length)} cases pass`;
    }
    case 'runtime': {
      const tests = groups.runtime?.tests ?? [];
      if (tests.length === 0) {
        return status === 'pass'
          ? 'none in this exercise'
          : 'the tests did not run';
      }
      const passed = tests.filter(
        (t) => t.status === 'pass' || t.status === 'skip',
      ).length;
      return `${String(passed)} of ${String(tests.length)} tests pass`;
    }
    case 'rules': {
      const count = groups.rules?.hits.length ?? 0;
      return count === 0
        ? 'no forbidden constructs'
        : plural(count, 'forbidden construct');
    }
  }
}

function children(
  group: GroupName,
  state: VerifierState,
  live: readonly TestEntry[],
): TestsRow[] {
  const { groups } = state;
  switch (group) {
    case 'compiles':
      return (groups.compiles?.diagnostics ?? []).map((diag, i) => ({
        kind: 'diagnostic',
        key: `compiles:${String(i)}`,
        group,
        depth: 1,
        diag,
      }));
    case 'typeCases':
      return (groups.typeCases?.cases ?? []).flatMap(
        (typeCase, i): TestsRow[] => [
          { kind: 'case', key: `case:${String(i)}`, typeCase },
          ...typeCase.diagnostics.map((diag, j): TestsRow => ({
            kind: 'diagnostic',
            key: `case:${String(i)}:${String(j)}`,
            group,
            depth: 2,
            diag,
          })),
        ],
      );
    case 'runtime':
      return (groups.runtime?.tests ?? live).map((test, i) => ({
        kind: 'test',
        key: `test:${String(i)}`,
        test,
      }));
    case 'rules':
      return (groups.rules?.hits ?? []).map((hit, i) => ({
        kind: 'hit',
        key: `hit:${String(i)}`,
        hit,
      }));
  }
}

/**
 * The visible rows: the four groups in §5 order, each followed by its children when expanded.
 * `overrides` holds the groups the viewer toggled in this run; the rest follow the default.
 */
export function buildRows(
  state: VerifierState,
  live: readonly TestEntry[],
  overrides: ReadonlyMap<GroupName, boolean>,
): TestsRow[] {
  const statuses = groupStatuses(state);
  return VERDICT_GROUPS.flatMap((group): TestsRow[] => {
    const status = statuses[group];
    const expanded = overrides.get(group) ?? expandedByDefault(status);
    const row: TestsRow = {
      kind: 'group',
      key: `group:${group}`,
      group,
      label: GROUP_LABELS[group],
      status,
      summary: summary(group, status, state, live),
      expanded,
    };
    return expanded && status !== 'pending' && status !== 'not-run'
      ? [row, ...children(group, state, live)]
      : [row];
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The first `test('name'` (or `test.skip(`) line in tests.ts, any quote style. */
export function locateTest(
  path: string,
  text: string,
  name: string,
): SourceLoc | null {
  const pattern = new RegExp(
    `\\btest(?:\\.skip)?\\s*\\(\\s*(['"\`])${escapeRegExp(name)}\\1`,
  );
  const lines = text.split('\n');
  for (const [index, line] of lines.entries()) {
    const match = pattern.exec(line);
    if (match !== null) {
      return { file: path, line: index + 1, column: match.index + 1 };
    }
  }
  return null;
}

/** Where `Enter` moves the cursor; null for a group (it toggles) and for a row with no source. */
export function jumpTarget(
  row: TestsRow,
  locate: (testName: string) => SourceLoc | null,
): SourceLoc | null {
  switch (row.kind) {
    case 'group':
      return null;
    case 'diagnostic':
      return {
        file: row.diag.file,
        line: row.diag.line,
        column: row.diag.column,
      };
    case 'hit':
      return { file: row.hit.file, line: row.hit.line, column: row.hit.column };
    case 'case': {
      const first = row.typeCase.diagnostics[0];
      return row.typeCase.ok || first === undefined
        ? null
        : { file: first.file, line: first.line, column: first.column };
    }
    case 'test':
      return row.test.status === 'fail' || row.test.status === 'timeout'
        ? locate(row.test.name)
        : null;
  }
}

export interface VerdictLine {
  kind: 'idle' | 'running' | 'passed' | 'failed' | 'error';
  text: string;
}

/** The line under the four groups. §5: a pass shows "Passed" and the `:next` hint, nothing louder. */
export function verdictLine(state: VerifierState): VerdictLine {
  switch (state.status) {
    case 'idle':
      return { kind: 'idle', text: 'Run :test to check this exercise.' };
    case 'running':
      return {
        kind: 'running',
        text:
          state.phase === null
            ? 'checking'
            : `checking: ${GROUP_LABELS[state.phase]}`,
      };
    case 'error':
      return {
        kind: 'error',
        text: `:test could not finish: ${state.error ?? 'unknown error'}`,
      };
    case 'done': {
      const result = state.result;
      if (result === null) return { kind: 'failed', text: 'Failed.' };
      if (result.passed) {
        return {
          kind: 'passed',
          text: 'Passed. :next opens the next exercise.',
        };
      }
      if (!result.compiles.ok) {
        return {
          kind: 'failed',
          text: 'Failed: Compiles failed, so the other groups did not run.',
        };
      }
      const failed = VERDICT_GROUPS.filter((group) => !result[group].ok).map(
        (group) => GROUP_LABELS[group],
      );
      return { kind: 'failed', text: `Failed: ${failed.join(', ')}.` };
    }
  }
}

/**
 * The test run as the Tests tab may show it during one `:test`: the runner still holds the
 * previous run until this verification has compiled, emitted and started its own, so until
 * then (`run` not past the one recorded when `:test` began) its tests and status are hidden.
 */
export function currentTestRun(state: RunState, runAtStart: number): RunState {
  if (state.run > runAtStart) return state;
  return {
    ...state,
    status: { kind: 'idle' },
    tests: [],
    testSummary: null,
  };
}

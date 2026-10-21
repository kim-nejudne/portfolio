// The §5 verdict: the four groups (Compiles, Type cases, Runtime tests, Rules) assembled into
// an `ExerciseResult` for one attempt at an editor exercise. Compiles runs first and stops the
// rest when it fails ("the other groups mean nothing on code that doesn't compile"). Pure over
// two injected pieces: a `VerifyCore` (the ts-ls core's own methods in Node, the client's in
// the browser) and a `RuntimeTests` function that runs the emitted project in `mode: 'test'`
// and reports the run state (a `SandboxRunner` over the Node worker or the browser worker,
// through `runToCompletion`). The content lint uses it at F6; the lesson page's `:test` at F7,
// which follows the groups as they finish through `onProgress` (the Tests tab, §5 Verdict).
import { DEFAULT_TIMEOUT_MS, type RunMode } from '@/protocol/sandbox';
import type {
  Diag,
  EmitModuleKind,
  EmittedFile,
  OpenProjectSpec,
  ProjectFile,
  RuleHit,
  TypeCase,
} from '@/protocol/ts-ls';
import type { EditorExercise } from '@/content/build-registry';
import type {
  RunState,
  SandboxRunner,
  TestEntry,
} from '@/workers/sandbox/runner';
import { isTestFile, type RuleId } from './rules';

/** What the verdict needs from the compiler: the §2 requests the core and the client both answer. */
export interface VerifyCore {
  openProject(spec: OpenProjectSpec): Promise<void> | void;
  getDiagnostics(
    paths: string[],
  ): Promise<{ diagnostics: Diag[] }> | { diagnostics: Diag[] };
  runTypeTests(
    paths: string[],
  ):
    | Promise<{ cases: TypeCase[]; outsideCases: Diag[] }>
    | { cases: TypeCase[]; outsideCases: Diag[] };
  lintAst(
    paths: string[],
    rules: RuleId[],
  ): Promise<{ hits: RuleHit[] }> | { hits: RuleHit[] };
  emit(
    paths: string[],
    module?: EmitModuleKind,
  ): Promise<{ files: EmittedFile[] }> | { files: EmittedFile[] };
}

/** Runs the emitted project with tests.ts as the entry in test mode and reports how it ended. */
export type RuntimeTests = (
  modules: EmittedFile[],
  entry: string,
  timeoutMs: number,
) => Promise<RunState>;

/** The §5 verdict shape. */
export interface ExerciseResult {
  compiles: { ok: boolean; diagnostics: Diag[] };
  typeCases: { ok: boolean; cases: TypeCase[] };
  runtime: { ok: boolean; tests: TestEntry[] };
  rules: { ok: boolean; hits: RuleHit[] };
  /** All four ok. */
  passed: boolean;
}

/** The four §5 groups, in the order the Tests tab lists them. */
export const VERDICT_GROUPS = [
  'compiles',
  'typeCases',
  'runtime',
  'rules',
] as const;
export type GroupName = (typeof VERDICT_GROUPS)[number];

/** The groups known so far in one verification. */
export type PartialGroups = Partial<Pick<ExerciseResult, GroupName>>;

export interface VerifyProgress {
  /** The group being checked now; null once the verdict is complete. */
  phase: GroupName | null;
  groups: PartialGroups;
}

export interface VerifyOptions {
  /** Called when a phase starts and when the verdict is complete, with the groups known so far. */
  onProgress?: (progress: VerifyProgress) => void;
  /**
   * The runtime deadline for an exercise whose exercise.yaml names no `timeoutMs` (F10: the
   * Settings default timeout); 5 s when absent too, which is what the content lint uses.
   */
  defaultTimeoutMs?: number;
}

/** The note §5 attaches to a tests.ts diagnostic outside every case range. */
export const TEST_FILE_NOTE = 'test file does not compile';

/** §5 Rules: `explicit-any` is on by default for `type-challenge`; the always-on rules are the core's. */
export function rulesFor(
  exercise: Pick<EditorExercise, 'kind' | 'forbid'>,
): RuleId[] {
  const rules = new Set<RuleId>(exercise.forbid);
  if (exercise.kind === 'type-challenge') rules.add('explicit-any');
  return [...rules];
}

/** Whether the exercise's runtime group has anything to run (§1 pass rules). */
export function hasRuntimeTests(
  exercise: Pick<EditorExercise, 'kind' | 'tests'>,
): boolean {
  return exercise.tests !== undefined && exercise.kind !== 'type-challenge';
}

const NOT_RUN = { ok: false } as const;

/**
 * Verifies one attempt: `files` are the attempt's user files (the exercise's starter or solution
 * or the editor's current texts) plus its tests.ts; the lesson's `.d.ts` files and options
 * come from the exercise.
 */
export async function verifyExercise(
  core: VerifyCore,
  runtime: RuntimeTests,
  exercise: EditorExercise,
  files: ProjectFile[],
  options: VerifyOptions = {},
): Promise<ExerciseResult> {
  const groups: PartialGroups = {};
  const report = (phase: GroupName | null): void => {
    options.onProgress?.({ phase, groups: { ...groups } });
  };
  report('compiles');
  await core.openProject({
    compilerOptions: exercise.compilerOptions,
    files,
    libs: exercise.libs,
    dtsFiles: exercise.dts,
  });
  const paths = files.map((file) => file.path);
  const testPath = paths.find((path) => isTestFile(path));
  const userPaths = paths.filter((path) => path !== testPath);

  // Compiles: every user file, and tests.ts outside its case ranges.
  const diagnostics = [...(await core.getDiagnostics(userPaths)).diagnostics];
  let cases: TypeCase[] = [];
  if (testPath !== undefined) {
    const typeTests = await core.runTypeTests([testPath]);
    cases = typeTests.cases;
    diagnostics.push(
      ...typeTests.outsideCases.map((diag) => ({
        ...diag,
        message: `${TEST_FILE_NOTE}: ${diag.message}`,
      })),
    );
  }
  const compiles = { ok: diagnostics.length === 0, diagnostics };
  if (!compiles.ok) {
    const result: ExerciseResult = {
      compiles,
      typeCases: { ...NOT_RUN, cases: [] },
      runtime: { ...NOT_RUN, tests: [] },
      rules: { ...NOT_RUN, hits: [] },
      passed: false,
    };
    groups.compiles = compiles;
    report(null);
    return result;
  }

  const typeCases = { ok: cases.every((c) => c.ok), cases };
  groups.compiles = compiles;
  groups.typeCases = typeCases;
  report('rules');
  const { hits } = await core.lintAst(paths, rulesFor(exercise));
  const rules = { ok: hits.length === 0, hits };
  groups.rules = rules;

  let runtimeResult: ExerciseResult['runtime'] = { ok: true, tests: [] };
  if (testPath !== undefined && hasRuntimeTests(exercise)) {
    report('runtime');
    const { files: emitted } = await core.emit(paths);
    const state = await runtime(
      emitted,
      testPath,
      exercise.timeoutMs ?? options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    runtimeResult = runtimeGroup(state);
  }
  groups.runtime = runtimeResult;

  const passed = compiles.ok && typeCases.ok && runtimeResult.ok && rules.ok;
  report(null);
  return { compiles, typeCases, runtime: runtimeResult, rules, passed };
}

/**
 * The Runtime group from a finished run: every test passed or was skipped, the harness reached
 * its summary, and the run ended normally. A run that was killed, failed or threw while loading
 * gets one synthetic entry saying so, so the Tests tab can show the reason.
 */
export function runtimeGroup(state: RunState): ExerciseResult['runtime'] {
  const tests = [...state.tests];
  const errors = state.entries.filter((entry) => entry.kind === 'error');
  for (const error of errors) {
    tests.push({
      name: '(load)',
      status: 'fail',
      message: error.message,
      ms: 0,
    });
  }
  const { status } = state;
  if (status.kind === 'killed') {
    tests.push({
      name: '(run)',
      status: 'timeout',
      message: `killed after ${String(status.afterMs)} ms`,
      ms: status.afterMs,
    });
  } else if (status.kind === 'failed') {
    tests.push({
      name: '(run)',
      status: 'fail',
      message: status.message,
      ms: 0,
    });
  }
  const ok =
    status.kind === 'done' &&
    errors.length === 0 &&
    state.testSummary !== null &&
    tests.every((test) => test.status === 'pass' || test.status === 'skip');
  return { ok, tests };
}

/** Starts a run on the runner and resolves with the state once it is no longer running. */
export function runToCompletion(
  runner: SandboxRunner,
  modules: EmittedFile[],
  entry: string,
  options: { mode?: RunMode; timeoutMs?: number } = {},
): Promise<RunState> {
  return new Promise((resolve, reject) => {
    const check = (): void => {
      const { kind } = runner.state.status;
      if (
        kind === 'preparing' ||
        kind === 'running' ||
        kind === 'still-running'
      ) {
        return;
      }
      unsubscribe();
      resolve(runner.state);
    };
    const unsubscribe = runner.subscribe(check);
    runner.start(modules, entry, options).then(check, (error: unknown) => {
      unsubscribe();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

/** `RuntimeTests` over a sandbox runner, in test mode. */
export function runtimeTestsOn(runner: SandboxRunner): RuntimeTests {
  return (modules, entry, timeoutMs) =>
    runToCompletion(runner, modules, entry, { mode: 'test', timeoutMs });
}

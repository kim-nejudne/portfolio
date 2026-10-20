// The content lint (spec §3 Content lint): runs in Node with the same ts-ls core and sandbox
// modules the app uses, so a lesson passes here exactly when it passes in the browser. The
// structural conditions (1, 4, 5, 7) come from the shared registry builder and stop the lint
// when they fail; then every `ts run` fence must have zero diagnostics and every `ts twoslash`
// fence must render (6); then every editor exercise's solution must pass its own verdict (2)
// and its starter must fail it, a `fix` starter with at least one diagnostic (3). Every failure
// carries its §3 condition number and path; every exercise gets one report line.
import {
  runtimeTestsOn,
  VERDICT_GROUPS as GROUPS,
  verifyExercise,
  type ExerciseResult,
  type GroupName,
} from '@/verify/exercise';
import { createNodeSandboxRunner } from '@/workers/sandbox/node/spawn';
import { createTsLsCore } from '@/workers/ts-ls/core';
import { nodeFetchLib } from '@/workers/ts-ls/node/fetch-lib';
import {
  exerciseFiles,
  isEditorExercise,
  type EditorExercise,
  type Problem,
  type Registry,
} from '../build-registry';
import { loadContent } from './load';
import { createRenderer, FenceRenderError, type Renderer } from './mdx';

export type LintCondition = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LintFailure {
  condition: LintCondition;
  path: string;
  message: string;
}

export interface ExerciseReport {
  id: string;
  kind: EditorExercise['kind'];
  path: string;
  solution: ExerciseResult;
  starter: ExerciseResult;
  /** The §3 conditions this exercise failed (2 and 3), empty when it is fine. */
  failures: LintFailure[];
}

export interface LintReport {
  failures: LintFailure[];
  /** One per editor exercise that was verified (none when structural problems stopped the lint). */
  exercises: ExerciseReport[];
  /** Lesson ids whose fences were checked. */
  lessons: string[];
}

export interface LintOptions {
  /** Only ids starting with one of these (a module, lesson or exercise id). */
  only?: string[];
  /** Called as each exercise finishes, for the CLI's live output. */
  onExercise?: (report: ExerciseReport) => void;
}

export type { GroupName };

export const GROUP_LABEL: Record<GroupName, string> = {
  compiles: 'compiles',
  typeCases: 'types',
  runtime: 'runtime',
  rules: 'rules',
};

/** The groups a result passed, in §5 order. */
export function passedGroups(result: ExerciseResult): GroupName[] {
  return GROUPS.filter((group) => result[group].ok);
}

/** Why a result failed, one line: the first finding of the first failed group. */
export function describeFailure(result: ExerciseResult): string {
  if (!result.compiles.ok) {
    const first = result.compiles.diagnostics[0];
    return first === undefined
      ? 'does not compile'
      : `${first.file.slice(1)}:${String(first.line)} TS${String(first.code)}: ${first.message}`;
  }
  if (!result.typeCases.ok) {
    const failed = result.typeCases.cases.filter((c) => !c.ok);
    return `type case${failed.length === 1 ? '' : 's'} failed: ${failed.map((c) => c.name).join(', ')}`;
  }
  if (!result.runtime.ok) {
    const failed = result.runtime.tests.filter(
      (t) => t.status !== 'pass' && t.status !== 'skip',
    );
    const first = failed[0];
    return first === undefined
      ? 'runtime tests did not finish'
      : `runtime test "${first.name}" ${first.status}${first.message === undefined ? '' : `: ${first.message}`}`;
  }
  if (!result.rules.ok) {
    const first = result.rules.hits[0];
    return first === undefined
      ? 'a forbidden construct'
      : `${first.rule} at ${first.file.slice(1)}:${String(first.line)}: ${first.message}`;
  }
  return 'passed';
}

function matches(id: string, only: string[] | undefined): boolean {
  if (only === undefined || only.length === 0) return true;
  return only.some((prefix) => id === prefix || id.startsWith(`${prefix}/`));
}

function fromProblem(problem: Problem): LintFailure {
  return {
    condition: problem.condition,
    path: problem.path,
    message: problem.message,
  };
}

async function checkFences(
  registry: Registry,
  analyses: Awaited<ReturnType<typeof loadContent>>['analyses'],
  only: string[] | undefined,
  getRenderer: () => Promise<Renderer>,
): Promise<{ failures: LintFailure[]; lessons: string[] }> {
  const failures: LintFailure[] = [];
  const lessons: string[] = [];
  for (const lesson of registry.lessons) {
    if (!matches(lesson.id, only)) continue;
    lessons.push(lesson.id);
    const analysis = analyses[lesson.path];
    if (analysis === undefined) continue;
    for (const fence of analysis.fences) {
      if (fence.kind === 'run') {
        const diagnostics = await (await getRenderer()).check(fence.code);
        for (const diag of diagnostics) {
          failures.push({
            condition: 6,
            path: `${lesson.path}:${String(fence.line + diag.line)}`,
            message: `ts run block has a diagnostic: TS${String(diag.code)}: ${diag.message}`,
          });
        }
      } else if (fence.kind === 'twoslash') {
        try {
          await (
            await getRenderer()
          ).render('twoslash', fence.code, {
            path: lesson.path,
            line: fence.line,
          });
        } catch (error) {
          if (!(error instanceof FenceRenderError)) throw error;
          failures.push({
            condition: 6,
            path: `${lesson.path}:${String(fence.line)}`,
            message: error.message.replace(
              `${lesson.path}:${String(fence.line)}: `,
              '',
            ),
          });
        }
      }
    }
  }
  return { failures, lessons };
}

export async function lintContent(
  root: string,
  options: LintOptions = {},
): Promise<LintReport> {
  const { registry, problems, analyses } = await loadContent(root);
  if (problems.length > 0) {
    return { failures: problems.map(fromProblem), exercises: [], lessons: [] };
  }

  let renderer = null as Promise<Renderer> | null;
  const getRenderer = (): Promise<Renderer> => {
    renderer ??= createRenderer();
    return renderer;
  };
  const core = createTsLsCore({ fetchLib: nodeFetchLib });
  const runner = createNodeSandboxRunner((paths) =>
    Promise.resolve(core.emit(paths, 'commonjs').files),
  );
  const runtime = runtimeTestsOn(runner);
  try {
    const fences = await checkFences(
      registry,
      analyses,
      options.only,
      getRenderer,
    );
    const failures = [...fences.failures];
    const exercises: ExerciseReport[] = [];
    const editorExercises = registry.exercises.filter(
      (exercise): exercise is EditorExercise =>
        isEditorExercise(exercise) && matches(exercise.id, options.only),
    );
    if (editorExercises.length > 0) await core.init();
    for (const exercise of editorExercises) {
      const solution = await verifyExercise(
        core,
        runtime,
        exercise,
        exerciseFiles(exercise, 'solution'),
      );
      const starter = await verifyExercise(
        core,
        runtime,
        exercise,
        exerciseFiles(exercise, 'starter'),
      );
      const own: LintFailure[] = [];
      if (!solution.passed) {
        own.push({
          condition: 2,
          path: exercise.path,
          message: `solution does not pass: ${describeFailure(solution)}`,
        });
      }
      if (starter.passed) {
        own.push({
          condition: 3,
          path: exercise.path,
          message: 'starter already passes',
        });
      } else if (exercise.kind === 'fix' && starter.compiles.ok) {
        own.push({
          condition: 3,
          path: exercise.path,
          message: 'fix starter has no diagnostics',
        });
      }
      const report: ExerciseReport = {
        id: exercise.id,
        kind: exercise.kind,
        path: exercise.path,
        solution,
        starter,
        failures: own,
      };
      exercises.push(report);
      failures.push(...own);
      options.onExercise?.(report);
    }
    return { failures, exercises, lessons: fences.lessons };
  } finally {
    runner.dispose();
    core.dispose();
    if (renderer !== null) (await renderer).dispose();
  }
}

/** The first group a result failed, in §5 order; null for a pass. */
export function failedGroup(result: ExerciseResult): GroupName | null {
  return GROUPS.find((group) => !result[group].ok) ?? null;
}

/** The CLI's line for one exercise: the groups each side passed, or why not. */
export function formatExerciseLine(report: ExerciseReport): string {
  const mark = report.failures.length === 0 ? 'ok  ' : 'FAIL';
  const solution = report.solution.passed
    ? `solution passes (${passedGroups(report.solution)
        .map((g) => GROUP_LABEL[g])
        .join(' ')})`
    : `solution FAILS: ${describeFailure(report.solution)}`;
  const failed = failedGroup(report.starter);
  const starter =
    failed === null ? 'starter PASSES' : `starter fails ${GROUP_LABEL[failed]}`;
  return `${mark} ${report.id} [${report.kind}] ${solution}; ${starter}`;
}

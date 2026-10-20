// Turns the raw content tree into the typed registry (spec §2 Content registry, §3 Schemas and
// loading): every YAML file and lesson frontmatter through its Zod schema, ids checked unique,
// prerequisites resolved, folders matched to ids, exercise files paired. Pure: the browser
// feeds it the `import.meta.glob` maps (src/content/registry.ts) and the content lint feeds it
// the files read from disk (src/content/node/load.ts), so both see the same objects. Problems
// come back as a list tagged with the §3 lint condition they belong to, rather than throwing,
// so the lint can print all of them; the browser throws on the first one, which the build has
// already ruled out.
import type { z } from 'zod';
import type { ProjectFile } from '@/protocol/ts-ls';
import {
  contentIdKind,
  exerciseSchema,
  formatZodError,
  lessonFrontmatterSchema,
  moduleSchema,
  predictPropsSchema,
  renamesSchema,
  roadmapSchema,
  type EditorExerciseYaml,
  type LessonFrontmatter,
  type PredictExerciseYaml,
  type PredictProps,
} from './schema';

/** What a lesson.mdx contributes besides its component: the frontmatter and its `<Predict>` props, unvalidated. */
export interface LessonMeta {
  frontmatter: unknown;
  predicts: unknown[];
}

/** Paths are repository-relative: `content/modules/m03-unions/module.yaml`. */
export interface ContentInput {
  /** Parsed YAML by path. */
  yaml: Record<string, unknown>;
  /** Exercise file texts by path (starter/, solution/, tests.ts, types/*.d.ts). */
  files: Record<string, string>;
  /** Lesson meta by the lesson.mdx path. */
  lessons: Record<string, LessonMeta>;
}

export interface Tier {
  id: string;
  title: string;
  modules: string[];
}

export interface Module {
  id: string;
  tier: string;
  title: string;
  summary: string;
  prerequisites: string[];
  /** Full lesson ids, in order. */
  lessons: string[];
  path: string;
}

export interface Lesson extends LessonFrontmatter {
  module: string;
  folder: string;
  path: string;
  /** Exercise ids, in order. */
  exercises: string[];
  /** The inline Check yourself questions, in document order. */
  checks: PredictProps[];
}

interface ExerciseCommon {
  lesson: string;
  folder: string;
  path: string;
}

export interface EditorExercise extends EditorExerciseYaml, ExerciseCommon {
  starter: ProjectFile[];
  solution: ProjectFile[];
  /** The text of the `tests` file, when the exercise has one. */
  testsText?: string;
  /** `types/*.d.ts`, added to the project read-only. */
  dts: ProjectFile[];
}

export interface PredictExercise extends PredictExerciseYaml, ExerciseCommon {}

export type Exercise = EditorExercise | PredictExercise;

export interface Rename {
  from: string;
  to: string;
}

export interface Registry {
  tiers: Tier[];
  modules: Module[];
  lessons: Lesson[];
  exercises: Exercise[];
  renames: Rename[];
  module(id: string): Module | undefined;
  lesson(id: string): Lesson | undefined;
  exercise(id: string): Exercise | undefined;
}

/** The §3 lint conditions a structural problem can belong to. */
export type StructuralCondition = 1 | 4 | 5 | 7;

export interface Problem {
  condition: StructuralCondition;
  path: string;
  message: string;
}

export class ContentError extends Error {
  override readonly name = 'ContentError';
  readonly problems: Problem[];
  constructor(problems: Problem[]) {
    super(
      problems
        .map(
          (p) =>
            `${p.path}: ${p.message} (§3 condition ${String(p.condition)})`,
        )
        .join('\n'),
    );
    this.problems = problems;
  }
}

export const CONTENT_DIR = 'content';
export const MODULES_DIR = `${CONTENT_DIR}/modules`;
export const ROADMAP_PATH = `${CONTENT_DIR}/roadmap.yaml`;
export const RENAMES_PATH = `${CONTENT_DIR}/renames.yaml`;

/** The module whose lessons may have one exercise (§3 condition 4: "one in M00"). */
export const ONE_EXERCISE_MODULE_PREFIX = 'm00-';
export const MIN_EXERCISES = 2;
export const MIN_LESSONS = 3;
export const MAX_HINTS = 3;
export const MIN_OPTIONS = 2;

export function isEditorExercise(
  exercise: Exercise,
): exercise is EditorExercise {
  return exercise.kind !== 'predict';
}

interface Parsed<T> {
  ok: true;
  value: T;
}
interface Failed {
  ok: false;
}

function parseWith<T>(
  schema: z.ZodType<T>,
  data: unknown,
  path: string,
  problems: Problem[],
): Parsed<T> | Failed {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  problems.push({ condition: 1, path, message: formatZodError(result.error) });
  return { ok: false };
}

/** `a/b/c` → `c`. */
function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Folder names under `dir`, from the paths that start with `dir/`. */
function childFolders(paths: Iterable<string>, dir: string): string[] {
  const folders = new Set<string>();
  const prefix = `${dir}/`;
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash > 0) folders.add(rest.slice(0, slash));
  }
  return [...folders].sort();
}

/** Finds a cycle in a directed graph; returns it as a path of ids, or null. */
export function findCycle(
  edges: Map<string, readonly string[]>,
): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    const seen = state.get(id);
    if (seen === 'done') return null;
    if (seen === 'visiting') {
      const start = stack.indexOf(id);
      return [...stack.slice(start), id];
    }
    state.set(id, 'visiting');
    stack.push(id);
    for (const next of edges.get(id) ?? []) {
      if (!edges.has(next)) continue;
      const cycle = visit(next);
      if (cycle !== null) return cycle;
    }
    stack.pop();
    state.set(id, 'done');
    return null;
  };
  for (const id of edges.keys()) {
    const cycle = visit(id);
    if (cycle !== null) return cycle;
  }
  return null;
}

export function buildRegistry(input: ContentInput): {
  registry: Registry;
  problems: Problem[];
} {
  const problems: Problem[] = [];
  const allPaths = [
    ...Object.keys(input.yaml),
    ...Object.keys(input.files),
    ...Object.keys(input.lessons),
  ];
  const tiers: Tier[] = [];
  const modules: Module[] = [];
  const lessons: Lesson[] = [];
  const exercises: Exercise[] = [];
  const ids = new Map<string, string>();
  const claim = (id: string, path: string): boolean => {
    const owner = ids.get(id);
    if (owner !== undefined) {
      problems.push({
        condition: 1,
        path,
        message: `duplicate id ${id} (also ${owner})`,
      });
      return false;
    }
    ids.set(id, path);
    return true;
  };

  // roadmap.yaml
  const roadmapYaml = input.yaml[ROADMAP_PATH];
  if (roadmapYaml === undefined) {
    problems.push({
      condition: 1,
      path: ROADMAP_PATH,
      message: 'missing roadmap.yaml',
    });
  }
  const roadmap =
    roadmapYaml === undefined
      ? { ok: false as const }
      : parseWith(roadmapSchema, roadmapYaml, ROADMAP_PATH, problems);
  const roadmapModules: { id: string; tier: string }[] = [];
  if (roadmap.ok) {
    for (const tier of roadmap.value.tiers) {
      claim(tier.id, ROADMAP_PATH);
      tiers.push({
        id: tier.id,
        title: tier.title,
        modules: [...tier.modules],
      });
      for (const id of tier.modules) roadmapModules.push({ id, tier: tier.id });
    }
  }

  // renames.yaml
  let renames: Rename[] = [];
  const renamesYaml = input.yaml[RENAMES_PATH];
  if (renamesYaml !== undefined) {
    const parsed = parseWith(
      renamesSchema,
      renamesYaml,
      RENAMES_PATH,
      problems,
    );
    if (parsed.ok) {
      renames = Object.entries(parsed.value).map(([from, to]) => ({
        from,
        to,
      }));
    }
  }

  // modules, in roadmap order; folders the roadmap does not list are reported.
  const moduleFolders = childFolders(allPaths, MODULES_DIR);
  for (const folder of moduleFolders) {
    if (!roadmapModules.some((m) => m.id === folder)) {
      problems.push({
        condition: 1,
        path: `${MODULES_DIR}/${folder}/module.yaml`,
        message: `module folder ${folder} is not on the roadmap`,
      });
    }
  }
  for (const { id: moduleId, tier } of roadmapModules) {
    const moduleDir = `${MODULES_DIR}/${moduleId}`;
    const modulePath = `${moduleDir}/module.yaml`;
    const moduleYaml = input.yaml[modulePath];
    if (moduleYaml === undefined) {
      problems.push({
        condition: 1,
        path: ROADMAP_PATH,
        message: `module ${moduleId} has no ${modulePath}`,
      });
      continue;
    }
    const parsed = parseWith(moduleSchema, moduleYaml, modulePath, problems);
    if (!parsed.ok) continue;
    const yaml = parsed.value;
    if (yaml.id !== moduleId) {
      problems.push({
        condition: 7,
        path: modulePath,
        message: `id ${yaml.id} does not match its folder ${moduleId}`,
      });
    }
    if (!claim(yaml.id, modulePath)) continue;
    const lessonFolders = childFolders(allPaths, moduleDir).filter(
      (f) => f !== 'module.yaml',
    );
    for (const folder of lessonFolders) {
      if (!yaml.lessons.includes(folder)) {
        problems.push({
          condition: 1,
          path: modulePath,
          message: `lesson folder ${folder} is not listed in lessons`,
        });
      }
    }
    if (yaml.lessons.length < MIN_LESSONS) {
      problems.push({
        condition: 4,
        path: modulePath,
        message: `module has ${String(yaml.lessons.length)} lessons; at least ${String(MIN_LESSONS)} are needed`,
      });
    }
    const module: Module = {
      id: yaml.id,
      tier,
      title: yaml.title,
      summary: yaml.summary,
      prerequisites: yaml.prerequisites,
      lessons: [],
      path: modulePath,
    };
    modules.push(module);

    for (const lessonFolder of yaml.lessons) {
      const lessonDir = `${moduleDir}/${lessonFolder}`;
      const lessonPath = `${lessonDir}/lesson.mdx`;
      const meta = input.lessons[lessonPath];
      if (meta === undefined) {
        problems.push({
          condition: 1,
          path: modulePath,
          message: `lesson ${lessonFolder} has no ${lessonPath}`,
        });
        continue;
      }
      const front = parseWith(
        lessonFrontmatterSchema,
        meta.frontmatter,
        lessonPath,
        problems,
      );
      if (!front.ok) continue;
      const expectedId = `${moduleId}/${lessonFolder}`;
      if (front.value.id !== expectedId) {
        problems.push({
          condition: 7,
          path: lessonPath,
          message: `id ${front.value.id} does not match its folder ${expectedId}`,
        });
      }
      if (!claim(front.value.id, lessonPath)) continue;
      const checks: PredictProps[] = [];
      const checkIds = new Set<string>();
      for (const props of meta.predicts) {
        const result = predictPropsSchema.safeParse(props);
        if (!result.success) {
          problems.push({
            condition: 5,
            path: lessonPath,
            message: `<Predict>: ${formatZodError(result.error)}`,
          });
          continue;
        }
        const check = result.data;
        if (checkIds.has(check.id)) {
          problems.push({
            condition: 5,
            path: lessonPath,
            message: `<Predict id="${check.id}"> appears twice`,
          });
        }
        checkIds.add(check.id);
        problems.push(
          ...predictProblems(check, lessonPath, `<Predict id="${check.id}">`),
        );
        checks.push(check);
      }
      const lesson: Lesson = {
        ...front.value,
        module: moduleId,
        folder: lessonFolder,
        path: lessonPath,
        exercises: [],
        checks,
      };
      lessons.push(lesson);
      module.lessons.push(lesson.id);

      const exerciseFolders = childFolders(allPaths, `${lessonDir}/exercises`);
      const minExercises = moduleId.startsWith(ONE_EXERCISE_MODULE_PREFIX)
        ? 1
        : MIN_EXERCISES;
      if (exerciseFolders.length < minExercises) {
        problems.push({
          condition: 4,
          path: lessonPath,
          message: `lesson has ${String(exerciseFolders.length)} exercises; at least ${String(minExercises)} are needed`,
        });
      }
      for (const exerciseFolder of exerciseFolders) {
        const exerciseDir = `${lessonDir}/exercises/${exerciseFolder}`;
        const exercisePath = `${exerciseDir}/exercise.yaml`;
        const exerciseYaml = input.yaml[exercisePath];
        if (exerciseYaml === undefined) {
          problems.push({
            condition: 1,
            path: exercisePath,
            message: 'missing exercise.yaml',
          });
          continue;
        }
        const parsedExercise = parseWith(
          exerciseSchema,
          exerciseYaml,
          exercisePath,
          problems,
        );
        if (!parsedExercise.ok) continue;
        const ex = parsedExercise.value;
        const expectedExerciseId = `${lesson.id}/${exerciseFolder}`;
        if (ex.id !== expectedExerciseId) {
          problems.push({
            condition: 7,
            path: exercisePath,
            message: `id ${ex.id} does not match its folder ${expectedExerciseId}`,
          });
        }
        if (!claim(ex.id, exercisePath)) continue;
        const common: ExerciseCommon = {
          lesson: lesson.id,
          folder: exerciseFolder,
          path: exercisePath,
        };
        if (ex.kind === 'predict') {
          problems.push(
            ...predictProblems(ex, exercisePath, 'predict exercise'),
          );
          exercises.push({ ...ex, ...common });
        } else {
          const built = buildEditorExercise(
            ex,
            common,
            exerciseDir,
            input.files,
            problems,
          );
          if (built !== null) exercises.push(built);
        }
        lesson.exercises.push(ex.id);
      }
    }
  }

  // Prerequisites: every target exists, and no cycles.
  const moduleIds = new Set(modules.map((m) => m.id));
  const moduleEdges = new Map<string, readonly string[]>();
  for (const module of modules) {
    moduleEdges.set(module.id, module.prerequisites);
    for (const prerequisite of module.prerequisites) {
      if (!moduleIds.has(prerequisite)) {
        problems.push({
          condition: 1,
          path: module.path,
          message: `prerequisite ${prerequisite} does not exist`,
        });
      }
    }
  }
  const moduleCycle = findCycle(moduleEdges);
  if (moduleCycle !== null) {
    problems.push({
      condition: 1,
      path: modules.find((m) => m.id === moduleCycle[0])?.path ?? MODULES_DIR,
      message: `prerequisite cycle: ${moduleCycle.join(' → ')}`,
    });
  }
  const lessonIds = new Set(lessons.map((l) => l.id));
  const lessonEdges = new Map<string, readonly string[]>();
  for (const lesson of lessons) {
    lessonEdges.set(lesson.id, lesson.prerequisites);
    for (const prerequisite of lesson.prerequisites) {
      if (!lessonIds.has(prerequisite)) {
        problems.push({
          condition: 1,
          path: lesson.path,
          message: `prerequisite ${prerequisite} does not exist`,
        });
      }
    }
  }
  const lessonCycle = findCycle(lessonEdges);
  if (lessonCycle !== null) {
    problems.push({
      condition: 1,
      path: lessons.find((l) => l.id === lessonCycle[0])?.path ?? MODULES_DIR,
      message: `prerequisite cycle: ${lessonCycle.join(' → ')}`,
    });
  }
  const exerciseIds = new Set(exercises.map((e) => e.id));
  for (const rename of renames) {
    const targets =
      contentIdKind(rename.to) === 'lesson' ? lessonIds : exerciseIds;
    if (!targets.has(rename.to)) {
      problems.push({
        condition: 7,
        path: RENAMES_PATH,
        message: `rename target ${rename.to} does not exist`,
      });
    }
  }

  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  return {
    registry: {
      tiers,
      modules,
      lessons,
      exercises,
      renames,
      module: (id) => moduleById.get(id),
      lesson: (id) => lessonById.get(id),
      exercise: (id) => exerciseById.get(id),
    },
    problems,
  };
}

/** §3 condition 5 for a predict exercise or an inline `<Predict>`: 2–5 options, exactly one correct. */
function predictProblems(
  predict: { options: string[]; answer: number },
  path: string,
  what: string,
): Problem[] {
  const problems: Problem[] = [];
  if (predict.options.length < MIN_OPTIONS) {
    problems.push({
      condition: 5,
      path,
      message: `${what} has ${String(predict.options.length)} options; at least ${String(MIN_OPTIONS)} are needed`,
    });
  }
  if (predict.options.length > 5) {
    problems.push({
      condition: 5,
      path,
      message: `${what} has ${String(predict.options.length)} options; at most 5 are allowed`,
    });
  }
  if (predict.answer >= predict.options.length) {
    problems.push({
      condition: 5,
      path,
      message: `${what}: answer ${String(predict.answer)} names no option, so none is correct`,
    });
  }
  return problems;
}

function buildEditorExercise(
  ex: EditorExerciseYaml,
  common: ExerciseCommon,
  dir: string,
  files: Record<string, string>,
  problems: Problem[],
): EditorExercise | null {
  const path = common.path;
  if (ex.hints.length === 0) {
    problems.push({
      condition: 4,
      path,
      message: 'editor exercise without hints',
    });
  }
  if (ex.hints.length > MAX_HINTS) {
    problems.push({
      condition: 4,
      path,
      message: `${String(ex.hints.length)} hints; at most ${String(MAX_HINTS)} are allowed`,
    });
  }
  const collect = (sub: string): ProjectFile[] => {
    const prefix = `${dir}/${sub}/`;
    return Object.keys(files)
      .filter((p) => p.startsWith(prefix))
      .sort()
      .map((p) => ({
        path: `/${p.slice(prefix.length)}`,
        text: files[p] as string,
      }));
  };
  const starter = collect('starter');
  const solution = collect('solution');
  const dts = collect('types').map((f) => ({
    ...f,
    path: `/types${f.path}`,
  }));
  let ok = true;
  const starterNames = starter.map((f) => f.path).join(', ');
  const solutionNames = solution.map((f) => f.path).join(', ');
  if (starter.length === 0) {
    problems.push({ condition: 1, path, message: 'starter/ has no files' });
    ok = false;
  }
  if (starterNames !== solutionNames) {
    problems.push({
      condition: 1,
      path,
      message: `starter/ (${starterNames}) and solution/ (${solutionNames}) must hold the same file names`,
    });
    ok = false;
  }
  if (!starter.some((f) => f.path === `/${ex.entry}`)) {
    problems.push({
      condition: 1,
      path,
      message: `entry ${ex.entry} is not among the starter files`,
    });
    ok = false;
  }
  if (dts.some((f) => !f.path.endsWith('.d.ts'))) {
    problems.push({
      condition: 1,
      path,
      message: 'types/ may hold only .d.ts files',
    });
    ok = false;
  }
  let testsText: string | undefined;
  if (ex.tests !== undefined) {
    testsText = files[`${dir}/${ex.tests}`];
    if (testsText === undefined) {
      problems.push({
        condition: 1,
        path,
        message: `tests file ${ex.tests} is missing`,
      });
      ok = false;
    } else if (basename(ex.tests) !== 'tests.ts') {
      // §5 names the file: the rules and the case walk key on it.
      problems.push({
        condition: 1,
        path,
        message: `tests must be tests.ts, not ${ex.tests}`,
      });
      ok = false;
    }
  } else if (ex.kind !== 'fix') {
    problems.push({
      condition: 1,
      path,
      message: `a ${ex.kind} exercise needs a tests file`,
    });
    ok = false;
  }
  if (!ok) return null;
  const exercise: EditorExercise = { ...ex, ...common, starter, solution, dts };
  if (testsText !== undefined) exercise.testsText = testsText;
  return exercise;
}

/** The project files of an attempt: the user's files, then tests.ts (§5). */
export function exerciseFiles(
  exercise: EditorExercise,
  which: 'starter' | 'solution',
): ProjectFile[] {
  const files = [...exercise[which]];
  if (exercise.tests !== undefined && exercise.testsText !== undefined) {
    files.push({ path: `/${exercise.tests}`, text: exercise.testsText });
  }
  return files;
}

// Playwright helpers for F9 (spec §3 Layout, `roadmap.yaml`, `module.yaml`, `lesson.mdx`,
// `exercise.yaml`; §7 Content versions): a whole course as the repository holds it, read at
// test time so the roadmap, module page and /progress tests follow the content instead of
// hard-coding it. Tiers in `roadmap.yaml` order, each module's `module.yaml`, each lesson's
// frontmatter (title, minutes, objectives, prerequisites, optional), each exercise's YAML, the course
// order (tiers, then modules, then lessons, then exercise folders sorted, as the registry
// builds it), and the §7 `contentVersion` computed in Node by the build's own function.
// The plain exports read the fixture course the suite's server builds (fixtures/content/);
// `courseAt(COURSE_CONTENT)` reads the course in content/ for the course spec (F11), which
// also reads each lesson.mdx whole and each editor exercise's solution files.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { contentVersion } from '../../src/content/node/content-version';
import { COURSE_CONTENT, FIXTURE_CONTENT } from '../../src/content/node/roots';

export { COURSE_CONTENT };

/** The fixture course, which the suite's server on 4173 serves. */
export const CONTENT_DIR = FIXTURE_CONTENT;

export interface TierYaml {
  id: string;
  title: string;
  modules: string[];
}

export interface ModuleYaml {
  id: string;
  title: string;
  summary: string;
  prerequisites: string[];
  /** Lesson folders, in order. */
  lessons: string[];
}

export interface LessonFrontmatter {
  id: string;
  title: string;
  minutes: number;
  objectives: string[];
  prerequisites: string[];
  /** Pre-F13 fixes: tagged "optional" and left out of module completion. */
  optional: boolean;
}

export interface CourseExerciseYaml {
  id: string;
  kind: 'fix' | 'implement' | 'type-challenge' | 'predict';
  title: string;
  minutes: number;
  challenge?: boolean;
  hints?: string[];
  /** `predict` only (§3): the snippet, the question, 2–5 options, the right one, why. */
  code?: string;
  question?: string;
  options?: string[];
  answer?: number;
  explanation?: string;
}

/** The readers over the course under `dir`. */
export function courseAt(dir: string) {
  function readYaml<T>(path: string): T {
    return parse(readFileSync(`${dir}/${path}`, 'utf8')) as T;
  }

  function readTiers(): TierYaml[] {
    return readYaml<{ tiers: TierYaml[] }>('roadmap.yaml').tiers;
  }

  function readModule(moduleId: string): ModuleYaml {
    return readYaml<ModuleYaml>(`modules/${moduleId}/module.yaml`);
  }

  /** `m98-fixture-sequel` → its lesson ids, `m98-fixture-sequel/01-literal-widening`, in order. */
  function moduleLessons(moduleId: string): string[] {
    return readModule(moduleId).lessons.map(
      (folder) => `${moduleId}/${folder}`,
    );
  }

  /** The frontmatter of `content/modules/<lesson id>/lesson.mdx`. */
  function readLesson(lessonId: string): LessonFrontmatter {
    const mdx = readFileSync(`${dir}/modules/${lessonId}/lesson.mdx`, 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(mdx);
    if (match === null)
      throw new Error(`${lessonId}/lesson.mdx: no frontmatter`);
    const front = parse(match[1] as string) as Partial<LessonFrontmatter>;
    return {
      id: front.id ?? lessonId,
      title: front.title ?? '',
      minutes: front.minutes ?? 0,
      objectives: front.objectives ?? [],
      prerequisites: front.prerequisites ?? [],
      optional: front.optional === true,
    };
  }

  /**
   * The lessons a module's counts and completion rest on: those not `optional`, or all of them
   * when the module has no other kind (src/store/completion.ts).
   */
  function coreLessons(moduleId: string): string[] {
    const lessons = moduleLessons(moduleId);
    const core = lessons.filter((id) => !readLesson(id).optional);
    return core.length > 0 ? core : lessons;
  }

  /** A lesson's exercise folders, sorted (the registry's order). */
  function exerciseFolders(lessonId: string): string[] {
    return readdirSync(`${dir}/modules/${lessonId}/exercises`, {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }

  /** `m/l/e` → the exercise's YAML. */
  function readExercise(exerciseId: string): CourseExerciseYaml {
    const [module, lesson, folder] = exerciseId.split('/');
    return readYaml<CourseExerciseYaml>(
      `modules/${module ?? ''}/${lesson ?? ''}/exercises/${folder ?? ''}/exercise.yaml`,
    );
  }

  /** Whether the lesson's `lesson.mdx` and `exercises/` are on disk. */
  function lessonExists(lessonId: string): boolean {
    return (
      existsSync(`${dir}/modules/${lessonId}/lesson.mdx`) &&
      existsSync(`${dir}/modules/${lessonId}/exercises`)
    );
  }

  /** `modules/<lesson id>/lesson.mdx` as the repository holds it. */
  function lessonMdx(lessonId: string): string {
    return readFileSync(`${dir}/modules/${lessonId}/lesson.mdx`, 'utf8');
  }

  /**
   * An editor exercise's `solution/` files, nested ones included, keyed by the path the editor
   * gives the file (`/index.ts`; §3: `starter/` and `solution/` hold the same file names).
   */
  function solutionFiles(exerciseId: string): Record<string, string> {
    const root = `${dir}/modules/${lessonOf(exerciseId)}/exercises/${folderOf(exerciseId)}/solution`;
    return Object.fromEntries(
      readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const full = path.join(entry.parentPath, entry.name);
          const relative = path.relative(root, full).split(path.sep).join('/');
          return [`/${relative}`, readFileSync(full, 'utf8')] as const;
        })
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }

  /** Every module id, in roadmap order. */
  function courseModules(): string[] {
    return readTiers().flatMap((tier) => tier.modules);
  }

  /** Every lesson id, in course order. */
  function courseLessons(): string[] {
    return courseModules().flatMap(moduleLessons);
  }

  /** Every module's core lessons, in course order: what the /progress totals count. */
  function courseCoreLessons(): string[] {
    return courseModules().flatMap(coreLessons);
  }

  /** Every exercise id, in course order. */
  function courseExercises(): string[] {
    return courseLessons().flatMap((lessonId) =>
      exerciseFolders(lessonId).map((folder) => `${lessonId}/${folder}`),
    );
  }

  /** The summed `minutes` of these lessons. */
  function minutesOf(lessonIds: readonly string[]): number {
    return lessonIds.reduce((sum, id) => sum + readLesson(id).minutes, 0);
  }

  /** `/l/<id>` for a lesson or an exercise id. */
  function routeOf(id: string): string {
    return `/l/${id}`;
  }

  /** The last segment of an exercise id: its folder. */
  function folderOf(exerciseId: string): string {
    return exerciseId.split('/')[2] ?? '';
  }

  /** The lesson id of an exercise id. */
  function lessonOf(exerciseId: string): string {
    return exerciseId.split('/').slice(0, 2).join('/');
  }

  /** The §7 `contentVersion` of the repository's content tree, as the build computes it. */
  function contentHash(): Promise<string> {
    return contentVersion(dir);
  }

  /** `content/renames.yaml` (§7 `old: new`), in file order. */
  function readRenames(): [from: string, to: string][] {
    return Object.entries(
      readYaml<Record<string, string> | null>('renames.yaml') ?? {},
    );
  }

  return {
    readTiers,
    readModule,
    moduleLessons,
    coreLessons,
    readLesson,
    exerciseFolders,
    readExercise,
    lessonExists,
    lessonMdx,
    solutionFiles,
    courseModules,
    courseLessons,
    courseCoreLessons,
    courseExercises,
    minutesOf,
    routeOf,
    folderOf,
    lessonOf,
    contentHash,
    readRenames,
  };
}

export const {
  readTiers,
  readModule,
  moduleLessons,
  coreLessons,
  readLesson,
  exerciseFolders,
  readExercise,
  courseModules,
  courseLessons,
  courseCoreLessons,
  courseExercises,
  minutesOf,
  routeOf,
  folderOf,
  lessonOf,
  contentHash,
  readRenames,
} = courseAt(CONTENT_DIR);

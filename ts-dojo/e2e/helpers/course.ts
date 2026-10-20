// Playwright helpers for F9 (spec §3 Layout, `roadmap.yaml`, `module.yaml`, `lesson.mdx`,
// `exercise.yaml`; §7 Content versions): the whole course as the repository holds it, read at
// test time so the roadmap, module page and /progress tests follow the content instead of
// hard-coding it. Tiers in `roadmap.yaml` order, each module's `module.yaml`, each lesson's
// frontmatter (title, minutes, objectives, prerequisites), each exercise's YAML, the course
// order (tiers, then modules, then lessons, then exercise folders sorted, as the registry
// builds it), and the §7 `contentVersion` computed in Node by the build's own function.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { contentVersion } from '../../src/content/node/content-version';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const CONTENT_DIR = `${REPO_ROOT}content`;

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
}

export interface CourseExerciseYaml {
  id: string;
  kind: 'fix' | 'implement' | 'type-challenge' | 'predict';
  title: string;
  minutes: number;
  challenge?: boolean;
  hints?: string[];
  options?: string[];
  answer?: number;
}

function readYaml<T>(path: string): T {
  return parse(readFileSync(`${CONTENT_DIR}/${path}`, 'utf8')) as T;
}

export function readTiers(): TierYaml[] {
  return readYaml<{ tiers: TierYaml[] }>('roadmap.yaml').tiers;
}

export function readModule(moduleId: string): ModuleYaml {
  return readYaml<ModuleYaml>(`modules/${moduleId}/module.yaml`);
}

/** `m98-fixture-sequel` → its lesson ids, `m98-fixture-sequel/01-literal-widening`, in order. */
export function moduleLessons(moduleId: string): string[] {
  return readModule(moduleId).lessons.map((folder) => `${moduleId}/${folder}`);
}

/** The frontmatter of `content/modules/<lesson id>/lesson.mdx`. */
export function readLesson(lessonId: string): LessonFrontmatter {
  const mdx = readFileSync(
    `${CONTENT_DIR}/modules/${lessonId}/lesson.mdx`,
    'utf8',
  );
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(mdx);
  if (match === null) throw new Error(`${lessonId}/lesson.mdx: no frontmatter`);
  const front = parse(match[1] as string) as Partial<LessonFrontmatter>;
  return {
    id: front.id ?? lessonId,
    title: front.title ?? '',
    minutes: front.minutes ?? 0,
    objectives: front.objectives ?? [],
    prerequisites: front.prerequisites ?? [],
  };
}

/** A lesson's exercise folders, sorted (the registry's order). */
export function exerciseFolders(lessonId: string): string[] {
  return readdirSync(`${CONTENT_DIR}/modules/${lessonId}/exercises`, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** `m/l/e` → the exercise's YAML. */
export function readExercise(exerciseId: string): CourseExerciseYaml {
  const [module, lesson, folder] = exerciseId.split('/');
  return readYaml<CourseExerciseYaml>(
    `modules/${module ?? ''}/${lesson ?? ''}/exercises/${folder ?? ''}/exercise.yaml`,
  );
}

/** Every module id, in roadmap order. */
export function courseModules(): string[] {
  return readTiers().flatMap((tier) => tier.modules);
}

/** Every lesson id, in course order. */
export function courseLessons(): string[] {
  return courseModules().flatMap(moduleLessons);
}

/** Every exercise id, in course order. */
export function courseExercises(): string[] {
  return courseLessons().flatMap((lessonId) =>
    exerciseFolders(lessonId).map((folder) => `${lessonId}/${folder}`),
  );
}

/** The summed `minutes` of these lessons. */
export function minutesOf(lessonIds: readonly string[]): number {
  return lessonIds.reduce((sum, id) => sum + readLesson(id).minutes, 0);
}

/** `/l/<id>` for a lesson or an exercise id. */
export function routeOf(id: string): string {
  return `/l/${id}`;
}

/** The last segment of an exercise id: its folder. */
export function folderOf(exerciseId: string): string {
  return exerciseId.split('/')[2] ?? '';
}

/** The lesson id of an exercise id. */
export function lessonOf(exerciseId: string): string {
  return exerciseId.split('/').slice(0, 2).join('/');
}

/** The §7 `contentVersion` of the repository's content tree, as the build computes it. */
export function contentHash(): Promise<string> {
  return contentVersion(CONTENT_DIR);
}

/** `content/renames.yaml` (§7 `old: new`), in file order. */
export function readRenames(): [from: string, to: string][] {
  return Object.entries(
    readYaml<Record<string, string> | null>('renames.yaml') ?? {},
  );
}

// Lesson ids contain a slash (`m03-unions/05-discriminated-unions`, spec §3), so the §6 routes
// `/l/:lesson` and `/l/:lesson/:exercise` cannot be single-segment params: the router matches
// `l/*` and this splits the rest. The URLs the browser shows are exactly the §6 shapes.
export interface LessonPath {
  lesson: string;
  exercise?: string;
}

export function parseLessonPath(splat: string | undefined): LessonPath | null {
  if (splat === undefined) return null;
  const segments = splat.split('/').filter((segment) => segment.length > 0);
  const [module, lesson, exercise, ...rest] = segments;
  if (module === undefined || lesson === undefined || rest.length > 0) {
    return null;
  }
  const id = `${module}/${lesson}`;
  return exercise === undefined ? { lesson: id } : { lesson: id, exercise };
}

export function lessonHref(lesson: string, exercise?: string): string {
  return exercise === undefined ? `/l/${lesson}` : `/l/${lesson}/${exercise}`;
}

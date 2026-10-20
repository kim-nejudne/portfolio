// The content registry in the browser (spec §2 Content registry): `content/` read at build time
// with `import.meta.glob`, every YAML file already validated and turned into JSON by the Vite
// plugin (src/content/node/vite-plugin.ts), every lesson's meta read from its `?meta` module,
// every exercise file as raw text, the lesson components lazy, one chunk per lesson, and each
// exercise's prompt compiled from Markdown at build time, lazy too (vite-plugin.ts). The
// same `buildRegistry` the content lint runs assembles the typed objects, so the browser sees
// exactly what the lint proved. No content is fetched at runtime.
import type { MDXContent } from 'mdx/types';
import {
  buildRegistry,
  ContentError,
  type ContentInput,
  type EditorExercise,
  type Lesson,
  type LessonMeta,
  type Registry,
} from './build-registry';

const yaml = import.meta.glob<unknown>('/content/**/*.yaml', {
  eager: true,
  import: 'default',
});
const files = import.meta.glob<string>(
  '/content/modules/**/exercises/**/*.ts',
  { eager: true, query: '?raw', import: 'default' },
);
const metas = import.meta.glob<LessonMeta>('/content/modules/*/*/lesson.mdx', {
  eager: true,
  query: '?meta',
  import: 'default',
});
const components = import.meta.glob<{ default: MDXContent }>(
  '/content/modules/*/*/lesson.mdx',
);
const prompts = import.meta.glob<{ default: MDXContent }>(
  '/content/modules/*/*/exercises/*/exercise.yaml',
  { query: '?prompt' },
);

/** `/content/x` (the glob key) → `content/x` (the registry's repository-relative path). */
function strip<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key.replace(/^\//, ''),
      value,
    ]),
  );
}

const input: ContentInput = {
  yaml: strip(yaml),
  files: strip(files),
  lessons: strip(metas),
};

const built = buildRegistry(input);
if (built.problems.length > 0) {
  // The build has already refused these; reaching here means the plugin was bypassed.
  throw new ContentError(built.problems);
}

export const registry: Registry = built.registry;

const loaders = strip(components);

/** The lesson's compiled MDX component, loaded on first use. */
export async function loadLessonContent(lesson: Lesson): Promise<MDXContent> {
  const load = loaders[lesson.path];
  if (load === undefined) {
    throw new Error(`no component for ${lesson.id} at ${lesson.path}`);
  }
  return (await load()).default;
}

const promptLoaders = strip(prompts);

/** The exercise's prompt, compiled from Markdown at build time, loaded on first use. */
export async function loadPrompt(
  exercise: EditorExercise,
): Promise<MDXContent> {
  const load = promptLoaders[exercise.path];
  if (load === undefined) {
    throw new Error(`no prompt for ${exercise.id} at ${exercise.path}`);
  }
  return (await load()).default;
}

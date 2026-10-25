// The Vite side of the content registry (spec §2 "content/ is read at build time with
// import.meta.glob, validated with Zod and turned into typed objects"; §3 "any invalid file
// fails the build with the path and the Zod message"). Two plugins:
//
// - `ts-dojo-content` (pre): turns every YAML file under content/ into a JSON module validated
//   by its §3 schema, answers `lesson.mdx?meta` (a virtual module) with the lesson's
//   frontmatter and `<Predict>` props (analyze.ts), and at `buildStart` runs the Node loader so a
//   duplicate id, a bad prerequisite or any other structural problem fails the build too.
//   It also serves `virtual:ts-dojo/content-version`, the §7 `contentVersion`: the SHA-256 of
//   the content tree at build time (content-version.ts), recorded by the store and in exports.
//   The tree is `contentDir` (roots.ts): content/, or fixtures/content/ for the e2e build. The
//   registry's globs name it as `@content/…`, which this plugin resolves, and
//   `virtual:ts-dojo/content-root` tells the registry which tree its keys come from.
// - `@mdx-js/rollup` over lesson.mdx with the fence pipeline of src/content/node/mdx.ts, so
//   `^?` queries, highlighting, snippet JavaScript and expected diagnostics are rendered now.
// - A second `@mdx-js/rollup` over each exercise's prompt (§1: Markdown), which the content
//   plugin answers for `exercise.yaml?prompt` as a virtual `…/exercise.yaml.prompt.md` module:
//   compiled as plain Markdown (no JSX, so `<` and `{` in prose are text), one lazy chunk per
//   exercise, nothing rendered at runtime.
//
// Node only (tsconfig.node.json, under node/ like the other Node-side modules): imported by
// vite.config.ts.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mdx from '@mdx-js/rollup';
import type { Plugin } from 'vite';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import { ContentError, type LessonMeta } from '../build-registry';
import { analyzeLesson } from './analyze';
import { hashContentTree, readContentTree } from './content-version';
import { loadContent } from './load';
import { createRenderer, lessonMdxOptions, type Renderer } from './mdx';
import { COURSE_DIR } from './roots';
import {
  exerciseSchema,
  formatZodError,
  moduleSchema,
  renamesSchema,
  roadmapSchema,
} from '../schema';

/** The module the app imports `CONTENT_VERSION` from (src/content/content-version.d.ts). */
export const CONTENT_VERSION_ID = 'virtual:ts-dojo/content-version';
const CONTENT_VERSION_RESOLVED = `\0${CONTENT_VERSION_ID}`;

export function contentVersionModule(version: string): string {
  return `export default ${JSON.stringify(version)};\n`;
}

/** The module the registry imports its tree's root from (src/content/content-version.d.ts). */
export const CONTENT_ROOT_ID = 'virtual:ts-dojo/content-root';
const CONTENT_ROOT_RESOLVED = `\0${CONTENT_ROOT_ID}`;

export function contentRootModule(contentDir: string): string {
  return `export default ${JSON.stringify(contentDir)};\n`;
}

/** The prefix the registry's globs use for the content tree. */
export const CONTENT_ALIAS = '@content/';

/** `@content/modules/**` → the same glob under the tree's absolute directory; null otherwise. */
export function resolveContentAlias(
  source: string,
  contentAbs: string,
): string | null {
  if (!source.startsWith(CONTENT_ALIAS)) return null;
  return `${contentAbs.split(path.sep).join('/')}/${source.slice(CONTENT_ALIAS.length)}`;
}

/** The query that asks for a lesson's meta instead of its component. */
export const META_QUERY = '?meta';

/** The query that asks for an exercise's prompt as a component. */
export const PROMPT_QUERY = '?prompt';
const PROMPT_SUFFIX = '.prompt.md';

/** The virtual id of an exercise.yaml's prompt: a `.md` file the prompt MDX instance compiles. */
export function promptId(yamlFile: string): string {
  return `${yamlFile}${PROMPT_SUFFIX}`;
}

export function isPromptId(id: string): boolean {
  return id.endsWith(`exercise.yaml${PROMPT_SUFFIX}`);
}

/** The Markdown of an exercise's `prompt`; '' for a `predict` exercise or a file that does not parse. */
export function promptSource(yamlText: string): string {
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch {
    return '';
  }
  const prompt =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as { prompt?: unknown }).prompt
      : undefined;
  return typeof prompt === 'string' ? prompt : '';
}

const YAML_FILE = /\.ya?ml$/;

/** The §3 schema for a YAML file, by its name. */
export function schemaFor(file: string): z.ZodType | null {
  switch (path.basename(file)) {
    case 'roadmap.yaml':
      return roadmapSchema;
    case 'renames.yaml':
      return renamesSchema;
    case 'module.yaml':
      return moduleSchema;
    case 'exercise.yaml':
      return exerciseSchema;
    default:
      return null;
  }
}

/** A YAML file as a validated JSON module; throws with the path and the Zod message. */
export function yamlModule(
  text: string,
  file: string,
  relative: string,
): string {
  const schema = schemaFor(file);
  if (schema === null) {
    throw new Error(
      `${relative}: not a content file (roadmap, renames, module or exercise)`,
    );
  }
  const result = schema.safeParse(parseYaml(text) as unknown);
  if (!result.success) {
    throw new Error(`${relative}: ${formatZodError(result.error)}`);
  }
  return `export default ${JSON.stringify(result.data)};\n`;
}

export interface ContentPluginOptions {
  /** The repository root; the content tree is read under it. Defaults to the Vite root. */
  root?: string;
  /** The content tree, relative to the root: `content` (the default) or `fixtures/content`. */
  contentDir?: string;
}

export function tsDojoContent(options: ContentPluginOptions = {}): Plugin[] {
  let root = options.root ?? process.cwd();
  const contentDir = options.contentDir ?? COURSE_DIR;
  const contentAbs = (): string => path.join(root, contentDir);
  let renderer: Promise<Renderer> | null = null;
  const getRenderer = (): Promise<Renderer> => {
    renderer ??= createRenderer();
    return renderer;
  };
  const relative = (file: string): string =>
    path.relative(root, file).split(path.sep).join('/');
  const isContentFile = (file: string): boolean =>
    !path.relative(contentAbs(), file).startsWith('..');

  // `lesson.mdx?meta` is answered from a virtual id: the MDX plugin compiles every id whose
  // file ends in .mdx, query or not, so the meta module must not look like one.
  const META_PREFIX = '\0ts-dojo-meta:';
  const content: Plugin = {
    name: 'ts-dojo-content',
    enforce: 'pre',
    configResolved(config) {
      root = options.root ?? config.root;
    },
    async buildStart() {
      const { problems } = await loadContent(contentAbs());
      if (problems.length > 0) throw new ContentError(problems);
    },
    async resolveId(source, importer) {
      if (source === CONTENT_VERSION_ID) return CONTENT_VERSION_RESOLVED;
      if (source === CONTENT_ROOT_ID) return CONTENT_ROOT_RESOLVED;
      const aliased = resolveContentAlias(source, contentAbs());
      if (aliased !== null) return aliased;
      if (source.endsWith(PROMPT_QUERY)) {
        const file = source.slice(0, -PROMPT_QUERY.length);
        if (path.basename(file) !== 'exercise.yaml') return null;
        const resolved = await this.resolve(file, importer, { skipSelf: true });
        if (resolved === null || !isContentFile(resolved.id)) return null;
        return promptId(resolved.id);
      }
      if (!source.endsWith(META_QUERY)) return null;
      const file = source.slice(0, -META_QUERY.length);
      if (path.basename(file) !== 'lesson.mdx') return null;
      const resolved = await this.resolve(file, importer, { skipSelf: true });
      if (resolved === null || !isContentFile(resolved.id)) return null;
      return `${META_PREFIX}${resolved.id}`;
    },
    async load(id) {
      if (id === CONTENT_ROOT_RESOLVED) {
        return { code: contentRootModule(contentDir), map: null };
      }
      if (id === CONTENT_VERSION_RESOLVED) {
        const dir = contentAbs();
        const files = await readContentTree(dir);
        for (const file of files) this.addWatchFile(path.join(dir, file.path));
        return {
          code: contentVersionModule(hashContentTree(files)),
          map: null,
        };
      }
      if (isPromptId(id) && isContentFile(id)) {
        const file = id.slice(0, -PROMPT_SUFFIX.length);
        this.addWatchFile(file);
        return { code: promptSource(await readFile(file, 'utf8')), map: null };
      }
      if (!id.startsWith(META_PREFIX)) return null;
      const file = id.slice(META_PREFIX.length);
      this.addWatchFile(file);
      const source = await readFile(file, 'utf8');
      const analysis = await analyzeLesson(source, relative(file));
      const meta: LessonMeta = {
        frontmatter: analysis.frontmatter,
        predicts: analysis.predicts.map((p) => p.props),
      };
      return { code: `export default ${JSON.stringify(meta)};\n`, map: null };
    },
    transform(code, id) {
      const [file, query = ''] = id.split('?', 2) as [string, string?];
      if (query !== '' || !YAML_FILE.test(file) || !isContentFile(file)) {
        return null;
      }
      return { code: yamlModule(code, file, relative(file)), map: null };
    },
    buildEnd() {
      void renderer?.then((r) => r.dispose());
      renderer = null;
    },
  };

  const lessons = mdx({
    include: /\/content\/.*\.mdx$/,
    ...lessonMdxOptions(getRenderer),
  }) as Plugin;

  // Prompts: plain Markdown (the `.md` extension makes the compiler use `format: 'md'`).
  const prompts = mdx({ include: /\/content\/.*\.prompt\.md$/ }) as Plugin;

  return [content, lessons, prompts];
}

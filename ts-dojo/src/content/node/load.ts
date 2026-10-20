// The Node side of the content registry: reads `content/` from disk into the same input shape
// the browser gets from `import.meta.glob` (src/content/registry.ts) and runs the shared
// `buildRegistry`. Used by the content lint, the Vite plugin's build-time check and the tests.
// Paths in the result are repository-relative (`content/modules/…`), as build-registry expects.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildRegistry,
  type ContentInput,
  type Problem,
  type Registry,
} from '../build-registry';
import {
  analyzeLesson,
  LessonAnalysisError,
  type LessonAnalysis,
} from './analyze';

export interface LoadedContent {
  registry: Registry;
  /** Structural problems, by §3 condition (empty for a valid tree). */
  problems: Problem[];
  /** Every lesson's fences and questions, by its lesson.mdx path. */
  analyses: Record<string, LessonAnalysis>;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    }),
  );
  return files.flat();
}

/** Repository-relative, forward-slash path of a file under `content/`. */
function contentPath(root: string, file: string): string {
  return `content/${path.relative(root, file).split(path.sep).join('/')}`;
}

/**
 * Reads the tree under `root` (the `content/` directory). Lessons whose MDX cannot be analysed
 * are reported as §3 condition 1 problems with the analyser's message and left out.
 */
export async function loadContentInput(root: string): Promise<{
  input: ContentInput;
  analyses: Record<string, LessonAnalysis>;
  problems: Problem[];
}> {
  const { parse } = await import('yaml');
  const input: ContentInput = { yaml: {}, files: {}, lessons: {} };
  const analyses: Record<string, LessonAnalysis> = {};
  const problems: Problem[] = [];
  const files = await walk(root);
  await Promise.all(
    files.map(async (file) => {
      const key = contentPath(root, file);
      const name = path.basename(file);
      if (name.endsWith('.yaml') || name.endsWith('.yml')) {
        const text = await readFile(file, 'utf8');
        try {
          input.yaml[key] = parse(text) as unknown;
        } catch (error) {
          problems.push({
            condition: 1,
            path: key,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (name === 'lesson.mdx') {
        const text = await readFile(file, 'utf8');
        try {
          const analysis = await analyzeLesson(text, key);
          analyses[key] = analysis;
          input.lessons[key] = {
            frontmatter: analysis.frontmatter,
            predicts: analysis.predicts.map((p) => p.props),
          };
        } catch (error) {
          if (!(error instanceof LessonAnalysisError)) throw error;
          problems.push({ condition: 1, path: key, message: error.message });
        }
      } else if (name.endsWith('.ts')) {
        input.files[key] = await readFile(file, 'utf8');
      }
    }),
  );
  return { input, analyses, problems };
}

export async function loadContent(root: string): Promise<LoadedContent> {
  const { input, analyses, problems } = await loadContentInput(root);
  const built = buildRegistry(input);
  return {
    registry: built.registry,
    problems: [...problems, ...built.problems],
    analyses,
  };
}

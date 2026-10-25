// Playwright helpers for the lesson page and the F6 content pipeline (spec §3, §12 F6): the
// fixture lessons under fixtures/content/modules/m99-fixtures, their lesson.mdx read from the
// repository at test time (frontmatter title and objectives, the body of a `ts <meta>` fence),
// and the theory DOM the §12 criteria name (`article.theory`, `.code-block[data-kind]`). Nothing here
// clicks; waits are `expect`s.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';
import type { FenceKind } from '../../src/content/fences';

export const FIXTURE_MODULE = 'm99-fixtures';
export const FIXTURE_LESSONS = [
  '01-fix',
  '02-implement',
  '03-type-challenge',
] as const;
export type FixtureLesson = (typeof FIXTURE_LESSONS)[number];

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function lessonId(folder: FixtureLesson): string {
  return `${FIXTURE_MODULE}/${folder}`;
}

export function lessonRoute(folder: FixtureLesson): string {
  return `/l/${lessonId(folder)}`;
}

/** The lesson's `lesson.mdx` as the repository holds it. */
export function readLessonMdx(folder: FixtureLesson): string {
  return readFileSync(
    `${REPO_ROOT}fixtures/content/modules/${FIXTURE_MODULE}/${folder}/lesson.mdx`,
    'utf8',
  );
}

/** The YAML between the `---` lines (a flat frontmatter; no YAML parser needed here). */
function frontmatter(mdx: string): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(mdx);
  if (match === null) throw new Error('lesson.mdx has no frontmatter');
  return match[1] as string;
}

export function frontmatterTitle(mdx: string): string {
  const match = /^title:[ \t]*(.+?)[ \t]*$/m.exec(frontmatter(mdx));
  if (match === null) throw new Error('frontmatter has no title');
  return match[1] as string;
}

/** The `objectives:` list items, in order. */
export function frontmatterObjectives(mdx: string): string[] {
  const lines = frontmatter(mdx).split(/\r?\n/);
  const start = lines.findIndex((line) => /^objectives:\s*$/.test(line));
  if (start === -1) throw new Error('frontmatter has no objectives');
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const item = /^\s+-\s+(.+?)\s*$/.exec(line);
    if (item === null) break;
    items.push(item[1] as string);
  }
  return items;
}

/**
 * The body of the first ```` ```ts <meta> ```` fence with exactly that meta string (`'run'`
 * does not match `'run errors'`), as remark gives it to the pipeline: the lines between the
 * fence markers, no trailing newline.
 */
export function firstFence(mdx: string, meta: string): string {
  const header = meta === '' ? '```ts' : `\`\`\`ts ${meta}`;
  const lines = mdx.split(/\r?\n/);
  const start = lines.findIndex((line) => line === header);
  if (start === -1) throw new Error(`no \`\`\`ts ${meta} fence`);
  const end = lines.indexOf('```', start + 1);
  if (end === -1) throw new Error(`the \`\`\`ts ${meta} fence never closes`);
  return lines.slice(start + 1, end).join('\n');
}

export function theory(page: Page): Locator {
  return page.locator('article.theory');
}

/** Every `ts` fence of the kind, in document order (`static`, `run`, `run-errors`, `twoslash`). */
export function codeBlocks(
  page: Page,
  kind: Exclude<FenceKind, 'other'>,
): Locator {
  return theory(page).locator(`.code-block[data-kind="${kind}"]`);
}

/** The lesson page with its theory rendered: the article is for that lesson and the MDX body is in. */
export async function gotoLesson(
  page: Page,
  folder: FixtureLesson,
): Promise<void> {
  await gotoLessonAt(page, lessonId(folder));
}

/** `gotoLesson` for any lesson of the served course by its full id (the F11 course spec). */
export async function gotoLessonAt(page: Page, id: string): Promise<void> {
  await page.goto(`/l/${id}`);
  await expect(theory(page)).toHaveAttribute('data-lesson', id);
  await expect(
    theory(page).getByRole('heading', { level: 2 }).first(),
  ).toHaveText('Concept');
  await expect(
    theory(page).getByRole('status'),
    'the "loading theory" line is gone',
  ).toHaveCount(0);
}

/** The rendered `^?` results of a twoslash block, in document order (the classic renderer's popovers). */
export function twoslashResults(block: Locator): Locator {
  return block.locator('.meta-line .popover');
}

/** One `^?` query of a twoslash fence, located in the fence's source. */
export interface TwoslashQuery {
  /** 0-based line of the code the query points at (the nearest line above it that is not a query). */
  line: number;
  /** 0-based column of the caret. */
  col: number;
  /** The identifier under the caret, or null when the caret is on a keyword, a literal or punctuation. */
  word: string | null;
}

const QUERY_LINE = /^\s*\/\/\s*\^\?/;
/** Any twoslash caret line (`^?` query, `^|` completion, `^^^` highlight): never a query's target. */
const CARET_LINE = /^\s*\/\/\s*\^/;
const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/;
/** Words under a caret whose quick info need not name them; only a non-empty result is required. */
const KEYWORDS = new Set(
  (
    'abstract as asserts async await break case catch class const continue declare default ' +
    'delete do else enum export extends false finally for function get if implements import in ' +
    'infer instanceof interface is keyof let module namespace new null of private protected ' +
    'public readonly return satisfies set static switch throw true try type typeof unique var ' +
    'void while yield'
  ).split(' '),
);

function wordAt(text: string, col: number): string | null {
  if (!IDENTIFIER_CHAR.test(text[col] ?? '')) return null;
  let start = col;
  while (start > 0 && IDENTIFIER_CHAR.test(text[start - 1] ?? '')) start -= 1;
  let end = col + 1;
  while (end < text.length && IDENTIFIER_CHAR.test(text[end] ?? '')) end += 1;
  const word = text.slice(start, end);
  return /^\d/.test(word) || KEYWORDS.has(word) ? null : word;
}

/**
 * The `^?` queries of a `ts twoslash` fence body, in the order twoslash renders their results:
 * by the line they point at, then by column. Throws for a query with no code line above it.
 */
export function twoslashQueries(code: string): TwoslashQuery[] {
  const lines = code.split(/\r?\n/);
  const queries: TwoslashQuery[] = [];
  for (const [index, text] of lines.entries()) {
    if (!QUERY_LINE.test(text)) continue;
    let target = index - 1;
    while (target >= 0 && CARET_LINE.test(lines[target] ?? '')) target -= 1;
    if (target < 0) {
      throw new Error(`a ^? on line ${String(index + 1)} has no code above it`);
    }
    const col = text.indexOf('^');
    queries.push({
      line: target,
      col,
      word: wordAt(lines[target] ?? '', col),
    });
  }
  return queries.sort((a, b) => a.line - b.line || a.col - b.col);
}

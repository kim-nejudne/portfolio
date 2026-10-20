// Playwright helpers for the lesson page and the F6 content pipeline (spec §3, §12 F6): the
// fixture lessons under content/modules/m99-fixtures, their lesson.mdx read from the repository
// at test time (frontmatter title and objectives, the body of a `ts <meta>` fence), and the
// theory DOM the §12 criteria name (`article.theory`, `.code-block[data-kind]`). Nothing here
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
    `${REPO_ROOT}content/modules/${FIXTURE_MODULE}/${folder}/lesson.mdx`,
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
  await page.goto(lessonRoute(folder));
  await expect(theory(page)).toHaveAttribute('data-lesson', lessonId(folder));
  await expect(
    theory(page).getByRole('heading', { level: 2 }).first(),
  ).toHaveText('Concept');
  await expect(
    theory(page).getByRole('status'),
    'the "loading theory" line is gone',
  ).toHaveCount(0);
}

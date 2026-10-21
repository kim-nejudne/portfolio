// Playwright helpers for F7, exercise verification on the lesson page (spec §5, §12 F7): opening
// an editor exercise of the fixture module, reading its starter, solution and tests.ts from the
// repository at test time, `:test` with a wait that cannot be satisfied by the previous run's
// verdict, and locators for the output pane's Tests tab (src/app/tests-tab.tsx): the verdict
// line, the four group rows and their child rows. A MutationObserver on the output pane records
// every verdict the tab showed together with the runtime test rows present at that moment, so a
// test can prove that rows streamed in while the verdict still said `running`. `gotoExerciseAt`
// and `openPath` do the same for any exercise of the served course (the F11 course spec).
// Nothing here clicks; every wait is an `expect` or `expect.poll`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';
import { FIXTURE_MODULE, type FixtureLesson } from './content';
import {
  currentPath,
  ex,
  focusEditor,
  outputPane,
  snapshot,
  waitForCompilerReady,
} from './editor';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export type GroupName = 'compiles' | 'typeCases' | 'runtime' | 'rules';
export const GROUPS: readonly GroupName[] = [
  'compiles',
  'typeCases',
  'runtime',
  'rules',
];
export const GROUP_LABELS: Record<GroupName, string> = {
  compiles: 'Compiles',
  typeCases: 'Type cases',
  runtime: 'Runtime tests',
  rules: 'Rules',
};

/** The verdict kinds a finished `:test` ends on. */
const TERMINAL = ['passed', 'failed', 'error'];

export function exerciseId(lesson: FixtureLesson, exercise: string): string {
  return `${FIXTURE_MODULE}/${lesson}/${exercise}`;
}

export function exerciseRoute(lesson: FixtureLesson, exercise: string): string {
  return `/l/${exerciseId(lesson, exercise)}`;
}

/**
 * A file of the exercise as the repository holds it: `starter/index.ts`, `solution/index.ts`,
 * `tests.ts`.
 */
export function readExerciseFile(
  lesson: FixtureLesson,
  exercise: string,
  file: string,
): string {
  return readFileSync(
    `${REPO_ROOT}fixtures/content/modules/${FIXTURE_MODULE}/${lesson}/exercises/${exercise}/${file}`,
    'utf8',
  );
}

/** The Exercise section of the practice pane. */
export function exerciseSection(page: Page): Locator {
  return page
    .getByRole('complementary', { name: 'Practice' })
    .getByRole('region', { name: 'Exercise' });
}

/**
 * `/l/<module>/<lesson>/<exercise>` with the exercise mounted, the editor focused in normal mode
 * on the entry file, and the compiler ready (`:test` needs it).
 */
export async function gotoExercise(
  page: Page,
  lesson: FixtureLesson,
  exercise: string,
): Promise<void> {
  await page.goto(exerciseRoute(lesson, exercise));
  await expect(exerciseSection(page)).toHaveAttribute(
    'data-exercise',
    exerciseId(lesson, exercise),
  );
  await focusEditor(page);
  expect(await currentPath(page)).toBe('/index.ts');
  expect((await snapshot(page)).mode).toBe('normal');
  await waitForCompilerReady(page);
  await recordVerdicts(page);
}

/**
 * `gotoExercise` for any exercise of the served course by its full id
 * (`m01-types/02-annotations/01-first-annotation`), for the course spec (F11): the exercise
 * mounted, the editor focused in normal mode, the compiler ready and the Tests tab recorded for
 * `runTest`. It does not assume the entry file is `/index.ts`.
 */
export async function gotoExerciseAt(page: Page, id: string): Promise<void> {
  await page.goto(`/l/${id}`);
  await expect(exerciseSection(page)).toHaveAttribute('data-exercise', id);
  await focusEditor(page);
  expect((await snapshot(page)).mode).toBe('normal');
  await waitForCompilerReady(page);
  await recordVerdicts(page);
}

/**
 * `:b <path>` with the full path (`/index.ts`, `/lib/shapes.ts`), which names one file even when
 * two share a basename, and wait until the editor shows that file, focused.
 */
export async function openPath(page: Page, path: string): Promise<void> {
  await ex(page, `b ${path}`);
  await expect.poll(() => currentPath(page)).toBe(path);
  await expect(page.locator('.cm-content')).toBeFocused();
}

/** `:b <name>` and wait until the editor shows that file, focused. */
export async function openBuffer(page: Page, name: string): Promise<void> {
  await ex(page, `b ${name}`);
  await expect.poll(() => currentPath(page)).toBe(`/${name}`);
  await expect(page.locator('.cm-content')).toBeFocused();
}

/** The output pane's Tests tab trigger (`Tests`, then `Tests ✓` or `Tests ✗` after a run). */
export function testsTab(page: Page): Locator {
  return outputPane(page).getByRole('tab', { name: /^Tests/ });
}

export function verdict(page: Page): Locator {
  return outputPane(page).getByTestId('verdict');
}

/** Every row of the Tests tab, groups and children, in order. */
export function rows(page: Page): Locator {
  return outputPane(page).getByTestId('tests').locator(':scope > li');
}

export function group(page: Page, name: GroupName): Locator {
  return rows(page).and(
    page.locator(`li[data-row="group"][data-group="${name}"]`),
  );
}

export function groupRows(page: Page): Locator {
  return rows(page).and(page.locator('li[data-row="group"]'));
}

/** The child row of a type case, a runtime test or a rule hit, by its `[data-field]` text. */
function childRow(page: Page, kind: 'case' | 'test', name: string): Locator {
  return rows(page)
    .and(page.locator(`li[data-row="${kind}"]`))
    .filter({
      has: page.locator('[data-field="name"]').getByText(name, { exact: true }),
    });
}

export function caseRow(page: Page, name: string): Locator {
  return childRow(page, 'case', name);
}

export function caseRows(page: Page): Locator {
  return rows(page).and(page.locator('li[data-row="case"]'));
}

export function testRow(page: Page, name: string): Locator {
  return childRow(page, 'test', name);
}

export function testRows(page: Page): Locator {
  return rows(page).and(page.locator('li[data-row="test"]'));
}

export function hitRows(page: Page): Locator {
  return rows(page).and(page.locator('li[data-row="hit"]'));
}

export function diagnosticRows(page: Page): Locator {
  return rows(page).and(page.locator('li[data-row="diagnostic"]'));
}

export function field(row: Locator, name: string): Locator {
  return row.locator(`[data-field="${name}"]`);
}

/** The position of a row among all rows of the Tests tab. */
export async function rowIndex(row: Locator): Promise<number> {
  return row.evaluate((li) =>
    [...(li.parentElement?.children ?? [])].indexOf(li),
  );
}

/** The index of the selected row (`data-selected="true"`), -1 for none. */
export async function selectedIndex(page: Page): Promise<number> {
  return outputPane(page)
    .getByTestId('tests')
    .evaluate((ul) =>
      [...ul.children].findIndex(
        (li) => li.getAttribute('data-selected') === 'true',
      ),
    );
}

/**
 * With the output pane focused, `j` or `k` one row at a time (each step waits for the
 * selection to move) until `row` is selected.
 */
export async function selectRow(page: Page, row: Locator): Promise<void> {
  await expect(outputPane(page)).toBeFocused();
  const target = await rowIndex(row);
  let at = await selectedIndex(page);
  while (at !== target) {
    const step = target > at ? 1 : -1;
    await page.keyboard.press(step === 1 ? 'j' : 'k');
    at += step;
    await expect.poll(() => selectedIndex(page)).toBe(at);
  }
  await expect(row).toHaveAttribute('data-selected', 'true');
}

/** One row of the Tests tab as data: its attributes and its `[data-field]` texts. */
export interface RowData {
  row: string;
  group: string | null;
  status: string | null;
  expanded: string | null;
  selected: boolean;
  fields: Record<string, string>;
  text: string;
}

/** Every row of the Tests tab, read in one go (after `runTest`, the tab no longer changes). */
export async function readRows(page: Page): Promise<RowData[]> {
  return rows(page).evaluateAll((lis) =>
    lis.map((li) => {
      const fields: Record<string, string> = {};
      for (const element of li.querySelectorAll('[data-field]')) {
        fields[element.getAttribute('data-field') ?? ''] =
          element.textContent ?? '';
      }
      return {
        row: li.getAttribute('data-row') ?? '',
        group: li.getAttribute('data-group'),
        status: li.getAttribute('data-status'),
        expanded: li.getAttribute('data-expanded'),
        selected: li.getAttribute('data-selected') === 'true',
        fields,
        text: li.textContent ?? '',
      };
    }),
  );
}

/** The child rows listed under a group: those after its row and before the next group's. */
export function rowsUnder(all: RowData[], name: GroupName): RowData[] {
  const start = all.findIndex((r) => r.row === 'group' && r.group === name);
  if (start === -1) throw new Error(`no ${name} group row`);
  const next = all.findIndex((r, i) => i > start && r.row === 'group');
  return all.slice(start + 1, next === -1 ? undefined : next);
}

/** What the Tests tab showed each time its verdict changed, recorded in the page. */
export interface VerdictRecord {
  verdict: string;
  /** Runtime test rows (`li[data-row="test"]`) present when the verdict was recorded or changed. */
  tests: number;
  runtimeStatus: string | null;
}

declare global {
  interface Window {
    __verdicts?: VerdictRecord[];
  }
}

/**
 * Starts recording the Tests tab: on every change under the output pane, the verdict and the
 * number of runtime test rows are appended when either differs from the last record.
 */
async function recordVerdicts(page: Page): Promise<void> {
  await expect(verdict(page)).toHaveAttribute('data-verdict', 'idle');
  await outputPane(page).evaluate((pane) => {
    const records: VerdictRecord[] = [];
    window.__verdicts = records;
    const read = (): VerdictRecord => ({
      verdict:
        pane
          .querySelector('[data-testid="verdict"]')
          ?.getAttribute('data-verdict') ?? '',
      tests: pane.querySelectorAll(
        '[data-testid="tests"] > li[data-row="test"]',
      ).length,
      runtimeStatus:
        pane
          .querySelector('li[data-row="group"][data-group="runtime"]')
          ?.getAttribute('data-status') ?? null,
    });
    const note = (): void => {
      const next = read();
      const last = records.at(-1);
      if (
        last === undefined ||
        last.verdict !== next.verdict ||
        last.tests !== next.tests ||
        last.runtimeStatus !== next.runtimeStatus
      ) {
        records.push(next);
      }
    };
    note();
    new MutationObserver(note).observe(pane, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-verdict', 'data-status'],
    });
  });
}

export async function verdictRecords(page: Page): Promise<VerdictRecord[]> {
  return page.evaluate(() => window.__verdicts ?? []);
}

/**
 * `:test` (or its alias `:t`) from the editor in normal mode, then wait until this run has shown `running` and
 * ended: the previous run's verdict can never satisfy the wait. Returns what the tab showed
 * during the run.
 */
export async function runTest(
  page: Page,
  options: { timeout?: number; command?: 'test' | 't' } = {},
): Promise<VerdictRecord[]> {
  await expect(page.locator('.cm-content')).toBeFocused();
  const from = (await verdictRecords(page)).length;
  await ex(page, options.command ?? 'test');
  await expect(testsTab(page)).toHaveAttribute('aria-selected', 'true');
  let seen: VerdictRecord[] = [];
  await expect
    .poll(
      async () => {
        seen = (await verdictRecords(page)).slice(from);
        const started = seen.findIndex((r) => r.verdict === 'running');
        const last = seen.at(-1);
        return (
          started !== -1 &&
          last !== undefined &&
          TERMINAL.includes(last.verdict)
        );
      },
      {
        message: ':test showed `running` and then a verdict',
        timeout: options.timeout ?? 10_000,
      },
    )
    .toBe(true);
  return seen;
}

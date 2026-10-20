// Playwright helpers for F8, the lesson page (spec §1 Completion and Hints/solutions/reset, §4
// Focus and panes, §6 Lesson page, §7 Store, §12 F8): the page's panes and controls as
// src/pages/lesson.tsx, src/pages/practice.tsx and src/pages/lesson/*.tsx render them, the
// fixture exercises' YAML and the lessons' Check yourself questions read from the repository at
// test time (answers, hints, prompts and explanations are never hard-coded), readers for the §7
// `lessons`, `exercises` and `attempts` rows straight from IndexedDB, and a description of the
// focused pane that every focus assertion goes through. Nothing here clicks; every wait is an
// `expect` or `expect.poll`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';
import { parse } from 'yaml';
import {
  FIXTURE_MODULE,
  lessonId,
  readLessonMdx,
  type FixtureLesson,
} from './content';
import { focusEditor, snapshot, waitForEditor } from './editor';
import { exerciseId, exerciseRoute } from './verify';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

// ---------------------------------------------------------------------------------------------
// Content read from the repository

/** The fields of an `exercise.yaml` the lesson page shows (§3). */
export interface ExerciseYaml {
  id: string;
  kind: 'fix' | 'implement' | 'type-challenge' | 'predict';
  title: string;
  minutes: number;
  prompt?: string;
  hints?: string[];
  question?: string;
  code?: string;
  options?: string[];
  answer?: number;
  explanation?: string;
}

export function readExerciseYaml(
  lesson: FixtureLesson,
  exercise: string,
): ExerciseYaml {
  const text = readFileSync(
    `${REPO_ROOT}content/modules/${FIXTURE_MODULE}/${lesson}/exercises/${exercise}/exercise.yaml`,
    'utf8',
  );
  return parse(text) as ExerciseYaml;
}

/** A `<Predict>` Check yourself question in a lesson.mdx: its id, options and right answer. */
export interface CheckQuestion {
  id: string;
  options: string[];
  answer: number;
  explanation: string;
}

/** Every `<Predict ... />` in the lesson's theory, in document order. */
export function readCheckQuestions(lesson: FixtureLesson): CheckQuestion[] {
  const mdx = readLessonMdx(lesson);
  const questions: CheckQuestion[] = [];
  for (const match of mdx.matchAll(/<Predict\b([\s\S]*?)\/>/g)) {
    const body = match[1] as string;
    const id = /\bid="([^"]+)"/.exec(body)?.[1];
    const answer = /\banswer=\{(\d+)\}/.exec(body)?.[1];
    const options = /\boptions=\{(\[[\s\S]*?\])\}/.exec(body)?.[1];
    const explanation = /\bexplanation="([^"]*)"/.exec(body)?.[1];
    if (
      id === undefined ||
      answer === undefined ||
      options === undefined ||
      explanation === undefined
    ) {
      throw new Error(`a <Predict> in ${lesson}/lesson.mdx did not parse`);
    }
    questions.push({
      id,
      answer: Number(answer),
      // The options are a JS array of single-quoted strings: YAML flow syntax reads them.
      options: parse(options) as string[],
      explanation,
    });
  }
  return questions;
}

/** Whitespace collapsed, as `toHaveText` compares. */
export function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------------------------
// The page

/** `div[data-layout]`: the row holding theory, the separator and practice. */
export function layoutRoot(page: Page): Locator {
  return page.locator('[data-layout]');
}

export function theoryPane(page: Page): Locator {
  return page.locator('section[data-pane="theory"]');
}

export function practicePane(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Practice' });
}

export function separator(page: Page): Locator {
  return page.getByRole('separator', { name: 'Resize theory and practice' });
}

export function doneButton(page: Page): Locator {
  return page.getByTestId('done');
}

/** The exercise strip's chips (`li[data-exercise]`). */
export function chips(page: Page): Locator {
  return page.locator(
    'nav[aria-label="Exercises"] ol.exercise-list > li[data-exercise]',
  );
}

export function chip(page: Page, folder: string): Locator {
  return page.locator(
    `nav[aria-label="Exercises"] ol.exercise-list > li[data-exercise="${folder}"]`,
  );
}

/** The chip marked `aria-current="step"`. */
export function currentChip(page: Page): Locator {
  return page.locator(
    'nav[aria-label="Exercises"] ol.exercise-list > li[aria-current="step"]',
  );
}

export function lessonNotice(page: Page): Locator {
  return page.getByRole('status', { name: 'lesson notice' });
}

export function exerciseHeader(page: Page): Locator {
  return practicePane(page).getByTestId('exercise-header');
}

export function headerField(page: Page, name: string): Locator {
  return exerciseHeader(page).locator(`[data-field="${name}"]`);
}

export function hintItems(page: Page): Locator {
  return practicePane(page).getByTestId('hints').locator('li[data-hint]');
}

export function solutionPane(page: Page): Locator {
  return practicePane(page).getByTestId('solution');
}

export function promptBox(page: Page): Locator {
  return practicePane(page).getByTestId('prompt');
}

/** A `predict` exercise's panel (it replaces the editor). */
export function predictPanel(page: Page): Locator {
  return practicePane(page).locator(
    'section[data-pane="editor"][aria-label="Predict"]',
  );
}

/** A `predict` exercise's question block (the practice side's focus target). */
export function predictQuestion(page: Page): Locator {
  return predictPanel(page).locator('section[data-question]');
}

/** A Check yourself question in the theory pane. */
export function checkQuestion(page: Page, id: string): Locator {
  return theoryPane(page).locator(`section[data-check-id="${id}"]`);
}

export function options(question: Locator): Locator {
  return question.locator('li[data-option]');
}

/** The index of the highlighted option, -1 for none. */
export async function highlighted(question: Locator): Promise<number> {
  return question.evaluate((section) =>
    [...section.querySelectorAll('li[data-option]')].findIndex(
      (li) => li.getAttribute('data-highlighted') === 'true',
    ),
  );
}

export function explanation(question: Locator): Locator {
  return question.getByTestId('explanation');
}

export function result(question: Locator): Locator {
  return explanation(question).locator('[data-result]');
}

/** The page's editor exercise, or the predict panel, shows `exercise` of `lesson`. */
export async function expectExercise(
  page: Page,
  lesson: FixtureLesson,
  exercise: string,
): Promise<void> {
  await expect(page).toHaveURL(exerciseRoute(lesson, exercise));
  await expect(page.locator('article.theory')).toHaveAttribute(
    'data-lesson',
    lessonId(lesson),
  );
  await expect(currentChip(page)).toHaveAttribute('data-exercise', exercise);
  await expect(currentChip(page)).toHaveCount(1);
  await expect(
    practicePane(page).locator('section[data-exercise]'),
  ).toHaveAttribute('data-exercise', exerciseId(lesson, exercise));
}

/**
 * `/l/<module>/<lesson>/<exercise>` opened directly; for an editor exercise, the editor focused
 * (through the seam, as e2e/helpers/editor.ts does) in normal mode. No compiler wait: use
 * `gotoExercise` (e2e/helpers/verify.ts) when `:test` or `:w` is needed.
 */
export async function openExercise(
  page: Page,
  lesson: FixtureLesson,
  exercise: string,
): Promise<void> {
  await page.goto(exerciseRoute(lesson, exercise));
  await expectExercise(page, lesson, exercise);
  if (readExerciseYaml(lesson, exercise).kind !== 'predict') {
    await focusEditor(page);
    expect((await snapshot(page)).mode).toBe('normal');
  }
}

/** What has the focus, by pane: the three §4 panes, the predict question, a dialog, or the body. */
export type FocusTarget =
  | 'theory'
  | 'editor'
  | 'output'
  | 'question'
  | 'check'
  | 'separator'
  | 'done'
  | 'dialog'
  | 'body'
  | `other:${string}`;

export async function focused(page: Page): Promise<FocusTarget> {
  return page.evaluate((): FocusTarget => {
    const active = document.activeElement;
    if (active === null || active === document.body) return 'body';
    if (active.closest('[role="dialog"], [role="alertdialog"]') !== null) {
      return 'dialog';
    }
    if (active.matches('.cm-content')) return 'editor';
    if (active.matches('section[data-pane="theory"]')) return 'theory';
    if (active.matches('section[data-pane="output"]')) return 'output';
    if (active.matches('[role="separator"]')) return 'separator';
    if (active.matches('[data-testid="done"]')) return 'done';
    if (active.matches('section[data-question][data-predict-exercise]')) {
      return 'question';
    }
    if (active.matches('section[data-question][data-check-id]')) {
      return 'check';
    }
    const label =
      active.getAttribute('aria-label') ?? active.className.toString();
    return `other:${active.tagName.toLowerCase()} ${label}`;
  });
}

/** Asserts the focused pane, polling until it settles. */
export async function expectFocus(
  page: Page,
  target: FocusTarget,
  message?: string,
): Promise<void> {
  await expect
    .poll(() => focused(page), { message: message ?? `focus on ${target}` })
    .toBe(target);
}

/** `Esc` from the body or a non-editor pane: the §6 global key back to the editor. */
export async function escToEditor(page: Page): Promise<void> {
  await waitForEditor(page);
  await page.keyboard.press('Escape');
  await expectFocus(page, 'editor', 'Esc focuses the editor');
  expect((await snapshot(page)).mode).toBe('normal');
}

/** The pane's border box as a fraction of the layout row's width. */
export async function widthShare(page: Page, pane: Locator): Promise<number> {
  const row = await layoutRoot(page).boundingBox();
  const box = await pane.boundingBox();
  if (row === null || box === null) throw new Error('a pane is not rendered');
  return box.width / row.width;
}

// ---------------------------------------------------------------------------------------------
// The §7 rows, read from IndexedDB directly (the Dexie database `ts-dojo`)

export interface LessonRowData {
  id: string;
  state: 'not-started' | 'in-progress' | 'complete';
  theoryReadAt?: number;
  completedAt?: number;
  lastOpenedAt?: number;
  lastExerciseId?: string;
  layout?: 'split' | 'theory' | 'practice';
  questions?: Record<
    string,
    { answerIndex: number; correct: boolean; at: number }
  >;
}

export interface ExerciseRowData {
  id: string;
  lessonId: string;
  state: 'untouched' | 'in-progress' | 'passed';
  passedAt?: number;
  attemptsToPass?: number;
  hintsUsed: number;
  solutionViewed: boolean;
  files: Record<string, string>;
  updatedAt: number;
  predictAnswer?: number;
}

export interface AttemptRowData {
  id: number;
  exerciseId: string;
  kind?: 'run' | 'test';
  at: number;
  passed: boolean;
  groups: Record<string, { passed: boolean; count: number }>;
  ms: number;
  files: Record<string, string>;
}

async function readRow<T>(
  page: Page,
  table: 'lessons' | 'exercises',
  key: string,
): Promise<T | null> {
  return page.evaluate(
    ({ table, key }) =>
      new Promise<T | null>((resolve, reject) => {
        const open = indexedDB.open('ts-dojo');
        open.onerror = () =>
          reject(open.error ?? new Error('indexedDB open failed'));
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(table)) {
            db.close();
            resolve(null);
            return;
          }
          const get = db.transaction(table).objectStore(table).get(key);
          get.onerror = () =>
            reject(get.error ?? new Error('indexedDB get failed'));
          get.onsuccess = () => {
            db.close();
            resolve((get.result as T | undefined) ?? null);
          };
        };
      }),
    { table, key },
  );
}

export async function readLessonRow(
  page: Page,
  lesson: FixtureLesson,
): Promise<LessonRowData | null> {
  return readRow<LessonRowData>(page, 'lessons', lessonId(lesson));
}

export async function readExerciseRow(
  page: Page,
  lesson: FixtureLesson,
  exercise: string,
): Promise<ExerciseRowData | null> {
  return readRow<ExerciseRowData>(
    page,
    'exercises',
    exerciseId(lesson, exercise),
  );
}

/** The exercise's `attempts` rows (index `exerciseId`), oldest first. */
export async function readAttempts(
  page: Page,
  lesson: FixtureLesson,
  exercise: string,
): Promise<AttemptRowData[]> {
  return page.evaluate(
    (id) =>
      new Promise<AttemptRowData[]>((resolve, reject) => {
        const open = indexedDB.open('ts-dojo');
        open.onerror = () =>
          reject(open.error ?? new Error('indexedDB open failed'));
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('attempts')) {
            db.close();
            resolve([]);
            return;
          }
          const all = db
            .transaction('attempts')
            .objectStore('attempts')
            .index('exerciseId')
            .getAll(id);
          all.onerror = () =>
            reject(all.error ?? new Error('indexedDB getAll failed'));
          all.onsuccess = () => {
            db.close();
            resolve(
              (all.result as AttemptRowData[]).sort((a, b) => a.id - b.id),
            );
          };
        };
      }),
    exerciseId(lesson, exercise),
  );
}

/**
 * With a question block focused, `j`/`k` one option at a time (each step waits for the
 * highlight to move) until `index` is highlighted, then `Enter`: one answer, from the keyboard.
 */
export async function answer(
  page: Page,
  question: Locator,
  index: number,
): Promise<void> {
  await expect(question).toBeFocused();
  let at = await highlighted(question);
  while (at !== index) {
    const down = index > at;
    await page.keyboard.press(down ? 'j' : 'k');
    at += down ? 1 : -1;
    await expect.poll(() => highlighted(question)).toBe(at);
  }
  await page.keyboard.press('Enter');
  await expect(options(question).nth(index)).toHaveAttribute(
    'data-chosen',
    'true',
  );
}

/** Ctrl-p, the query typed, the first match checked, `Enter`. */
export async function runFromPalette(
  page: Page,
  query: string,
  label: string,
): Promise<void> {
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await page.keyboard.press('Control+p');
  await expect(palette).toBeVisible();
  await expect(palette.locator('[cmdk-input]')).toBeFocused();
  await page.keyboard.type(query);
  const selected = palette.locator('[cmdk-item][aria-selected="true"]');
  await expect(selected.locator('span').first()).toHaveText(label);
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
}

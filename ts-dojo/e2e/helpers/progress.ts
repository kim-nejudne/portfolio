// Playwright helpers for F9 (spec §6 Roadmap, Module page, `/progress`; §7 Store, Export and
// import, Content versions): seeding and reading the §7 tables of the Dexie database `ts-dojo`
// through a raw IndexedDB connection, the settings in localStorage, the roadmap's cards, bands,
// edges and Continue bar, the module page's lessons, the /progress table and notice, Tab to a
// control, and catching a `:export` download with its dated name.
//
// Seeding: the app must have created the database first (`openApp` waits for the roadmap's
// Continue bar, whose query runs after Dexie's open), and the raw writes reach the app's live
// queries only through a reload, which is also when the app's open applies `renames.yaml` and
// records `contentVersion` (src/store/content-update.ts). Nothing here clicks; every wait is an
// `expect` or `expect.poll`.
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { SETTINGS_KEY } from './editor';
import type { AttemptRowData, ExerciseRowData, LessonRowData } from './lesson';

export interface BufferRowData {
  name: string;
  text: string;
  updatedAt: number;
}

export interface MetaRowData {
  key: string;
  value: unknown;
}

export type SeedAttempt = Omit<AttemptRowData, 'id'>;

export interface StoreSeed {
  lessons?: LessonRowData[];
  exercises?: ExerciseRowData[];
  /** Added under new `++id` keys, in this order. */
  attempts?: SeedAttempt[];
  buffers?: BufferRowData[];
  /** `meta` rows by key. */
  meta?: Record<string, unknown>;
}

/** Every row of the five §7 tables, in key order. */
export interface StoreDump {
  lessons: LessonRowData[];
  exercises: ExerciseRowData[];
  attempts: AttemptRowData[];
  buffers: BufferRowData[];
  meta: MetaRowData[];
}

export const TABLES = [
  'lessons',
  'exercises',
  'attempts',
  'buffers',
  'meta',
] as const;

// ---------------------------------------------------------------------------------------------
// The store

/** `/` with the roadmap rendered and the store open (the Continue bar's query has resolved). */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expectRoadmap(page);
}

export async function expectRoadmap(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
  await expect(continueBar(page)).toBeVisible();
}

/** Writes the rows in one readwrite transaction of a raw connection; resolves on commit. */
export async function seedStore(page: Page, seed: StoreSeed): Promise<void> {
  await page.evaluate(
    (seed) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('ts-dojo');
        open.onerror = () =>
          reject(open.error ?? new Error('indexedDB open failed'));
        open.onsuccess = () => {
          const db = open.result;
          const tables = [
            'lessons',
            'exercises',
            'attempts',
            'buffers',
            'meta',
          ].filter((name) => db.objectStoreNames.contains(name));
          if (tables.length !== 5) {
            db.close();
            reject(new Error('the app has not created the ts-dojo stores yet'));
            return;
          }
          const tx = db.transaction(tables, 'readwrite');
          for (const row of seed.lessons ?? [])
            tx.objectStore('lessons').put(row);
          for (const row of seed.exercises ?? []) {
            tx.objectStore('exercises').put(row);
          }
          for (const row of seed.attempts ?? []) {
            tx.objectStore('attempts').add(row);
          }
          for (const row of seed.buffers ?? [])
            tx.objectStore('buffers').put(row);
          for (const [key, value] of Object.entries(seed.meta ?? {})) {
            tx.objectStore('meta').put({ key, value });
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error ?? new Error('the seed transaction failed'));
          };
        };
      }),
    seed,
  );
}

export async function readStore(page: Page): Promise<StoreDump> {
  return page.evaluate(
    (tables) =>
      new Promise<StoreDump>((resolve, reject) => {
        const open = indexedDB.open('ts-dojo');
        open.onerror = () =>
          reject(open.error ?? new Error('indexedDB open failed'));
        open.onsuccess = () => {
          const db = open.result;
          const present = tables.filter((name) =>
            db.objectStoreNames.contains(name),
          );
          const dump: Record<string, unknown[]> = {
            lessons: [],
            exercises: [],
            attempts: [],
            buffers: [],
            meta: [],
          };
          if (present.length === 0) {
            db.close();
            resolve(dump as unknown as StoreDump);
            return;
          }
          const tx = db.transaction(present, 'readonly');
          for (const name of present) {
            const all = tx.objectStore(name).getAll();
            all.onsuccess = () => {
              dump[name] = all.result as unknown[];
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve(dump as unknown as StoreDump);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error ?? new Error('the read transaction failed'));
          };
        };
      }),
    [...TABLES],
  );
}

export function metaValue(dump: StoreDump, key: string): unknown {
  return dump.meta.find((row) => row.key === key)?.value;
}

/** Replaces the stored §7 settings object (`ts-dojo:settings`). */
export async function storeSettings(
  page: Page,
  settings: Record<string, unknown>,
): Promise<void> {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: SETTINGS_KEY,
    value: JSON.stringify(settings),
  });
}

/** Seeds, reloads, and waits for whatever page is open to render its h1 again. */
export async function seedAndReload(
  page: Page,
  seed: StoreSeed,
  settings?: Record<string, unknown>,
): Promise<void> {
  await seedStore(page, seed);
  if (settings !== undefined) await storeSettings(page, settings);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

// ---------------------------------------------------------------------------------------------
// Row builders (the §7 shapes of src/store/db.ts)

export function lessonRow(
  id: string,
  fields: Partial<LessonRowData> = {},
): LessonRowData {
  return { id, state: 'in-progress', ...fields };
}

/** A complete lesson: theory read and completed at `at`. */
export function completeLesson(id: string, at: number): LessonRowData {
  return { id, state: 'complete', theoryReadAt: at, completedAt: at };
}

export function exerciseRow(
  id: string,
  fields: Partial<ExerciseRowData> = {},
): ExerciseRowData {
  return {
    id,
    lessonId: id.split('/').slice(0, 2).join('/'),
    state: 'in-progress',
    hintsUsed: 0,
    solutionViewed: false,
    files: {},
    updatedAt: 0,
    ...fields,
  };
}

export function passedExercise(
  id: string,
  at: number,
  fields: Partial<ExerciseRowData> = {},
): ExerciseRowData {
  return exerciseRow(id, {
    state: 'passed',
    passedAt: at,
    attemptsToPass: 1,
    updatedAt: at,
    ...fields,
  });
}

export function attempt(
  exerciseId: string,
  at: number,
  fields: Partial<SeedAttempt> = {},
): SeedAttempt {
  return {
    exerciseId,
    kind: 'test',
    at,
    passed: false,
    groups: {
      compiles: { passed: true, count: 0 },
      types: { passed: false, count: 2 },
      tests: { passed: true, count: 3 },
      rules: { passed: true, count: 0 },
    },
    ms: 40,
    files: { '/index.ts': `// attempt at ${String(at)}` },
    ...fields,
  };
}

// ---------------------------------------------------------------------------------------------
// The roadmap (`/`, src/pages/roadmap.tsx)

export function continueBar(page: Page): Locator {
  return page.locator('a[data-continue]');
}

export function band(page: Page, tierId: string): Locator {
  return page.locator(`section[data-tier="${tierId}"]`);
}

export function bands(page: Page): Locator {
  return page.locator('section[data-tier]');
}

export function card(page: Page, moduleId: string): Locator {
  return page.locator(`a[data-module="${moduleId}"]`);
}

export function cards(page: Page): Locator {
  return page.locator('a[data-module]');
}

export function field(scope: Locator, name: string): Locator {
  return scope.locator(`[data-field="${name}"]`);
}

export function ring(scope: Locator): Locator {
  return scope.locator('svg[data-ring]');
}

/** The drawn prerequisite edges (the arrow marker's own path has no `data-from`). */
export function edgePaths(page: Page): Locator {
  return page.locator('svg[data-edges] path[data-from]');
}

export function edgePath(page: Page, from: string, to: string): Locator {
  return page.locator(
    `svg[data-edges] path[data-from="${from}"][data-to="${to}"]`,
  );
}

/** The module id of the focused card, or what has the focus instead. */
export async function focusedCard(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (active === null || active === document.body) return 'body';
    return active.getAttribute('data-module') ?? active.tagName.toLowerCase();
  });
}

export async function expectFocusedCard(
  page: Page,
  moduleId: string,
  message?: string,
): Promise<void> {
  await expect
    .poll(() => focusedCard(page), {
      message: message ?? `${moduleId} focused`,
    })
    .toBe(moduleId);
}

// ---------------------------------------------------------------------------------------------
// The module page (`/m/:module`, src/pages/module.tsx)

export function moduleLessonItems(page: Page): Locator {
  return page.locator('ol.module-lessons > li[data-lesson]');
}

export function moduleLessonItem(page: Page, lessonId: string): Locator {
  return page.locator(`ol.module-lessons > li[data-lesson="${lessonId}"]`);
}

export function lessonLink(page: Page, lessonId: string): Locator {
  return page.locator(`a[data-lesson-link="${lessonId}"]`);
}

export function prerequisites(page: Page): Locator {
  return page.locator('section[aria-label="Prerequisites"]');
}

// ---------------------------------------------------------------------------------------------
// /progress (src/pages/progress.tsx)

export function progressNotice(page: Page): Locator {
  return page.getByRole('status', { name: 'progress notice' });
}

export function progressTable(page: Page): Locator {
  return page.locator('table[aria-label="Progress by module"]');
}

export function moduleRow(page: Page, moduleId: string): Locator {
  return progressTable(page).locator(`tr[data-module="${moduleId}"]`);
}

export function lessonRowOf(page: Page, lessonId: string): Locator {
  return progressTable(page).locator(`tr[data-lesson="${lessonId}"]`);
}

/** `/progress` with its table rendered. */
export async function gotoProgress(page: Page): Promise<void> {
  await page.goto('/progress');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Progress');
  await expect(progressTable(page)).toBeVisible();
}

export function fileInput(page: Page): Locator {
  return page.locator(
    'input[type="file"][aria-label="Progress file to import"]',
  );
}

export function importDialog(page: Page): Locator {
  return page.getByRole('dialog').and(page.locator('[data-import]'));
}

export function resetDialog(
  page: Page,
  scope: 'lesson' | 'module' | 'everything',
): Locator {
  return page.getByRole('dialog').and(page.locator(`[data-reset="${scope}"]`));
}

// ---------------------------------------------------------------------------------------------
// Keyboard

/**
 * `Tab` until `target` has the focus (no press when it has it already), at most `max` presses;
 * returns how many it took.
 */
export async function tabTo(
  page: Page,
  target: Locator,
  max = 40,
): Promise<number> {
  const has = () =>
    target.evaluate((element) => element === document.activeElement);
  let presses = 0;
  while (!(await has())) {
    if (presses === max) {
      throw new Error(`Tab did not reach the target in ${String(max)} presses`);
    }
    await page.keyboard.press('Tab');
    presses += 1;
  }
  await expect(target).toBeFocused();
  return presses;
}

// ---------------------------------------------------------------------------------------------
// Downloads (§7 `:export`)

/** The §7 export's keys, in the order the file lists them. */
export const EXPORT_KEYS = [
  'schemaVersion',
  'contentVersion',
  'exportedAt',
  'lessons',
  'exercises',
  'attempts',
  'buffers',
  'settings',
];

export interface ExportFileData {
  schemaVersion: number;
  contentVersion: string;
  exportedAt: string;
  lessons: LessonRowData[];
  exercises: ExerciseRowData[];
  attempts: SeedAttempt[];
  buffers: BufferRowData[];
  settings: Record<string, unknown>;
}

export interface Downloaded {
  name: string;
  text: string;
  json: ExportFileData;
  /** The clock just before the action and just after the file arrived. */
  before: Date;
  after: Date;
}

/** Runs `action` and returns the download it caused, read and parsed. */
export async function catchDownload(
  page: Page,
  action: () => Promise<void>,
): Promise<Downloaded> {
  const before = new Date();
  const event = page.waitForEvent('download');
  await action();
  const download = await event;
  const path = await download.path();
  const after = new Date();
  const text = readFileSync(path, 'utf8');
  return {
    name: download.suggestedFilename(),
    text,
    json: JSON.parse(text) as ExportFileData,
    before,
    after,
  };
}

/** `ts-dojo-progress-YYYY-MM-DD.json` for the date in that time zone (the test's own by default). */
export function datedName(date: Date, timeZone?: string): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return `ts-dojo-progress-${day}.json`;
}

/** The download is named for the local date (either side of a midnight during the action). */
export function expectDatedName(download: Downloaded, timeZone?: string): void {
  expect(download.name).toMatch(/^ts-dojo-progress-\d{4}-\d{2}-\d{2}\.json$/);
  expect([
    datedName(download.before, timeZone),
    datedName(download.after, timeZone),
  ]).toContain(download.name);
}

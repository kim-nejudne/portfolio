// §12 F9, `/progress` (spec §6 Pages; §7 Store, Export and import), from the keyboard in Chrome:
//   4. "`/progress` shows per-module counts, hints used and solutions viewed; `:export`
//      downloads the JSON in §7; import previews and merges as §7 says; each reset scope works
//      with its confirmation."
// Counts: a hint (`:hint`) and a solution (`:sol`) taken on the lesson page, a `predict`
// answered there, and passes seeded into IndexedDB, read back per lesson, per module and in the
// totals. Export: `:export` from the /repl editor, from a lesson page's editor, from the palette
// on /progress and from the Export button, each a download named for the local date (the
// browser runs in UTC+14 or UTC-12, whichever has another date than UTC at the time of the run);
// one file, from seeded rows, checked key by key against §7 ("`schemaVersion`,
// `contentVersion`, `exportedAt`, every row of `lessons`, `exercises` and `buffers`, the newest
// 5 attempts per exercise, and `settings`"), with `contentVersion` compared to the build's hash
// computed in Node. Import: a crafted file through the file input (`setInputFiles`, not a
// mouse action), its preview per §7 category, Cancel changing nothing, Apply merging per §7
// ("Rows merge by id and the newer `updatedAt` wins; attempts append; a passed exercise never
// becomes unpassed"), a second import of the same file adding nothing, and unreadable files
// refused. Reset: one lesson, one module and everything, each behind its confirmation ("each
// asks for a confirmation; 'everything' asks to type the word `reset`"), each removing exactly
// its rows. The fourth scope, one exercise's files by `:reset`, is proven by
// e2e/lesson-practice.spec.ts "`:reset` asks first: `n` keeps the edit, `y` restores the
// starter…". The store is read straight from IndexedDB (e2e/helpers/progress.ts). Keyboard
// only; no fixed sleeps.
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  bufferNames,
  ex,
  gotoRepl,
  readStoredSettings,
  vimPanel,
} from './helpers/editor';
import {
  contentHash,
  coreLessons,
  courseCoreLessons,
  courseExercises,
  courseLessons,
  exerciseFolders,
  moduleLessons,
  readLesson,
  readModule,
  readTiers,
} from './helpers/course';
import {
  answer,
  expectExercise,
  expectFocus,
  lessonNotice,
  openExercise,
  predictQuestion,
  readExerciseRow,
  readExerciseYaml,
  runFromPalette,
  solutionPane,
} from './helpers/lesson';
import {
  attempt,
  catchDownload,
  completeLesson,
  EXPORT_KEYS,
  exerciseRow,
  expectDatedName,
  field,
  fileInput,
  gotoProgress,
  importDialog,
  lessonRow,
  lessonRowOf,
  metaValue,
  moduleRow,
  openApp,
  passedExercise,
  progressNotice,
  progressTable,
  readStore,
  resetDialog,
  seedAndReload,
  seedStore,
  tabTo,
  type BufferRowData,
  type Downloaded,
  type StoreDump,
  type StoreSeed,
} from './helpers/progress';
import { exerciseRoute } from './helpers/verify';

const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
/**
 * The browser's time zone for these tests, chosen so its date is not the UTC date right now:
 * UTC+14 is a day ahead from 10:00 UTC, UTC-12 a day behind until 12:00 UTC. A file named
 * after the UTC date instead of the local one then fails `expectDatedName`.
 */
const ZONE =
  new Date().getUTCHours() >= 12 ? 'Pacific/Kiritimati' : 'Etc/GMT+12';

const [M99, M98, M97] = readTiers().flatMap((tier) => tier.modules) as [
  string,
  string,
  string,
];
const FIX = 'm99-fixtures/01-fix';
const IMPLEMENT = 'm99-fixtures/02-implement';
const CHALLENGE = 'm99-fixtures/03-type-challenge';
const TUPLES = 'm98-fixture-sequel/02-tuples';
const WIDENING = 'm98-fixture-sequel/01-literal-widening';

const exercisesIn = (lessonId: string): number =>
  exerciseFolders(lessonId).length;
const exercisesInModule = (moduleId: string): number =>
  moduleLessons(moduleId).reduce((sum, id) => sum + exercisesIn(id), 0);

function sortById<T extends { id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The four count cells of a /progress row. */
async function expectCounts(
  row: Locator,
  counts: { exercises: string; hints: number; solutions: number },
): Promise<void> {
  await expect(field(row, 'exercises')).toHaveText(counts.exercises);
  await expect(field(row, 'hints')).toHaveText(String(counts.hints));
  await expect(field(row, 'solutions')).toHaveText(String(counts.solutions));
}

test.describe('§12 F9: `/progress` shows per-module counts, hints used and solutions viewed; `:export` downloads the JSON in §7; import previews and merges as §7 says; each reset scope works with its confirmation.', () => {
  test.use({ timezoneId: ZONE });

  test('per-lesson and per-module counts and the totals: a hint and a solution taken on the lesson page, a predict answered there, passes seeded in the store', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // A hint on one exercise.
    await openExercise(page, '02-implement', '01-largest-shape');
    await ex(page, 'hint');
    await expect(lessonNotice(page)).toHaveText(/^hint 1 of \d+$/);
    await expect
      .poll(
        async () =>
          (await readExerciseRow(page, '02-implement', '01-largest-shape'))
            ?.hintsUsed,
      )
      .toBe(1);
    // The solution of another.
    await openExercise(page, '03-type-challenge', '01-describe-the-events');
    await ex(page, 'sol');
    await expect(solutionPane(page)).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await readExerciseRow(
              page,
              '03-type-challenge',
              '01-describe-the-events',
            )
          )?.solutionViewed,
      )
      .toBe(true);
    // A predict answered right: passed.
    const predict = readExerciseYaml('01-fix', '02-what-is-left');
    await page.goto(exerciseRoute('01-fix', '02-what-is-left'));
    await expectExercise(page, '01-fix', '02-what-is-left');
    await page.keyboard.press('2');
    await expectFocus(page, 'question');
    await answer(page, predictQuestion(page), predict.answer ?? 0);
    await expect
      .poll(
        async () =>
          (await readExerciseRow(page, '01-fix', '02-what-is-left'))?.state,
      )
      .toBe('passed');
    // Two passes in another module, one with two hints and its solution viewed.
    await seedStore(page, {
      exercises: [
        passedExercise(`${TUPLES}/01-tuple-length`, T0, {
          hintsUsed: 2,
          solutionViewed: true,
        }),
        passedExercise(`${TUPLES}/02-optional-element`, T0),
      ],
    });

    await gotoProgress(page);
    // One row per module in roadmap order, each followed by its lessons in order.
    const order = await progressTable(page)
      .locator('tr[data-module], tr[data-lesson]')
      .evaluateAll((rows) =>
        rows.map(
          (row) =>
            row.getAttribute('data-module') ?? row.getAttribute('data-lesson'),
        ),
      );
    expect(order).toEqual(
      [M99, M98, M97].flatMap((id) => [id, ...moduleLessons(id)]),
    );
    for (const id of [M99, M98, M97]) {
      await expect(moduleRow(page, id).locator('th')).toHaveText(
        readModule(id).title,
      );
      await expect(field(moduleRow(page, id), 'lessons')).toHaveText(
        `0 of ${String(coreLessons(id).length)}`,
      );
    }
    for (const id of courseLessons()) {
      const { title, optional } = readLesson(id);
      const th = lessonRowOf(page, id).locator('th');
      await expect(th).toHaveText(optional ? `${title}optional` : title);
      await expect(field(th, 'optional')).toHaveCount(optional ? 1 : 0);
    }

    const m99 = exercisesInModule(M99);
    await expect(moduleRow(page, M99)).toHaveAttribute(
      'data-state',
      'in-progress',
    );
    await expectCounts(moduleRow(page, M99), {
      exercises: `1 of ${String(m99)}`,
      hints: 1,
      solutions: 1,
    });
    await expectCounts(lessonRowOf(page, FIX), {
      exercises: `1 of ${String(exercisesIn(FIX))}`,
      hints: 0,
      solutions: 0,
    });
    await expectCounts(lessonRowOf(page, IMPLEMENT), {
      exercises: `0 of ${String(exercisesIn(IMPLEMENT))}`,
      hints: 1,
      solutions: 0,
    });
    await expectCounts(lessonRowOf(page, CHALLENGE), {
      exercises: `0 of ${String(exercisesIn(CHALLENGE))}`,
      hints: 0,
      solutions: 1,
    });
    for (const id of [FIX, IMPLEMENT, CHALLENGE]) {
      await expect(field(lessonRowOf(page, id), 'state')).toHaveText(
        'in progress',
      );
    }

    await expectCounts(moduleRow(page, M98), {
      exercises: `2 of ${String(exercisesInModule(M98))}`,
      hints: 2,
      solutions: 1,
    });
    await expectCounts(lessonRowOf(page, TUPLES), {
      exercises: `2 of ${String(exercisesIn(TUPLES))}`,
      hints: 2,
      solutions: 1,
    });
    await expect(field(lessonRowOf(page, TUPLES), 'state')).toHaveText(
      'not started',
    );
    await expectCounts(moduleRow(page, M97), {
      exercises: `0 of ${String(exercisesInModule(M97))}`,
      hints: 0,
      solutions: 0,
    });

    await expect(page.locator('[data-field="totals"]')).toHaveText(
      `0 of ${String(courseCoreLessons().length)} lessons complete · 3 of ${String(courseExercises().length)} exercises passed · 3 hints used · 2 solutions viewed`,
    );
  });

  test('`:export` downloads ts-dojo-progress-<local date>.json from the /repl editor, a lesson page’s editor, the palette on /progress and the Export button, and each says so', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const hash = await contentHash();
    const check = (download: Downloaded): void => {
      expectDatedName(download, ZONE);
      expect(Object.keys(download.json)).toEqual(EXPORT_KEYS);
      expect(download.json.schemaVersion).toBe(1);
      expect(download.json.contentVersion).toBe(hash);
    };

    await gotoRepl(page);
    const fromRepl = await catchDownload(page, () => ex(page, 'export'));
    check(fromRepl);
    await expect(vimPanel(page)).toHaveText(`exported ${fromRepl.name}`);
    expect(fromRepl.json.buffers.map((b) => b.name).sort()).toEqual(
      (await bufferNames(page)).sort(),
    );

    await openExercise(page, '02-implement', '01-largest-shape');
    const fromLesson = await catchDownload(page, () => ex(page, 'export'));
    check(fromLesson);
    await expect(lessonNotice(page)).toHaveText(`exported ${fromLesson.name}`);
    expect(fromLesson.json.lessons.map((row) => row.id)).toContain(IMPLEMENT);
    await expectFocus(page, 'editor');

    await gotoProgress(page);
    await expect(page.locator('body')).toBeFocused();
    const fromPalette = await catchDownload(page, () =>
      runFromPalette(page, 'export', ':export'),
    );
    check(fromPalette);
    await expect(progressNotice(page)).toHaveText(
      `exported ${fromPalette.name}`,
    );

    await page.reload();
    await expect(progressTable(page)).toBeVisible();
    await expect(progressNotice(page)).toHaveText('');
    await tabTo(page, page.getByRole('button', { name: 'Export progress' }));
    const fromButton = await catchDownload(page, () =>
      page.keyboard.press('Enter'),
    );
    check(fromButton);
    await expect(progressNotice(page)).toHaveText(
      `exported ${fromButton.name}`,
    );
  });

  test('the exported file is §7’s: the keys in order, schemaVersion, the build’s contentVersion, an ISO exportedAt, every lessons/exercises/buffers row, the newest 5 attempts per exercise without their id, and the settings', async ({
    page,
  }) => {
    const A = `${FIX}/01-handle-the-new-shape`;
    const B = `${IMPLEMENT}/01-largest-shape`;
    const P = `${WIDENING}/01-let-or-const`;
    const attemptsA = [1, 2, 3, 4, 5, 6, 7].map((i) =>
      attempt(A, T0 + i * 1000, {
        kind: i % 2 === 0 ? 'run' : 'test',
        passed: i === 7,
        ms: 10 * i,
      }),
    );
    const attemptsB = [attempt(B, T0 + 500), attempt(B, T0 + 9000)];
    const settings = {
      theme: 'dark',
      relativeNumbers: false,
      layout: 'practice',
      vimrc: 'imap jj <Esc>\n',
    };
    const seed: Required<StoreSeed> = {
      lessons: [
        {
          ...completeLesson(FIX, T0 + 8000),
          lastOpenedAt: T0 + 8000,
          lastExerciseId: A,
          questions: {
            'fix-check': { answerIndex: 1, correct: true, at: T0 + 7500 },
          },
        },
        lessonRow(WIDENING, { lastOpenedAt: T0, layout: 'theory' }),
      ],
      exercises: [
        passedExercise(A, T0 + 7000, {
          attemptsToPass: 7,
          files: { '/index.ts': '// mine\n' },
        }),
        exerciseRow(B, { hintsUsed: 2, updatedAt: T0 + 9000 }),
        exerciseRow(P, { predictAnswer: 0, updatedAt: T0 }),
      ],
      // Inserted interleaved, as two exercises' runs would be.
      attempts: [
        attemptsB[0],
        ...attemptsA.slice(0, 4),
        attemptsB[1],
        ...attemptsA.slice(4),
      ].filter((row) => row !== undefined),
      buffers: [{ name: 'scratch.ts', text: 'const x = 1;\n', updatedAt: T0 }],
      meta: { lastLessonId: FIX },
    };
    await openApp(page);
    await seedAndReload(page, seed, settings);
    await gotoProgress(page);
    const store = await readStore(page);
    expect(store.attempts).toHaveLength(9);

    await expect(page.locator('body')).toBeFocused();
    await tabTo(page, page.getByRole('button', { name: 'Export progress' }));
    const download = await catchDownload(page, () =>
      page.keyboard.press('Enter'),
    );
    expectDatedName(download, ZONE);
    const file = download.json;
    expect(Object.keys(file)).toEqual(EXPORT_KEYS);
    expect(file.schemaVersion).toBe(1);
    expect(file.contentVersion).toBe(await contentHash());
    expect(typeof file.exportedAt).toBe('string');
    expect(new Date(file.exportedAt).toISOString()).toBe(file.exportedAt);
    const at = Date.parse(file.exportedAt);
    expect(at).toBeGreaterThanOrEqual(download.before.getTime() - 1000);
    expect(at).toBeLessThanOrEqual(download.after.getTime() + 1000);

    // Every row of lessons, exercises and buffers, as stored.
    expect(sortById(file.lessons)).toEqual(sortById(store.lessons));
    expect(sortById(file.lessons)).toEqual(sortById(seed.lessons));
    expect(sortById(file.exercises)).toEqual(sortById(store.exercises));
    expect(sortById(file.exercises)).toEqual(sortById(seed.exercises));
    const byName = (rows: readonly BufferRowData[]) =>
      [...rows].sort((a, b) => a.name.localeCompare(b.name));
    expect(byName(file.buffers)).toEqual(byName(store.buffers));
    expect(byName(file.buffers)).toEqual(seed.buffers);

    // The newest 5 of A's 7 attempts, oldest first; both of B's; no local ids.
    expect(file.attempts).toHaveLength(7);
    for (const row of file.attempts)
      expect(Object.keys(row)).not.toContain('id');
    expect(file.attempts.filter((row) => row.exerciseId === A)).toEqual(
      attemptsA.slice(2),
    );
    expect(file.attempts.filter((row) => row.exerciseId === B)).toEqual(
      attemptsB,
    );

    // The settings object as stored.
    expect(file.settings).toEqual(await readStoredSettings(page));
    expect(file.settings).toEqual(settings);
    // Exporting removed nothing.
    expect((await readStore(page)).attempts).toHaveLength(9);
  });

  test('Enter on "Import progress…" opens the file chooser, and the file chosen there opens the preview', async ({
    page,
  }) => {
    // Listen before the page loads: Playwright turns file chooser interception on when the
    // first listener is added, asynchronously, and a press racing it would open the native
    // dialog instead (headless Chrome then shows nothing and no event comes).
    const chooser = page.waitForEvent('filechooser');
    await gotoProgress(page);
    const button = page.getByRole('button', { name: 'Import progress…' });
    await tabTo(page, button);
    await page.keyboard.press('Enter');
    const picked = await chooser;
    expect(picked.isMultiple()).toBe(false);
    const file = {
      schemaVersion: 1,
      contentVersion: await contentHash(),
      exportedAt: new Date(T0).toISOString(),
      lessons: [lessonRow(FIX, { lastOpenedAt: T0 })],
      exercises: [],
      attempts: [],
      buffers: [],
      settings: {},
    };
    await picked.setFiles({
      name: 'chosen.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(file)),
    });
    const dialog = importDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading')).toHaveText('Import chosen.json?');
    await expect(
      dialog.locator('[data-category="lessons"] [data-field="change"]'),
    ).toHaveText('1 new, 0 updated, 0 unchanged');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(progressNotice(page)).toHaveText('import cancelled');
  });

  test('import: the preview names what each category gains, Cancel changes nothing, Apply merges by the §7 rules, the same file again adds nothing, and unreadable files are refused', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const hash = await contentHash();
    const A = `${FIX}/01-handle-the-new-shape`;
    const B = `${IMPLEMENT}/01-largest-shape`;
    const C = `${IMPLEMENT}/02-literal-discriminant`;
    const opened = lessonRow(FIX, { lastOpenedAt: T0, lastExerciseId: A });
    // A: the file's row is newer and passed: it wins and A becomes passed.
    const mineA = exerciseRow(A, { updatedAt: T0 });
    const theirsA = passedExercise(A, T0 + 1000, {
      hintsUsed: 1,
      files: { '/index.ts': '// imported\n' },
    });
    // B: the file's row is older: the store's stays.
    const mineB = exerciseRow(B, {
      updatedAt: T0 + 5000,
      hintsUsed: 2,
      files: { '/index.ts': '// mine, newer\n' },
    });
    const theirsB = exerciseRow(B, { updatedAt: T0 });
    // C: passed here; the file's row is newer but not passed: newer fields, still passed.
    const mineC = passedExercise(C, T0, { attemptsToPass: 2 });
    const theirsC = exerciseRow(C, { updatedAt: T0 + 2000, hintsUsed: 3 });
    const known = attempt(A, T0 + 100, { kind: 'run' });
    const newLesson = lessonRow(IMPLEMENT, {
      lastOpenedAt: T0 + 3000,
      lastExerciseId: C,
    });
    const buffer = { name: 'imported.ts', text: 'export {};\n', updatedAt: T0 };
    const incoming = {
      schemaVersion: 1,
      contentVersion: 'feedface0000-another-build',
      exportedAt: new Date(T0 + 10_000).toISOString(),
      lessons: [opened, newLesson],
      exercises: [theirsA, theirsB, theirsC],
      attempts: [
        known,
        attempt(A, T0 + 200, { kind: 'test' }),
        attempt(A, T0 + 300, { kind: 'test', passed: true }),
      ],
      buffers: [buffer],
      settings: { theme: 'dark', relativeNumbers: false },
    };
    const NAME = 'backup.json';
    const chooseFile = async (
      name: string,
      text: string,
      mimeType = 'application/json',
    ): Promise<void> => {
      await fileInput(page).setInputFiles({
        name,
        mimeType,
        buffer: Buffer.from(text),
      });
    };
    const dialog = importDialog(page);
    const line = (category: string) =>
      dialog.locator(`[data-category="${category}"] [data-field="change"]`);

    await openApp(page);
    await seedAndReload(
      page,
      {
        lessons: [opened],
        exercises: [mineA, mineB, mineC],
        attempts: [known],
      },
      { theme: 'light', relativeNumbers: false },
    );
    await gotoProgress(page);
    const before = await readStore(page);
    const settingsBefore = await readStoredSettings(page);

    // The preview.
    await chooseFile(NAME, JSON.stringify(incoming));
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading')).toHaveText(`Import ${NAME}?`);
    await expect(line('lessons')).toHaveText('1 new, 0 updated, 1 unchanged');
    await expect(line('exercises')).toHaveText(
      '0 new, 2 updated, 1 unchanged; 1 newly passed',
    );
    await expect(line('attempts')).toHaveText('2 added, 1 already here');
    await expect(line('buffers')).toHaveText('1 new, 0 updated, 0 unchanged');
    await expect(line('settings')).toHaveText('theme changed');
    const version = dialog.locator('[data-field="content-version"]');
    await expect(version).toContainText(incoming.contentVersion.slice(0, 12));
    await expect(version).toContainText(hash.slice(0, 12));
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const apply = dialog.getByRole('button', { name: 'Apply' });
    await expect(cancel).toBeFocused();

    // Cancel (Enter on the focused button): nothing changes.
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(progressNotice(page)).toHaveText('import cancelled');
    expect(await readStore(page)).toEqual(before);
    expect(await readStoredSettings(page)).toEqual(settingsBefore);

    // Again, and Apply.
    await chooseFile(NAME, JSON.stringify(incoming));
    await expect(dialog).toBeVisible();
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(apply).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(progressNotice(page)).toHaveText(`imported ${NAME}`);

    const after = await readStore(page);
    const exercise = (id: string) =>
      after.exercises.find((row) => row.id === id);
    expect(sortById(after.lessons)).toEqual(sortById([opened, newLesson]));
    expect(exercise(A), 'the newer incoming row wins').toEqual(theirsA);
    expect(exercise(B), 'the older incoming row loses').toEqual(mineB);
    expect(
      exercise(C),
      'passed stays passed under a newer unpassed row',
    ).toEqual({
      ...theirsC,
      state: 'passed',
      passedAt: mineC.passedAt,
      attemptsToPass: mineC.attemptsToPass,
    });
    const attemptsOf = (dump: StoreDump, id: string) =>
      dump.attempts
        .filter((row) => row.exerciseId === id)
        .map((row) => row.at)
        .sort((a, b) => a - b);
    expect(attemptsOf(after, A), 'appended, the one already here once').toEqual(
      [T0 + 100, T0 + 200, T0 + 300],
    );
    expect(after.buffers).toEqual([buffer]);
    expect(typeof metaValue(after, 'importedAt')).toBe('number');
    expect(await readStoredSettings(page)).toEqual({
      theme: 'dark',
      relativeNumbers: false,
    });
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    // The page shows the merge: A and C passed, C's newer hints.
    await expect(field(lessonRowOf(page, FIX), 'exercises')).toHaveText(
      `1 of ${String(exercisesIn(FIX))}`,
    );
    await expect(field(lessonRowOf(page, IMPLEMENT), 'exercises')).toHaveText(
      `1 of ${String(exercisesIn(IMPLEMENT))}`,
    );
    await expect(field(lessonRowOf(page, IMPLEMENT), 'hints')).toHaveText('5');

    // The same file once more: everything is already here.
    await chooseFile(NAME, JSON.stringify(incoming));
    await expect(dialog).toBeVisible();
    await expect(line('lessons')).toHaveText('0 new, 0 updated, 2 unchanged');
    await expect(line('exercises')).toHaveText('0 new, 0 updated, 3 unchanged');
    await expect(line('attempts')).toHaveText('0 added, 3 already here');
    await expect(line('buffers')).toHaveText('0 new, 0 updated, 1 unchanged');
    await expect(line('settings')).toHaveText('no change');
    await page.keyboard.press('Tab');
    await expect(apply).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(progressNotice(page)).toHaveText(`imported ${NAME}`);
    const again = await readStore(page);
    expect(attemptsOf(again, A), 'attempts appended once').toEqual(
      attemptsOf(after, A),
    );
    expect(sortById(again.exercises)).toEqual(sortById(after.exercises));

    // Unreadable files: refused with the reason, no preview, nothing changed.
    const refused: [name: string, text: string, reason: RegExp][] = [
      [
        'notes.txt',
        'this is not JSON',
        /^cannot import notes\.txt: not a JSON file$/,
      ],
      [
        'other.json',
        '{"hello": 1}',
        /^cannot import other\.json: not a ts-dojo progress file/,
      ],
      [
        'future.json',
        JSON.stringify({ ...incoming, schemaVersion: 2 }),
        /^cannot import future\.json: made by a newer ts-dojo/,
      ],
    ];
    for (const [name, text, reason] of refused) {
      await chooseFile(
        name,
        text,
        name.endsWith('.txt') ? 'text/plain' : 'application/json',
      );
      await expect(progressNotice(page)).toHaveText(reason);
      await expect(dialog).toHaveCount(0);
      expect(await readStore(page), `${name} changed nothing`).toEqual(again);
    }
  });

  const RESET_SEED = (): StoreSeed => ({
    lessons: [
      completeLesson(FIX, T0),
      lessonRow(IMPLEMENT, { lastOpenedAt: T0 }),
      lessonRow(WIDENING, { lastOpenedAt: T0 + 1 }),
    ],
    exercises: [
      passedExercise(`${FIX}/01-handle-the-new-shape`, T0),
      passedExercise(`${FIX}/02-what-is-left`, T0),
      exerciseRow(`${IMPLEMENT}/01-largest-shape`, {
        hintsUsed: 1,
        updatedAt: T0,
      }),
      passedExercise(`${WIDENING}/01-let-or-const`, T0),
    ],
    attempts: [
      attempt(`${FIX}/01-handle-the-new-shape`, T0),
      attempt(`${FIX}/01-handle-the-new-shape`, T0 + 1),
      attempt(`${IMPLEMENT}/01-largest-shape`, T0 + 2),
      attempt(`${WIDENING}/01-let-or-const`, T0 + 3),
    ],
    buffers: [{ name: 'scratch.ts', text: '// kept?\n', updatedAt: T0 }],
    meta: { lastLessonId: WIDENING },
  });
  const RESET_SETTINGS = { theme: 'light', relativeNumbers: false };

  /** The dump without the rows of these lessons (and their exercises and attempts). */
  function without(dump: StoreDump, lessonIds: readonly string[]): StoreDump {
    const under = (id: string) =>
      lessonIds.some((lesson) => id.startsWith(`${lesson}/`));
    return {
      ...dump,
      lessons: dump.lessons.filter((row) => !lessonIds.includes(row.id)),
      exercises: dump.exercises.filter((row) => !under(row.id)),
      attempts: dump.attempts.filter((row) => !under(row.exerciseId)),
    };
  }

  async function seededProgress(page: Page): Promise<StoreDump> {
    await openApp(page);
    await seedAndReload(page, RESET_SEED(), RESET_SETTINGS);
    await gotoProgress(page);
    await expect(page.locator('body')).toBeFocused();
    return readStore(page);
  }

  test('reset one lesson: Cancel and Esc keep everything; Reset (Tab, Enter) removes that lesson’s lesson, exercise and attempt rows and nothing else', async ({
    page,
  }) => {
    const before = await seededProgress(page);
    const title = readLesson(FIX).title;
    const button = page.getByRole('button', {
      name: `Reset the lesson ${title}`,
      exact: true,
    });
    const dialog = resetDialog(page, 'lesson');
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const reset = dialog.getByRole('button', { name: 'Reset', exact: true });

    await tabTo(page, button);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading')).toHaveText(
      `Reset the lesson ${title}?`,
    );
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    expect(await readStore(page), 'Cancel kept every row').toEqual(before);

    await tabTo(page, button);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await readStore(page), 'Esc kept every row').toEqual(before);

    await tabTo(page, button);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(reset).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(progressNotice(page)).toHaveText(`reset the lesson ${title}`);
    await expect.poll(() => readStore(page)).toEqual(without(before, [FIX]));
    expect(await readStoredSettings(page)).toEqual(RESET_SETTINGS);
    await expect(lessonRowOf(page, FIX)).toHaveAttribute(
      'data-state',
      'not-started',
    );
    await expect(field(lessonRowOf(page, FIX), 'exercises')).toHaveText(
      `0 of ${String(exercisesIn(FIX))}`,
    );
    await expect(field(lessonRowOf(page, IMPLEMENT), 'hints')).toHaveText('1');
  });

  test('reset one module: Cancel keeps everything; Reset removes the rows of all its lessons and nothing else', async ({
    page,
  }) => {
    const before = await seededProgress(page);
    const title = readModule(M99).title;
    const button = page.getByRole('button', {
      name: `Reset the module ${title}`,
      exact: true,
    });
    const dialog = resetDialog(page, 'module');
    const cancel = dialog.getByRole('button', { name: 'Cancel' });

    await tabTo(page, button);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading')).toHaveText(
      `Reset the module ${title}?`,
    );
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    expect(await readStore(page), 'Cancel kept every row').toEqual(before);

    await tabTo(page, button);
    await page.keyboard.press('Enter');
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      dialog.getByRole('button', { name: 'Reset', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(progressNotice(page)).toHaveText(`reset the module ${title}`);
    await expect
      .poll(() => readStore(page))
      .toEqual(without(before, moduleLessons(M99)));
    expect(await readStoredSettings(page)).toEqual(RESET_SETTINGS);
    await expect(moduleRow(page, M99)).toHaveAttribute(
      'data-state',
      'not-started',
    );
    await expect(field(lessonRowOf(page, WIDENING), 'exercises')).toHaveText(
      `1 of ${String(exercisesIn(WIDENING))}`,
    );
  });

  test('reset everything: Reset stays disabled until the word reset is typed (Enter on "rese" does nothing); then Enter clears lessons, exercises, attempts and buffers and keeps the settings and the version keys', async ({
    page,
  }) => {
    const before = await seededProgress(page);
    const dialog = resetDialog(page, 'everything');
    const word = dialog.getByLabel('Type reset to confirm');
    const reset = dialog.getByRole('button', { name: 'Reset', exact: true });

    await tabTo(page, page.getByRole('button', { name: 'Reset everything…' }));
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(word).toBeFocused();
    await expect(reset).toBeDisabled();
    await page.keyboard.type('rese');
    await expect(word).toHaveValue('rese');
    await expect(reset).toBeDisabled();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    expect(await readStore(page), 'Enter on "rese" reset nothing').toEqual(
      before,
    );
    await page.keyboard.type('t');
    await expect(word).toHaveValue('reset');
    await expect(reset).toBeEnabled();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(progressNotice(page)).toHaveText('reset everything');

    await expect
      .poll(async () => {
        const dump = await readStore(page);
        return [
          dump.lessons.length,
          dump.exercises.length,
          dump.attempts.length,
          dump.buffers.length,
        ];
      })
      .toEqual([0, 0, 0, 0]);
    const after = await readStore(page);
    expect(metaValue(after, 'schemaVersion')).toBe(1);
    expect(metaValue(after, 'schemaVersion')).toBe(
      metaValue(before, 'schemaVersion'),
    );
    expect(metaValue(after, 'contentVersion')).toBe(await contentHash());
    expect(metaValue(after, 'lastLessonId')).toBeUndefined();
    expect(await readStoredSettings(page)).toEqual(RESET_SETTINGS);
    await expect(page.locator('[data-field="totals"]')).toHaveText(
      `0 of ${String(courseCoreLessons().length)} lessons complete · 0 of ${String(courseExercises().length)} exercises passed · 0 hints used · 0 solutions viewed`,
    );
  });
});

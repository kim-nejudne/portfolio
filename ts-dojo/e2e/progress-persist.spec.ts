// §12 F9, progress over time (spec §7 Store; §7 Content versions: "A rename goes into
// `content/renames.yaml` (`old: new`) and the store applies it when it opens", "A removed lesson
// keeps its rows; they are ignored and listed on `/progress` under 'orphaned'", "`contentVersion`
// is the content tree's hash at build time"), in Chrome:
//   5. "Progress survives a reload and a content deploy; a `renames.yaml` entry migrates an id
//      (fixture rename)."
// A reload: progress made on the lesson pages (two `predict` answers and `:done` completing an
// m98 lesson, a `:hint` on m99) shows on the roadmap card, the module page and /progress, each
// before and after a reload. A content deploy: rows recorded under an old `contentVersion`,
// some for a lesson the content no longer has, survive the next open; `meta.contentVersion`
// becomes this build's hash (computed in Node with src/content/node/content-version.ts); the
// removed ids are listed as orphaned and the counts ignore them. The fixture renames: rows
// seeded under the old ids of both `renames.yaml` entries (a lesson and an exercise, read from
// the file) are under the new ids after the next open, everywhere they were referenced, and the
// pages count them; a second open changes nothing. Rows are seeded and read straight from
// IndexedDB (e2e/helpers/progress.ts). Keyboard only; no fixed sleeps.
import { expect, test, type Page } from '@playwright/test';
import { ex } from './helpers/editor';
import {
  contentHash,
  courseCoreLessons,
  courseExercises,
  courseLessons,
  exerciseFolders,
  lessonOf,
  minutesOf,
  moduleLessons,
  readExercise,
  readLesson,
  readRenames,
  readTiers,
  routeOf,
} from './helpers/course';
import {
  answer,
  chip,
  expectExerciseAt,
  expectFocus,
  lessonNotice,
  openExercise,
  predictQuestion,
  readExerciseRow,
  runFromPalette,
} from './helpers/lesson';
import {
  attempt,
  card,
  completeLesson,
  continueBar,
  exerciseRow,
  expectRoadmap,
  field,
  gotoProgress,
  lessonRow,
  lessonRowOf,
  metaValue,
  moduleLessonItem,
  moduleLessonItems,
  moduleRow,
  openApp,
  passedExercise,
  readStore,
  ring,
  seedStore,
  type StoreDump,
} from './helpers/progress';

const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const [M99, M98] = readTiers().flatMap((tier) => tier.modules) as [
  string,
  string,
];
const FIX = 'm99-fixtures/01-fix';
const IMPLEMENT = 'm99-fixtures/02-implement';
const WIDENING = 'm98-fixture-sequel/01-literal-widening';
const UNSAVED_KEY = 'ts-dojo:unsaved';

const totals = (counts: {
  lessons: number;
  passed: number;
  hints: number;
  solutions: number;
}): string =>
  `${String(counts.lessons)} of ${String(courseCoreLessons().length)} lessons complete · ${String(counts.passed)} of ${String(courseExercises().length)} exercises passed · ${String(counts.hints)} ${counts.hints === 1 ? 'hint used' : 'hints used'} · ${String(counts.solutions)} ${counts.solutions === 1 ? 'solution viewed' : 'solutions viewed'}`;

function sortById<T extends { id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

async function gotoModule(page: Page, moduleId: string): Promise<void> {
  await page.goto(`/m/${moduleId}`);
  await expect(
    page.locator(`section[data-module="${moduleId}"]`),
  ).toBeVisible();
}

/** Checks the page as it is, reloads, and checks it again. */
async function checkAndReload(
  page: Page,
  check: () => Promise<void>,
): Promise<void> {
  await check();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await check();
}

test.describe('§12 F9: Progress survives a reload and a content deploy; a `renames.yaml` entry migrates an id (fixture rename).', () => {
  test('progress made on the lesson pages shows on the roadmap card, the module page and /progress, before and after a reload', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const [first, second] = exerciseFolders(WIDENING) as [string, string];
    // Two predict answers, right, from the keyboard.
    for (const [i, folder] of [first, second].entries()) {
      const id = `${WIDENING}/${folder}`;
      if (i === 0) {
        await page.goto(routeOf(id));
      } else {
        await runFromPalette(page, 'next', ':next');
      }
      await expectExerciseAt(page, WIDENING, folder);
      await page.keyboard.press('2');
      await expectFocus(page, 'question');
      const yaml = readExercise(id);
      expect(yaml.kind).toBe('predict');
      await answer(page, predictQuestion(page), yaml.answer ?? 0);
      await expect(chip(page, folder)).toHaveAttribute('data-state', 'passed');
    }
    // The lesson has no Check yourself question: `:done` marks the theory read, and with both
    // exercises passed the lesson is complete.
    await runFromPalette(page, 'done', ':done');
    await expect(lessonNotice(page)).toHaveText(
      'Theory read. Lesson complete.',
    );
    await expect
      .poll(
        async () =>
          (await readStore(page)).lessons.find((row) => row.id === WIDENING)
            ?.state,
      )
      .toBe('complete');
    // A hint on an m99 exercise.
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

    const others = moduleLessons(M98).filter((id) => id !== WIDENING);
    await page.goto('/');
    await expectRoadmap(page);
    await checkAndReload(page, async () => {
      const m98 = card(page, M98);
      await expect(m98).toHaveAttribute('data-state', 'in-progress');
      await expect(field(m98, 'progress')).toHaveText(
        `1 of ${String(moduleLessons(M98).length)} lessons complete`,
      );
      await expect(field(m98, 'minutes')).toHaveText(
        `${String(minutesOf(others))} min left`,
      );
      expect(Number(await ring(m98).getAttribute('data-progress'))).toBeCloseTo(
        1 / moduleLessons(M98).length,
        5,
      );
      await expect(field(card(page, M99), 'progress')).toHaveText(
        `0 of ${String(moduleLessons(M99).length)} lessons complete`,
      );
      await expect(card(page, M99)).toHaveAttribute(
        'data-state',
        'in-progress',
      );
    });

    await gotoModule(page, M98);
    await checkAndReload(page, async () => {
      await expect(
        page.locator(`section[data-module="${M98}"]`),
      ).toHaveAttribute('data-state', 'in-progress');
      await expect(moduleLessonItem(page, WIDENING)).toHaveAttribute(
        'data-state',
        'complete',
      );
      await expect(field(moduleLessonItem(page, WIDENING), 'state')).toHaveText(
        'complete',
      );
      for (const id of others) {
        await expect(moduleLessonItem(page, id)).toHaveAttribute(
          'data-state',
          'not-started',
        );
      }
    });

    await gotoProgress(page);
    await checkAndReload(page, async () => {
      await expect(field(moduleRow(page, M98), 'lessons')).toHaveText(
        `1 of ${String(moduleLessons(M98).length)}`,
      );
      await expect(lessonRowOf(page, WIDENING)).toHaveAttribute(
        'data-state',
        'complete',
      );
      await expect(field(lessonRowOf(page, WIDENING), 'exercises')).toHaveText(
        '2 of 2',
      );
      await expect(field(lessonRowOf(page, IMPLEMENT), 'hints')).toHaveText(
        '1',
      );
      await expect(field(moduleRow(page, M99), 'hints')).toHaveText('1');
      await expect(page.locator('[data-field="totals"]')).toHaveText(
        totals({ lessons: 1, passed: 2, hints: 1, solutions: 0 }),
      );
    });
  });

  test('a content deploy: rows recorded under an old contentVersion survive, including a removed lesson’s; contentVersion becomes this build’s; the removed ids are orphaned and not counted', async ({
    page,
  }) => {
    const hash = await contentHash();
    const REMOVED = 'm99-fixtures/09-removed';
    const GONE = `${REMOVED}/01-gone`;
    expect(courseLessons()).not.toContain(REMOVED);
    await openApp(page);
    expect(
      metaValue(await readStore(page), 'contentVersion'),
      'the first open recorded this build',
    ).toBe(hash);

    // The store as an earlier build left it.
    const seed = {
      lessons: [
        completeLesson(REMOVED, T0),
        lessonRow(FIX, { lastOpenedAt: T0 }),
      ],
      exercises: [
        passedExercise(GONE, T0, { hintsUsed: 4, solutionViewed: true }),
        passedExercise(`${FIX}/02-what-is-left`, T0, { predictAnswer: 1 }),
      ],
      attempts: [attempt(GONE, T0)],
      meta: { contentVersion: '0000-old', lastLessonId: FIX },
    };
    await seedStore(page, seed);
    const old = await readStore(page);
    expect(metaValue(old, 'contentVersion')).toBe('0000-old');

    await page.reload();
    await expectRoadmap(page);
    await expect
      .poll(async () => metaValue(await readStore(page), 'contentVersion'))
      .toBe(hash);
    const after = await readStore(page);
    expect(metaValue(after, 'schemaVersion')).toBe(1);
    // Nothing was lost: every row is still there, the removed lesson's too.
    expect(after.lessons).toEqual(old.lessons);
    expect(after.exercises).toEqual(old.exercises);
    expect(after.attempts).toEqual(old.attempts);
    expect(metaValue(after, 'lastLessonId')).toBe(FIX);

    // The roadmap counts ignore the removed lesson (complete) and its exercise.
    await expect(field(card(page, M99), 'progress')).toHaveText(
      `0 of ${String(moduleLessons(M99).length)} lessons complete`,
    );
    await expect(card(page, M99)).toHaveAttribute('data-state', 'in-progress');
    await expect(continueBar(page)).toHaveAttribute(
      'data-continue',
      'continue',
    );
    await expect(field(continueBar(page), 'lesson')).toHaveText(
      readLesson(FIX).title,
    );

    await gotoModule(page, M99);
    await expect(moduleLessonItems(page)).toHaveCount(
      moduleLessons(M99).length,
    );
    await expect(page.locator(`li[data-lesson="${REMOVED}"]`)).toHaveCount(0);

    await gotoProgress(page);
    const orphaned = page.getByRole('region', { name: 'Orphaned' });
    await expect(orphaned).toBeVisible();
    await expect(orphaned.getByRole('heading', { level: 2 })).toHaveText(
      'Orphaned',
    );
    await expect(orphaned.locator('li[data-orphan]')).toHaveText([
      REMOVED,
      GONE,
    ]);
    await expect(orphaned.locator(`li[data-orphan="${REMOVED}"]`)).toHaveCount(
      1,
    );
    await expect(orphaned.locator(`li[data-orphan="${GONE}"]`)).toHaveCount(1);
    await expect(page.locator('[data-field="totals"]')).toHaveText(
      totals({ lessons: 0, passed: 1, hints: 0, solutions: 0 }),
    );
    await expect(lessonRowOf(page, REMOVED)).toHaveCount(0);
    await expect(page.locator('[data-field="content-version"]')).toHaveText(
      hash.slice(0, 12),
    );

    // Still there after another open.
    await page.reload();
    await expect(orphaned.locator('li[data-orphan]')).toHaveText([
      REMOVED,
      GONE,
    ]);
    expect((await readStore(page)).exercises).toEqual(old.exercises);
  });

  test('the fixture renames: rows under the old lesson id and the old exercise id are under the new ids after the next open, everywhere they were referenced; the pages count them; a second open changes nothing', async ({
    page,
  }) => {
    const renames = readRenames();
    const isLesson = (id: string) => id.split('/').length === 2;
    const lessonRename = renames.find(([from]) => isLesson(from));
    const exerciseRename = renames.find(([from]) => !isLesson(from));
    if (lessonRename === undefined || exerciseRename === undefined) {
      throw new Error(
        'renames.yaml needs a lesson and an exercise fixture rename',
      );
    }
    const [oldLesson, newLesson] = lessonRename;
    const [oldExercise, newExercise] = exerciseRename;
    expect(courseLessons()).toContain(newLesson);
    expect(courseLessons()).not.toContain(oldLesson);
    expect(courseExercises()).toContain(newExercise);
    expect(courseExercises()).not.toContain(oldExercise);
    const folders = exerciseFolders(newLesson);
    const [f1, f2] = folders as [string, string];
    const exerciseLesson = lessonOf(newExercise);
    expect(lessonOf(oldExercise)).toBe(exerciseLesson);

    const oldLessonRow = {
      ...completeLesson(oldLesson, T0),
      lastOpenedAt: T0 + 2,
      lastExerciseId: `${oldLesson}/${f2}`,
    };
    const otherLesson = lessonRow(exerciseLesson, {
      lastOpenedAt: T0 - 5000,
      lastExerciseId: oldExercise,
    });
    const oldExercises = [
      passedExercise(`${oldLesson}/${f1}`, T0),
      passedExercise(`${oldLesson}/${f2}`, T0, { predictAnswer: 1 }),
      exerciseRow(oldExercise, { hintsUsed: 2, updatedAt: T0 }),
    ];
    expect(oldExercises[0]?.lessonId).toBe(oldLesson);
    await openApp(page);
    await seedStore(page, {
      lessons: [oldLessonRow, otherLesson],
      exercises: oldExercises,
      attempts: [
        attempt(`${oldLesson}/${f1}`, T0),
        attempt(oldExercise, T0 + 1),
      ],
      meta: { lastLessonId: oldLesson },
    });
    // An unsaved-text journal entry under the old exercise id (src/store/unsaved.ts).
    await page.evaluate(
      ({ key, id }) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            [id]: { '/index.ts': '// typed before the deploy\n' },
          }),
        ),
      { key: UNSAVED_KEY, id: `${oldLesson}/${f1}` },
    );

    await page.reload();
    await expectRoadmap(page);
    const renamed = (id: string): string =>
      id === oldExercise
        ? newExercise
        : id.startsWith(`${oldLesson}/`)
          ? newLesson + id.slice(oldLesson.length)
          : id === oldLesson
            ? newLesson
            : id;
    const expected: Pick<StoreDump, 'lessons' | 'exercises'> = {
      lessons: sortById([
        {
          ...oldLessonRow,
          id: newLesson,
          lastExerciseId: `${newLesson}/${f2}`,
        },
        { ...otherLesson, lastExerciseId: newExercise },
      ]),
      exercises: sortById(
        oldExercises.map((row) => ({
          ...row,
          id: renamed(row.id),
          lessonId: lessonOf(renamed(row.id)),
        })),
      ),
    };
    const after = await readStore(page);
    expect(sortById(after.lessons)).toEqual(expected.lessons);
    expect(sortById(after.exercises)).toEqual(expected.exercises);
    expect(after.attempts.map((row) => row.exerciseId).sort()).toEqual(
      [`${newLesson}/${f1}`, newExercise].sort(),
    );
    expect(metaValue(after, 'lastLessonId')).toBe(newLesson);
    const journal = await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key) ?? '{}') as Record<
          string,
          unknown
        >,
      UNSAVED_KEY,
    );
    expect(journal).toEqual({
      [`${newLesson}/${f1}`]: { '/index.ts': '// typed before the deploy\n' },
    });

    // The pages count the moved rows.
    await expect(field(card(page, M99), 'progress')).toHaveText(
      `1 of ${String(moduleLessons(M99).length)} lessons complete`,
    );
    const bar = continueBar(page);
    await expect(bar).toHaveAttribute('data-continue', 'continue');
    await expect(field(bar, 'exercise')).toHaveText(
      readExercise(`${newLesson}/${f2}`).title,
    );
    await expect(field(bar, 'lesson')).toHaveText(readLesson(newLesson).title);
    await expect(bar).toHaveAttribute('href', routeOf(`${newLesson}/${f2}`));

    await gotoModule(page, M99);
    await expect(moduleLessonItem(page, newLesson)).toHaveAttribute(
      'data-state',
      'complete',
    );

    await gotoProgress(page);
    await expect(lessonRowOf(page, newLesson)).toHaveAttribute(
      'data-state',
      'complete',
    );
    await expect(field(lessonRowOf(page, newLesson), 'exercises')).toHaveText(
      `${String(folders.length)} of ${String(folders.length)}`,
    );
    await expect(field(lessonRowOf(page, exerciseLesson), 'hints')).toHaveText(
      '2',
    );
    await expect(
      page.getByRole('heading', { level: 2, name: 'Orphaned' }),
    ).toHaveCount(0);

    // Idempotent: another open moves nothing.
    await page.reload();
    await expect(field(lessonRowOf(page, exerciseLesson), 'hints')).toHaveText(
      '2',
    );
    const again = await readStore(page);
    expect(sortById(again.lessons)).toEqual(expected.lessons);
    expect(sortById(again.exercises)).toEqual(expected.exercises);
    expect(again.attempts).toEqual(after.attempts);
  });
});

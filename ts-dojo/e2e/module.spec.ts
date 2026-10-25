// §12 F9, "Recommended first" and the module page (spec §6 Roadmap: "A module whose
// prerequisites are not complete shows 'Recommended first: …' on its card and on its page. It
// still opens."; §6 Module page: "The module's summary, prerequisites with their state, then its
// lessons in order: state, title, minutes, objectives on expand. `j`/`k`/`Enter`."), from the
// keyboard in Chrome:
//   3. "A module with unmet prerequisites shows "Recommended first" and still opens."
// On a fresh store m98 (prerequisite m99) and m97 (m99 and m98) are recommended after their
// prerequisites on the card and on the page, and both open: the m98 card from the keyboard, its
// lessons with `j`/`k` (the focused one shows its objectives and its own §1 lesson-level note,
// the others stay folded) and `Enter`. With m99 seeded complete the note goes from the cards and
// the pages. Titles, summaries, minutes, objectives and prerequisites are read from content/ at
// test time. Keyboard only; no fixed sleeps.
import { expect, test, type Page } from '@playwright/test';
import {
  exerciseFolders,
  moduleLessons,
  readLesson,
  readModule,
  readTiers,
} from './helpers/course';
import { expectExerciseAt } from './helpers/lesson';
import {
  card,
  completeLesson,
  expectFocusedCard,
  expectRoadmap,
  field,
  lessonLink,
  moduleLessonItem,
  moduleLessonItems,
  openApp,
  prerequisites,
  ring,
  seedAndReload,
} from './helpers/progress';

const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const [M99, M98, M97] = readTiers().flatMap((tier) => tier.modules) as [
  string,
  string,
  string,
];
const title = (moduleId: string): string => readModule(moduleId).title;

/** `/m/<id>` with its heading rendered. */
async function gotoModule(page: Page, moduleId: string): Promise<void> {
  await page.goto(`/m/${moduleId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    title(moduleId),
  );
}

/** The lesson link with the focus, or what has it instead. */
async function focusedLesson(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (active === null || active === document.body) return 'body';
    return (
      active.getAttribute('data-lesson-link') ?? active.tagName.toLowerCase()
    );
  });
}

/** Exactly the focused lesson shows its details (objectives, lesson-level note); the rest are folded. */
async function expectExpanded(page: Page, open: string | null): Promise<void> {
  for (const id of moduleLessons(M98)) {
    const details = field(moduleLessonItem(page, id), 'details');
    if (id === open) await expect(details, `${id} expanded`).toBeVisible();
    else await expect(details, `${id} folded`).toBeHidden();
  }
}

test.describe('§12 F9: A module with unmet prerequisites shows "Recommended first" and still opens.', () => {
  test('on the roadmap, m98 and m97 recommend their unfinished prerequisites by title and m99 recommends nothing', async ({
    page,
  }) => {
    expect(readModule(M99).prerequisites).toEqual([]);
    expect(readModule(M98).prerequisites).toEqual([M99]);
    expect(readModule(M97).prerequisites).toEqual([M99, M98]);
    await openApp(page);
    await expect(field(card(page, M99), 'recommended')).toHaveCount(0);
    await expect(field(card(page, M98), 'recommended')).toHaveText(
      `Recommended first: ${title(M99)}`,
    );
    await expect(field(card(page, M97), 'recommended')).toHaveText(
      `Recommended first: ${title(M99)}, ${title(M98)}`,
    );
    await expect(field(card(page, M98), 'recommended')).toHaveText(
      'Recommended first: Pipeline fixtures',
    );
  });

  test('the m98 card opens from the keyboard anyway: its page has the summary, the note, the prerequisite with its state and the lessons in order', async ({
    page,
  }) => {
    const m98 = readModule(M98);
    await openApp(page);
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expectFocusedCard(page, M98);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/m/${M98}`);

    const section = page.locator(`section[data-module="${M98}"]`);
    await expect(section).toHaveAttribute('data-state', 'not-started');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(m98.title);
    await expect(section.getByText(m98.summary, { exact: true })).toBeVisible();

    const prereqs = prerequisites(page);
    await expect(prereqs.locator('li[data-prerequisite]')).toHaveCount(1);
    const m99 = prereqs.locator(`li[data-prerequisite="${M99}"]`);
    await expect(m99).toHaveAttribute('data-state', 'not-started');
    await expect(m99).toContainText('not started');
    await expect(m99.getByRole('link')).toHaveText(title(M99));
    await expect(m99.getByRole('link')).toHaveAttribute('href', `/m/${M99}`);
    await expect(prereqs.locator('p[data-field="recommended"]')).toHaveText(
      `Recommended first: ${title(M99)}`,
    );

    const lessons = moduleLessons(M98);
    await expect(moduleLessonItems(page)).toHaveCount(lessons.length);
    for (const [i, id] of lessons.entries()) {
      const item = moduleLessonItems(page).nth(i);
      const lesson = readLesson(id);
      await expect(item).toHaveAttribute('data-lesson', id);
      await expect(item).toHaveAttribute('data-state', 'not-started');
      await expect(lessonLink(page, id)).toHaveText(lesson.title);
      await expect(lessonLink(page, id)).toHaveAttribute('href', `/l/${id}`);
      await expect(item).toContainText(`${String(lesson.minutes)} min`);
      await expect(field(item, 'state')).toHaveText('not started');
    }
    // Nothing is focused on load, so every lesson is folded.
    await expect(page.locator('body')).toBeFocused();
    await expectExpanded(page, null);
  });

  test('j/k move between the lessons and the focused one shows its objectives and its own recommended-first note; Enter opens it on its first unfinished exercise', async ({
    page,
  }) => {
    const lessons = moduleLessons(M98);
    const [first, second, third] = lessons as [string, string, string];
    await gotoModule(page, M98);
    await expect(page.locator('body')).toBeFocused();

    const step = async (key: string, to: string): Promise<void> => {
      await page.keyboard.press(key);
      await expect
        .poll(() => focusedLesson(page), { message: `${key} → ${to}` })
        .toBe(to);
      await expectExpanded(page, to);
      const item = moduleLessonItem(page, to);
      const objectives = field(item, 'details').locator('li');
      const lesson = readLesson(to);
      expect(lesson.objectives.length).toBeGreaterThan(0);
      await expect(objectives).toHaveText(lesson.objectives);
      for (const objective of await objectives.all()) {
        await expect(objective).toBeVisible();
      }
      // §1 lesson prerequisites, none of them complete on a fresh store.
      const note = field(item, 'lesson-recommended');
      if (lesson.prerequisites.length === 0) {
        await expect(note).toHaveCount(0);
        return;
      }
      await expect(note).toHaveText(
        `Recommended first: ${lesson.prerequisites.map((p) => readLesson(p).title).join(', ')}`,
      );
      await expect(note).toBeVisible();
    };
    await step('j', first);
    await step('j', second);
    await step('j', third);
    await step('j', third);
    await step('k', second);
    await step('k', first);
    await step('k', first);
    await step('j', second);

    await page.keyboard.press('Enter');
    const [exercise] = exerciseFolders(second);
    if (exercise === undefined) throw new Error(`${second} has no exercise`);
    await expectExerciseAt(page, second, exercise);
  });

  test('with no lesson focused, k also focuses the first lesson', async ({
    page,
  }) => {
    await gotoModule(page, M98);
    await expect(page.locator('body')).toBeFocused();
    await page.keyboard.press('k');
    await expect
      .poll(() => focusedLesson(page))
      .toBe(moduleLessons(M98)[0] ?? '');
  });

  test('m97, with two prerequisites unmet, lists both on its page and opens a lesson all the same', async ({
    page,
  }) => {
    await gotoModule(page, M97);
    await expect(
      prerequisites(page).locator('li[data-prerequisite]'),
    ).toHaveCount(2);
    for (const id of [M99, M98]) {
      await expect(
        prerequisites(page).locator(`li[data-prerequisite="${id}"]`),
      ).toHaveAttribute('data-state', 'not-started');
    }
    await expect(
      prerequisites(page).locator('p[data-field="recommended"]'),
    ).toHaveText(`Recommended first: ${title(M99)}, ${title(M98)}`);
    await page.keyboard.press('j');
    const [first] = moduleLessons(M97);
    if (first === undefined) throw new Error('m97 has no lesson');
    await expect.poll(() => focusedLesson(page)).toBe(first);
    await page.keyboard.press('Enter');
    await expectExerciseAt(page, first, exerciseFolders(first)[0] ?? '');
  });

  test('once m99 is complete the note is gone from the m98 card and page, m99 shows complete there, and m97 still recommends m98', async ({
    page,
  }) => {
    const m99 = moduleLessons(M99);
    await openApp(page);
    await seedAndReload(page, {
      lessons: m99.map((id) => completeLesson(id, T0)),
    });
    await expectRoadmap(page);
    await expect(field(card(page, M98), 'recommended')).toHaveCount(0);
    await expect(field(card(page, M97), 'recommended')).toHaveText(
      `Recommended first: ${title(M98)}`,
    );

    await gotoModule(page, M98);
    await expect(
      prerequisites(page).locator(`li[data-prerequisite="${M99}"]`),
    ).toHaveAttribute('data-state', 'complete');
    await expect(
      prerequisites(page).locator(`li[data-prerequisite="${M99}"]`),
    ).toContainText('complete');
    await expect(page.locator('[data-field="recommended"]')).toHaveCount(0);
    // The first m98 lesson's own prerequisite (an m99 lesson) is complete too: no lesson note.
    const [first] = moduleLessons(M98);
    if (first === undefined) throw new Error('m98 has no lesson');
    expect(readLesson(first).prerequisites.every((p) => m99.includes(p))).toBe(
      true,
    );
    await page.keyboard.press('j');
    await expect.poll(() => focusedLesson(page)).toBe(first);
    await expect(field(moduleLessonItem(page, first), 'details')).toBeVisible();
    await expect(
      field(moduleLessonItem(page, first), 'lesson-recommended'),
    ).toHaveCount(0);

    await gotoModule(page, M97);
    await expect(
      prerequisites(page).locator('p[data-field="recommended"]'),
    ).toHaveText(`Recommended first: ${title(M98)}`);
  });

  test('an unknown module says "Module not found" and names the route', async ({
    page,
  }) => {
    await page.goto('/m/m00-nowhere');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Module not found',
    );
    await expect(page.locator('main p').first()).toHaveText('/m/m00-nowhere');
    await expect(page.locator('main p.font-mono')).toHaveText('/m/m00-nowhere');
  });
});

// Pre-F13 fixes (Kim, 23 October 2026): `optional: true` in a lesson's frontmatter tags the
// lesson "optional" and keeps it out of its module's completion. The fixture capstone's last
// lesson is the fixture course's one optional lesson.
test.describe('pre-F13: an optional lesson is tagged and never blocks its module', () => {
  const lessons = moduleLessons(M97);
  const optional = lessons.filter((id) => readLesson(id).optional);
  const core = lessons.filter((id) => !readLesson(id).optional);

  test('the fixture capstone has one optional lesson', () => {
    expect(optional).toEqual(['m97-fixture-capstone/03-indexed-access']);
    expect(core).toHaveLength(2);
  });

  test('with every core lesson complete and the optional one untouched, the card and the page say complete; only the optional lesson carries the tag', async ({
    page,
  }) => {
    await openApp(page);
    await seedAndReload(page, {
      lessons: core.map((id) => completeLesson(id, T0)),
    });
    await expectRoadmap(page);
    const c = card(page, M97);
    await expect(c).toHaveAttribute('data-state', 'complete');
    await expect(ring(c)).toHaveAttribute('data-state', 'complete');
    expect(Number(await ring(c).getAttribute('data-progress'))).toBe(1);
    await expect(field(c, 'progress')).toHaveText('2 of 2 lessons complete');
    await expect(field(c, 'minutes')).toHaveText('0 min left');
    await expect(field(c, 'optional')).toHaveText('1 optional lesson');
    // The other cards have no optional lesson, so no such line.
    await expect(field(card(page, M99), 'optional')).toHaveCount(0);

    await gotoModule(page, M97);
    await expect(page.locator(`section[data-module="${M97}"]`)).toHaveAttribute(
      'data-state',
      'complete',
    );
    for (const id of lessons) {
      const tag = field(moduleLessonItem(page, id), 'optional');
      if (optional.includes(id)) await expect(tag).toHaveText('optional');
      else await expect(tag).toHaveCount(0);
    }
    await expect(
      field(moduleLessonItem(page, optional[0] ?? ''), 'state'),
    ).toHaveText('not started');
  });

  test('the optional lesson complete on its own puts the module in progress, not complete', async ({
    page,
  }) => {
    await openApp(page);
    await seedAndReload(page, {
      lessons: optional.map((id) => completeLesson(id, T0)),
    });
    await expectRoadmap(page);
    const c = card(page, M97);
    await expect(c).toHaveAttribute('data-state', 'in-progress');
    await expect(field(c, 'progress')).toHaveText('0 of 2 lessons complete');
    await expect(field(c, 'minutes')).toHaveText(
      `${String(core.reduce((sum, id) => sum + readLesson(id).minutes, 0))} min left`,
    );
    await gotoModule(page, M97);
    await expect(page.locator(`section[data-module="${M97}"]`)).toHaveAttribute(
      'data-state',
      'in-progress',
    );
  });
});

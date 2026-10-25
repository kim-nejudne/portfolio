// §12 F9, the roadmap (spec §6 Roadmap: bands, cards, rings, edges, Continue, keys; §7 Store
// `meta.lastLessonId` and `lessons.lastExerciseId`), from the keyboard in Chrome:
//   1. "The roadmap renders every tier and module from `roadmap.yaml` with prerequisite edges
//      and progress rings; `j`/`k`/`h`/`l`/`Enter`/`c` work without a mouse."
//   2. "Continue opens the last touched exercise."
// Tiers, modules, titles, prerequisites, lesson minutes and exercise titles are read from
// content/ at test time (e2e/helpers/course.ts). Edges: one path per prerequisite except
// between neighbours in one band (§6 "implied and not drawn"); each starts at the bottom centre
// of the upper card and ends at the top centre of the lower one, measured against the cards'
// boxes relative to the map (the edges svg's parent), and again after the viewport narrows and
// the band wraps. Rings and card numbers are checked on a fresh store and after progress is
// seeded into IndexedDB (then a reload). Keys are pressed from the body with the focus asserted
// after each one. Continue follows the lesson page's own writes (opening, `:next`), and `c` and
// `Enter` on the focused bar open it. Keyboard only; no fixed sleeps.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ex } from './helpers/editor';
import {
  coreLessons,
  courseExercises,
  folderOf,
  lessonOf,
  minutesOf,
  moduleLessons,
  readExercise,
  readLesson,
  readModule,
  readTiers,
  routeOf,
} from './helpers/course';
import {
  expectExercise,
  expectExerciseAt,
  expectFocus,
  openExercise,
  readLessonRow,
} from './helpers/lesson';
import {
  band,
  bands,
  card,
  cards,
  completeLesson,
  continueBar,
  edgePath,
  edgePaths,
  expectFocusedCard,
  expectRoadmap,
  field,
  lessonRow,
  openApp,
  readStore,
  metaValue,
  ring,
  seedAndReload,
  tabTo,
} from './helpers/progress';

const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const STATE_TEXT = {
  'not-started': 'not started',
  'in-progress': 'in progress',
  complete: 'complete',
} as const;
type State = keyof typeof STATE_TEXT;

const TIERS = readTiers();
const MODULES = TIERS.flatMap((tier) => tier.modules);
const [M99, M98, M97] = MODULES as [string, string, string];

/** The prerequisite edges §6 draws: every one but those between neighbours in one band. */
function drawnEdges(): { from: string; to: string }[] {
  const place = new Map<string, { tier: number; index: number }>();
  TIERS.forEach((tier, t) =>
    tier.modules.forEach((id, index) => place.set(id, { tier: t, index })),
  );
  return MODULES.flatMap((to) =>
    readModule(to).prerequisites.flatMap((from) => {
      const a = place.get(from);
      const b = place.get(to);
      if (a === undefined || b === undefined) return [];
      const neighbours = a.tier === b.tier && Math.abs(a.index - b.index) === 1;
      return neighbours ? [] : [{ from, to }];
    }),
  );
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The path's `d` and both cards' boxes, all relative to the map (the edges svg's parent). */
async function edgeGeometry(
  page: Page,
  from: string,
  to: string,
): Promise<{ d: string; svg: Box; map: Box; from: Box; to: Box }> {
  return page.evaluate(
    ({ from, to }) => {
      const path = document.querySelector(
        `svg[data-edges] path[data-from="${from}"][data-to="${to}"]`,
      );
      const svg = path?.closest('svg');
      const map = svg?.parentElement;
      const fromCard = document.querySelector(`a[data-module="${from}"]`);
      const toCard = document.querySelector(`a[data-module="${to}"]`);
      if (!path || !svg || !map || !fromCard || !toCard) {
        throw new Error(`no edge or card for ${from} → ${to}`);
      }
      const origin = map.getBoundingClientRect();
      const box = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left - origin.left,
          y: rect.top - origin.top,
          width: rect.width,
          height: rect.height,
        };
      };
      return {
        d: path.getAttribute('d') ?? '',
        svg: box(svg),
        map: { x: 0, y: 0, width: origin.width, height: origin.height },
        from: box(fromCard),
        to: box(toCard),
      };
    },
    { from, to },
  );
}

/** `M x y C x y x y x y` → its start and end points. */
function endpoints(d: string): {
  start: [number, number];
  end: [number, number];
} {
  expect(d, 'a cubic curve: M x y C x1 y1 x2 y2 x y').toMatch(
    /^M\s*-?[\d.]+[\s,]+-?[\d.]+\s*C(\s*-?[\d.]+[\s,]*){6}$/,
  );
  const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  expect(n).toHaveLength(8);
  return {
    start: [n[0] as number, n[1] as number],
    end: [n[6] as number, n[7] as number],
  };
}

const NEAR = 2;

/** Every drawn edge runs from the bottom centre of its upper card to the top centre of the lower. */
async function expectEdgesOnCards(page: Page): Promise<void> {
  const edges = drawnEdges();
  await expect(edgePaths(page)).toHaveCount(edges.length);
  await expect(async () => {
    for (const { from, to } of edges) {
      const g = await edgeGeometry(page, from, to);
      // The svg covers the map exactly (inset 0), so its user units are the map's pixels.
      expect(Math.abs(g.svg.x) + Math.abs(g.svg.y)).toBeLessThan(1);
      expect(Math.abs(g.svg.width - g.map.width)).toBeLessThan(1);
      expect(Math.abs(g.svg.height - g.map.height)).toBeLessThan(1);
      expect(
        g.from.y + g.from.height,
        `${from} lies above ${to}: a cross-band edge`,
      ).toBeLessThanOrEqual(g.to.y);
      const { start, end } = endpoints(g.d);
      const where = `${from} → ${to} (${g.d})`;
      expect(
        Math.abs(start[0] - (g.from.x + g.from.width / 2)),
        `${where}: start x`,
      ).toBeLessThan(NEAR);
      expect(
        Math.abs(start[1] - (g.from.y + g.from.height)),
        `${where}: start y`,
      ).toBeLessThan(NEAR);
      expect(
        Math.abs(end[0] - (g.to.x + g.to.width / 2)),
        `${where}: end x`,
      ).toBeLessThan(NEAR);
      expect(Math.abs(end[1] - g.to.y), `${where}: end y`).toBeLessThan(NEAR);
    }
  }).toPass();
}

/** What the ring draws: the accent arc (its length out of 100) and whether it is a filled disc. */
async function ringDrawing(
  scope: Locator,
): Promise<{ arcs: number; arcLength: number | null; filled: boolean }> {
  return ring(scope).evaluate((svg) => {
    const arcs = [...svg.querySelectorAll('circle[pathLength]')];
    const dash = arcs[0]?.getAttribute('stroke-dasharray') ?? null;
    return {
      arcs: arcs.length,
      arcLength: dash === null ? null : Number(dash.split(/[\s,]+/)[0]),
      filled: [...svg.querySelectorAll('circle')].some(
        (circle) => getComputedStyle(circle).fill !== 'none',
      ),
    };
  });
}

/**
 * The card of `moduleId` with the lessons in `complete` complete: state, ring, "N of M lessons
 * complete", minutes left (the frontmatter `minutes` of the lessons not complete) and
 * "Recommended first: …" for each prerequisite module not complete.
 */
async function expectCard(
  page: Page,
  moduleId: string,
  state: State,
  complete: readonly string[] = [],
): Promise<void> {
  const lessons = coreLessons(moduleId);
  const done = lessons.filter((id) => complete.includes(id));
  const fraction = done.length / lessons.length;
  const c = card(page, moduleId);
  await expect(c).toHaveAttribute('href', `/m/${moduleId}`);
  await expect(c).toContainText(readModule(moduleId).title);
  await expect(c).toHaveAttribute('data-state', state);
  await expect(ring(c)).toHaveAttribute('data-state', state);
  expect(Number(await ring(c).getAttribute('data-progress'))).toBeCloseTo(
    fraction,
    5,
  );
  await expect(field(c, 'progress')).toHaveText(
    `${String(done.length)} of ${String(lessons.length)} lessons complete`,
  );
  await expect(field(c, 'minutes')).toHaveText(
    `${String(minutesOf(lessons.filter((id) => !complete.includes(id))))} min left`,
  );
  await expect(field(c, 'state')).toHaveText(STATE_TEXT[state]);
  const pending = readModule(moduleId).prerequisites.filter(
    (p) => !coreLessons(p).every((id) => complete.includes(id)),
  );
  if (pending.length === 0) {
    await expect(field(c, 'recommended')).toHaveCount(0);
  } else {
    await expect(field(c, 'recommended')).toHaveText(
      `Recommended first: ${pending.map((p) => readModule(p).title).join(', ')}`,
    );
  }
  const drawing = await ringDrawing(c);
  if (state === 'in-progress') {
    expect(drawing.arcs, `${moduleId}: the accent arc`).toBe(1);
    expect(drawing.arcLength).toBe(Math.max(Math.round(fraction * 100), 4));
    expect(drawing.filled).toBe(false);
  } else {
    expect(drawing.arcs, `${moduleId}: no accent arc`).toBe(0);
    expect(drawing.filled, `${moduleId}: filled only when complete`).toBe(
      state === 'complete',
    );
  }
}

test.describe('§12 F9: The roadmap renders every tier and module from `roadmap.yaml` with prerequisite edges and progress rings; `j`/`k`/`h`/`l`/`Enter`/`c` work without a mouse.', () => {
  test('one band per tier in roadmap.yaml order with its title, and its modules as cards in order with their module.yaml titles', async ({
    page,
  }) => {
    expect(TIERS.length).toBeGreaterThanOrEqual(2);
    await openApp(page);
    await expect(bands(page)).toHaveCount(TIERS.length);
    for (const [i, tier] of TIERS.entries()) {
      const section = bands(page).nth(i);
      await expect(section).toHaveAttribute('data-tier', tier.id);
      await expect(section).toHaveAttribute('aria-label', tier.title);
      await expect(section.getByRole('heading', { level: 2 })).toHaveText(
        tier.title,
      );
      const inBand = band(page, tier.id).locator('a[data-module]');
      await expect(inBand).toHaveCount(tier.modules.length);
      for (const [j, id] of tier.modules.entries()) {
        await expect(inBand.nth(j)).toHaveAttribute('data-module', id);
        await expect(inBand.nth(j)).toContainText(readModule(id).title);
        await expect(ring(inBand.nth(j))).toHaveCount(1);
      }
    }
    await expect(cards(page)).toHaveCount(MODULES.length);
    // Nothing is focused on load.
    await expect(page.locator('body')).toBeFocused();
  });

  test('exactly the drawn edges: none between neighbours in a band, each from the bottom centre of the upper card to the top centre of the lower; they follow the cards when the band wraps', async ({
    page,
  }) => {
    // The fixture graph this test is about: m98 needs m99, its neighbour; m97 needs both.
    expect(readModule(M98).prerequisites).toContain(M99);
    expect(readModule(M97).prerequisites).toEqual(
      expect.arrayContaining([M99, M98]),
    );
    const edges = drawnEdges();
    expect(edges).toEqual(
      expect.arrayContaining([
        { from: M99, to: M97 },
        { from: M98, to: M97 },
      ]),
    );
    await openApp(page);
    await expect.poll(() => edgePaths(page).count()).toBe(edges.length);
    for (const { from, to } of edges) {
      await expect(edgePath(page, from, to)).toHaveCount(1);
    }
    await expect(
      edgePath(page, M99, M98),
      'the neighbour edge is implied',
    ).toHaveCount(0);
    await expectEdgesOnCards(page);

    // Narrower than two cards: m98 wraps under m99, and the edges are measured again.
    const before = await edgeGeometry(page, M98, M97);
    await page.setViewportSize({ width: 560, height: 900 });
    await expect
      .poll(
        async () => {
          const g = await edgeGeometry(page, M98, M97);
          return g.from.y > before.from.y + before.from.height / 2;
        },
        { message: 'm98 wrapped under m99' },
      )
      .toBe(true);
    await expect(edgePath(page, M99, M98)).toHaveCount(0);
    await expectEdgesOnCards(page);
    const after = await edgeGeometry(page, M98, M97);
    expect(after.d, 'the path was redrawn').not.toBe(before.d);
  });

  test('rings and numbers on a fresh store: every card not started, progress 0, all minutes left, prerequisites recommended', async ({
    page,
  }) => {
    await openApp(page);
    for (const id of MODULES) await expectCard(page, id, 'not-started');
    await expect(field(card(page, M99), 'recommended')).toHaveCount(0);
  });

  test('rings and numbers follow the store: one m99 lesson complete and an m98 lesson in progress, then all of m99 complete', async ({
    page,
  }) => {
    const m99 = moduleLessons(M99);
    const m98 = moduleLessons(M98);
    await openApp(page);
    await seedAndReload(page, {
      lessons: [
        completeLesson(m99[0] as string, T0),
        lessonRow(m98[0] as string, { lastOpenedAt: T0 }),
      ],
    });
    await expectRoadmap(page);
    await expectCard(page, M99, 'in-progress', [m99[0] as string]);
    expect(
      Number(await ring(card(page, M99)).getAttribute('data-progress')),
    ).toBeCloseTo(1 / 3, 5);
    await expect(field(card(page, M99), 'progress')).toHaveText(
      '1 of 3 lessons complete',
    );
    await expectCard(page, M98, 'in-progress', [m99[0] as string]);
    await expectCard(page, M97, 'not-started', [m99[0] as string]);

    // The whole of m99: complete, filled, and no longer recommended first anywhere.
    await seedAndReload(page, {
      lessons: m99.map((id) => completeLesson(id, T0)),
    });
    await expectRoadmap(page);
    await expectCard(page, M99, 'complete', m99);
    await expect(field(card(page, M99), 'progress')).toHaveText(
      '3 of 3 lessons complete',
    );
    await expect(field(card(page, M99), 'minutes')).toHaveText('0 min left');
    await expectCard(page, M98, 'in-progress', m99);
    await expect(field(card(page, M98), 'recommended')).toHaveCount(0);
    await expectCard(page, M97, 'not-started', m99);
    await expect(field(card(page, M97), 'recommended')).toHaveText(
      `Recommended first: ${readModule(M98).title}`,
    );
    // The cards changed height: the edges still meet them.
    await expectEdgesOnCards(page);
  });

  test('j/k move between the cards in reading order and stop at the ends; h/l stay within a band and stop at its ends', async ({
    page,
  }) => {
    await openApp(page);
    await expect(page.locator('body')).toBeFocused();
    const press = async (key: string, to: string): Promise<void> => {
      await page.keyboard.press(key);
      await expectFocusedCard(page, to, `${key} → ${to}`);
      await expect(page).toHaveURL('/');
    };
    // Reading order: bands top to bottom, each left to right.
    await press('j', M99);
    await press('j', M98);
    await press('j', M97);
    await press('j', M97);
    await press('k', M98);
    await press('k', M99);
    await press('k', M99);
    // Within the first band.
    await press('l', M98);
    await press('l', M98);
    await press('h', M99);
    await press('h', M99);
    // m97 is alone in its band.
    await press('j', M98);
    await press('j', M97);
    await press('h', M97);
    await press('l', M97);
    await press('k', M98);
  });

  test('with no card focused, each of j, k, h and l focuses the first card', async ({
    page,
  }) => {
    for (const key of ['j', 'k', 'h', 'l']) {
      await openApp(page);
      await expect(page.locator('body')).toBeFocused();
      await page.keyboard.press(key);
      await expectFocusedCard(page, M99, `${key} from the body`);
    }
  });

  test('the focused card shows it: its border is the accent and its title bar inverts, while the others keep the pane colours', async ({
    page,
  }) => {
    // The chrome classes live in Tailwind's components layer; unlayered, they would beat the
    // card's focus-visible utilities and `j` would move an invisible focus.
    const token = (name: string): Promise<string> =>
      page.evaluate(
        (t) =>
          getComputedStyle(document.documentElement).getPropertyValue(t).trim(),
        name,
      );
    const rgb = (hex: string): string => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
    };
    await openApp(page);
    const card = (id: string): Locator =>
      page.locator(`a[data-module="${id}"]`);
    const title = (id: string): Locator => card(id).locator('> .term-title');
    await expect(title(M99)).toHaveCSS(
      'background-color',
      rgb(await token('--bg-alt')),
    );
    await page.keyboard.press('j');
    await expectFocusedCard(page, M99, 'j from the body');
    await expect(card(M99)).toHaveCSS(
      'border-top-color',
      rgb(await token('--accent')),
    );
    await expect(title(M99)).toHaveCSS(
      'background-color',
      rgb(await token('--fg')),
    );
    await expect(title(M99)).toHaveCSS('color', rgb(await token('--bg')));
    await expect(card(M98)).toHaveCSS(
      'border-top-color',
      rgb(await token('--border')),
    );
    await expect(title(M98)).toHaveCSS(
      'background-color',
      rgb(await token('--bg-alt')),
    );
  });

  test('Enter on a focused card opens its module page', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expectFocusedCard(page, M97);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/m/${M97}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      readModule(M97).title,
    );
    await page.goBack();
    await expectRoadmap(page);
    await page.keyboard.press('j');
    await expectFocusedCard(page, M99);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/m/${M99}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      readModule(M99).title,
    );
  });

  test('c opens the Continue bar’s exercise, from the body and from a focused card', async ({
    page,
  }) => {
    const [first] = courseExercises();
    if (first === undefined) throw new Error('the course has no exercise');
    await openApp(page);
    await expect(continueBar(page)).toHaveAttribute('href', routeOf(first));
    await page.keyboard.press('c');
    await expect(page).toHaveURL(routeOf(first));
    await expectExerciseAt(page, lessonOf(first), folderOf(first));

    await page.goBack();
    await expectRoadmap(page);
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expectFocusedCard(page, M98);
    await page.keyboard.press('c');
    await expect(page).toHaveURL(routeOf(first));
  });

  test('keys typed in the palette input stay there: no card moves and c does not continue', async ({
    page,
  }) => {
    await openApp(page);
    await page.keyboard.press('j');
    await expectFocusedCard(page, M99);
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    const input = palette.locator('[cmdk-input]');
    await page.keyboard.press('Control+p');
    await expect(palette).toBeVisible();
    await expect(input).toBeFocused();
    await page.keyboard.type('jjlkhc');
    await expect(input).toHaveValue('jjlkhc');
    await expect(input).toBeFocused();
    await expect(page).toHaveURL('/');
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    // The palette hands the focus back to the card it came from, which never moved.
    await expectFocusedCard(page, M99);
    await expect(page).toHaveURL('/');
    // And the keys work again once the palette is closed.
    await page.keyboard.press('j');
    await expectFocusedCard(page, M98);
  });
});

test.describe('§12 F9: Continue opens the last touched exercise.', () => {
  test('with nothing opened yet the bar says Start and names the course’s first exercise; Tab from the body reaches it first in the page and Enter opens it', async ({
    page,
  }) => {
    const [first] = courseExercises();
    if (first === undefined) throw new Error('the course has no exercise');
    await openApp(page);
    const bar = continueBar(page);
    await expect(bar).toHaveAttribute('data-continue', 'start');
    await expect(bar.locator('span').first()).toHaveText('Start');
    await expect(field(bar, 'exercise')).toHaveText(readExercise(first).title);
    await expect(field(bar, 'lesson')).toHaveText(
      readLesson(lessonOf(first)).title,
    );
    await expect(bar).toHaveAttribute('href', routeOf(first));
    expect(
      await readStore(page).then((s) => metaValue(s, 'lastLessonId')),
    ).toBeUndefined();

    await expect(page.locator('body')).toBeFocused();
    const presses = await tabTo(page, bar, 10);
    // Everything Tab stopped on before the bar is in the header: the bar comes first in the page.
    expect(presses).toBeGreaterThanOrEqual(1);
    await page.keyboard.press('Shift+Tab');
    expect(
      await page.evaluate(
        () => document.activeElement?.closest('header') !== null,
      ),
      'the stop before the bar is in the header',
    ).toBe(true);
    await page.keyboard.press('Tab');
    await expect(bar).toBeFocused();
    await page.keyboard.press('Enter');
    await expectExerciseAt(page, lessonOf(first), folderOf(first));
  });

  test('the bar names the exercise last touched (after `:next` too); `c` and Enter on the focused bar open it; it survives a reload; it follows a later exercise in another module and back', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const implement = 'm99-fixtures/02-implement';
    const touched = `${implement}/02-literal-discriminant`;
    // Opened, then moved on with `:next`: the exercise last touched is the second one.
    await openExercise(page, '02-implement', '01-largest-shape');
    await ex(page, 'next');
    await expectExercise(page, '02-implement', '02-literal-discriminant');
    await expect
      .poll(
        async () => (await readLessonRow(page, '02-implement'))?.lastExerciseId,
      )
      .toBe(touched);
    // `g r` from outside the editor (the theory pane, reached with the vimrc's Ctrl-h).
    await page.keyboard.press('Control+h');
    await expectFocus(page, 'theory');
    await page.keyboard.press('g');
    await page.keyboard.press('r');
    await expectRoadmap(page);

    const bar = continueBar(page);
    const expectBar = async (exerciseId: string): Promise<void> => {
      await expect(bar).toHaveAttribute('data-continue', 'continue');
      await expect(bar.locator('span').first()).toHaveText('Continue');
      await expect(field(bar, 'exercise')).toHaveText(
        readExercise(exerciseId).title,
      );
      await expect(field(bar, 'lesson')).toHaveText(
        readLesson(lessonOf(exerciseId)).title,
      );
      await expect(bar).toHaveAttribute('href', routeOf(exerciseId));
    };
    await expectBar(touched);

    // `c` opens it.
    await page.keyboard.press('c');
    await expectExercise(page, '02-implement', '02-literal-discriminant');

    // Back on the roadmap, and over a reload, it still names it; Enter on the focused bar opens it.
    await page.goBack();
    await expectRoadmap(page);
    await expectBar(touched);
    await page.reload();
    await expectRoadmap(page);
    await expectBar(touched);
    await expect(page.locator('body')).toBeFocused();
    await tabTo(page, bar, 10);
    await page.keyboard.press('Enter');
    await expectExercise(page, '02-implement', '02-literal-discriminant');

    // A later exercise in another module (a predict one): the bar follows it.
    const tuples = 'm98-fixture-sequel/02-tuples';
    const later = `${tuples}/02-optional-element`;
    expect(readExercise(later).kind).toBe('predict');
    await page.goto(routeOf(later));
    await expectExerciseAt(page, tuples, '02-optional-element');
    await expect
      .poll(async () => {
        const store = await readStore(page);
        return [
          metaValue(store, 'lastLessonId'),
          store.lessons.find((row) => row.id === tuples)?.lastExerciseId,
        ];
      })
      .toEqual([tuples, later]);
    await page.keyboard.press('2');
    await expectFocus(page, 'question');
    await page.keyboard.press('g');
    await page.keyboard.press('r');
    await expectRoadmap(page);
    await expectBar(later);
    await page.keyboard.press('c');
    await expectExerciseAt(page, tuples, '02-optional-element');

    // Last touched, not furthest: going back to an earlier exercise moves the bar back.
    await openExercise(page, '01-fix', '01-handle-the-new-shape');
    await expect
      .poll(async () => metaValue(await readStore(page), 'lastLessonId'))
      .toBe('m99-fixtures/01-fix');
    await page.goto('/');
    await expectRoadmap(page);
    await expectBar('m99-fixtures/01-fix/01-handle-the-new-shape');
  });
});

// §12 F1: "Every route in §6 renders a placeholder, in light and dark, and `?` opens the help
// overlay." Every §6 route is loaded directly with page.goto (which also proves the SPA
// fallback of `vite preview`), once under a light and once under a dark colour scheme; the
// body background is compared between the two schemes; `?` is pressed with nothing focused
// and the overlay is checked against the §6 global keys table and the Vim gaps list, then
// closed with Escape. Keyboard only; no fixed waits.
import { expect, test, type Page } from '@playwright/test';

interface Route {
  path: string;
  h1: string;
  /** The first paragraph under main, where the placeholder shows the route parameters. */
  detail?: string;
}

const ROUTES: readonly Route[] = [
  { path: '/', h1: 'Roadmap' },
  { path: '/m/m03-unions', h1: 'Module m03-unions' },
  // The lesson page renders the registry since F6 (the fixture lesson; the placeholder stays
  // for an unknown id). The exercise in the URL is F8's.
  {
    path: '/l/m99-fixtures/01-fix',
    h1: 'Fixing an exhaustiveness error',
    detail: '7 min · m99-fixtures',
  },
  {
    path: '/l/m99-fixtures/01-fix/01-handle-the-new-shape',
    h1: 'Fixing an exhaustiveness error',
    detail: '7 min · m99-fixtures',
  },
  {
    path: '/l/m03-unions/05-discriminated-unions',
    h1: 'Lesson not found',
    detail: '/l/m03-unions/05-discriminated-unions',
  },
  { path: '/repl', h1: 'REPL' },
  { path: '/settings', h1: 'Settings' },
  { path: '/progress', h1: 'Progress' },
  // Outside §6: the SPA fallback serves index.html and the app answers, not the server.
  { path: '/nope', h1: 'Not found', detail: '/nope' },
];

const SCHEMES = ['light', 'dark'] as const;

/** What the §6 theme code sets on <html> (Tailwind's `.dark` variant, `color-scheme`) and what the body paints. */
function readTheme(page: Page) {
  return page.evaluate(() => ({
    dark: document.documentElement.classList.contains('dark'),
    colorScheme: document.documentElement.style.colorScheme,
    background: getComputedStyle(document.body).backgroundColor,
  }));
}

for (const scheme of SCHEMES) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });

    for (const route of ROUTES) {
      test(`renders ${route.path}`, async ({ page }) => {
        await page.goto(route.path);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          route.h1,
        );
        if (route.detail !== undefined) {
          await expect(page.locator('main p').first()).toHaveText(route.detail);
        }
        await expect(
          page.locator('header').getByText(route.path, { exact: true }),
        ).toBeVisible();
        expect(
          await readTheme(page),
          `<html> theme state under the ${scheme} scheme`,
        ).toMatchObject({ dark: scheme === 'dark', colorScheme: scheme });
      });
    }

    test('? opens the keyboard help overlay and Escape closes it', async ({
      page,
    }) => {
      await page.goto('/');
      // The key listener mounts in a React effect: wait for the page before pressing.
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Roadmap',
      );
      await expect(page.locator('body')).toBeFocused();
      const dialog = page.getByRole('dialog', { name: 'Keyboard help' });
      await expect(dialog).toBeHidden();

      await page.keyboard.press('?');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('heading', { name: 'Keyboard help' }),
      ).toBeVisible();
      await expect(
        dialog.getByRole('heading', { name: 'Global keys' }),
      ).toBeVisible();
      const rows = dialog.locator(
        'section[aria-labelledby="help-global-keys"] tbody tr',
      );
      await expect(rows, 'one row per §6 global key').toHaveCount(10);
      await expect(rows.first().locator('th')).toHaveText('?');
      await expect(
        dialog.getByRole('heading', { name: "What Vim mode can't do" }),
      ).toBeVisible();
      await expect(dialog.locator('li')).toHaveCount(7);
      await expect(dialog.and(page.locator(':focus-within'))).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.locator('body')).toBeFocused();
    });
  });
}

test('light and dark paint the body with different backgrounds', async ({
  browser,
}) => {
  const backgrounds: string[] = [];
  for (const scheme of SCHEMES) {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
    backgrounds.push((await readTheme(page)).background);
    await context.close();
  }
  const [light, dark] = backgrounds;
  expect(light).toMatch(/\S/);
  expect(dark).toMatch(/\S/);
  expect(light, `light ${light ?? ''} vs dark ${dark ?? ''}`).not.toBe(dark);
});

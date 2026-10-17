// §12 F3: "Editing works before the compiler is ready, with the status chip showing." The
// ts-ls worker chunk (/assets/worker-<hash>.js) is held at the network layer so the chip
// cannot leave "compiler loading"; the editor is driven meanwhile and the edit is read back
// through the seam; then the chunk is released, the chip reaches "TypeScript 6.0.3" and the
// diagnostics for the edit made before ready arrive. Keyboard only; the route is the only
// thing held, and it is released by the test, never by a timer.
import { expect, test, type Route } from '@playwright/test';
import {
  focusEditor,
  press,
  problems,
  snapshot,
  type,
  TS_VERSION,
} from './helpers/editor';

const WORKER_CHUNK = /\/assets\/worker-[^/]+\.js$/;

test('the editor accepts edits while the chip says "compiler loading"', async ({
  page,
}) => {
  let release: (() => void) | null = null;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let heldRoutes = 0;
  await page.route(WORKER_CHUNK, async (route: Route) => {
    heldRoutes += 1;
    await held;
    await route.continue();
  });

  await page.goto('/repl');
  await focusEditor(page);
  const chip = page.getByRole('status', { name: 'compiler status' });
  await expect(chip).toHaveText('compiler loading');
  await expect(chip).toHaveAttribute('data-state', 'loading');
  await expect.poll(() => heldRoutes, 'the worker chunk is held').toBe(1);

  await press(page, 'i');
  await type(page, 'hello world');
  await press(page, '<Esc>');
  const s = await snapshot(page);
  expect(s.doc.split('\n')[0]).toBe(
    "hello worldimport { area, type Shape } from './shapes';",
  );
  expect(s.mode).toBe('normal');
  await expect(chip, 'still loading after the edit').toHaveText(
    'compiler loading',
  );
  await expect(problems(page)).toHaveCount(0);

  (release as (() => void) | null)?.();
  await expect(chip).toHaveText(`TypeScript ${TS_VERSION}`, {
    timeout: 15_000,
  });
  await expect(chip).toHaveAttribute('data-state', 'ready');
  await expect(problems(page).first()).toContainText('index.ts:1:1 ');
  await expect(
    problems(page).filter({ hasText: "Cannot find name 'hello'." }),
  ).toHaveCount(1);
  await expect(page.locator('.cm-lintRange-error').first()).toBeVisible();
});

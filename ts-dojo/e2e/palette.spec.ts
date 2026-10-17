// §6 Global keys and Command palette, as far as F3 adds them: `Ctrl-p` opens the palette when
// the editor does not have focus (the roadmap body, the /repl output pane) and `Esc` closes it
// and restores focus to where it was; `g r` goes to the roadmap from a page without the editor
// focused; and the §6 conflict rule: with the editor focused in normal mode `g r` is Vim's and
// changes nothing app-level (§12 F8 proves the full list; F3 adds the two-key sequences).
// Keyboard only; focus is asserted before and after every key.
import { expect, test } from '@playwright/test';
import {
  cursor,
  gotoRepl,
  press,
  snapshot,
  type,
  vimPanel,
} from './helpers/editor';

test('on / with the body focused, Ctrl-p opens the palette and Esc closes it and returns focus to the body', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
  await expect(page.locator('body')).toBeFocused();
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeHidden();
  await press(page, '<C-p>');
  await expect(palette).toBeVisible();
  await expect(palette.locator('[cmdk-input]')).toBeFocused();
  await type(page, 'roadmap');
  await expect(
    palette.locator('[cmdk-item][aria-selected="true"]'),
  ).toContainText(':roadmap');
  await press(page, '<Esc>');
  await expect(palette).toBeHidden();
  await expect(page.locator('body')).toBeFocused();
});

test('on /repl with the output pane focused, Ctrl-p opens the palette and Esc returns focus to the pane', async ({
  page,
}) => {
  await gotoRepl(page);
  const output = page.locator('[data-pane="output"]');
  await press(page, '<C-j>');
  await expect(output).toBeFocused();
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await press(page, '<C-p>');
  await expect(palette).toBeVisible();
  await expect(palette.locator('[cmdk-input]')).toBeFocused();
  await press(page, '<Esc>');
  await expect(palette).toBeHidden();
  await expect(output).toBeFocused();
  await expect(page).toHaveURL(/\/repl$/);
});

test('g r on /settings goes to the roadmap', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page.locator('body')).toBeFocused();
  await press(page, 'gr');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roadmap');
});

// §6 conflict rule / §12 F8: with the editor focused in normal mode, g r does nothing app-level.
test("with the editor focused in normal mode, g r is Vim's: the route stays /repl", async ({
  page,
}) => {
  await gotoRepl(page);
  await expect(vimPanel(page)).toHaveText('--NORMAL--');
  await press(page, 'gr');
  await press(page, '<Esc>');
  // A later Vim key still works, which also proves the editor kept focus and the keys went to Vim.
  await press(page, 'j');
  expect(await cursor(page)).toEqual([2, 0]);
  await expect(page).toHaveURL(/\/repl$/);
  await expect(page.locator('.cm-content')).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await snapshot(page)).mode).toBe('normal');
});

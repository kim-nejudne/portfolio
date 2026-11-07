// F55 scenario: the Screen at 1920 × 1080 and 1280 × 720 is the 1920 × 1080 stage scaled by
// min(w / 1920, h / 1080), with no horizontal scroll, and its keys work. Screenshots both sizes.
//   npm run playtest -- scripts/playtest/screenSizes.ts
import { expectText, type Harness } from './harness.js';

export default async function screenSizes(h: Harness): Promise<void> {
  const res = await fetch(`${h.baseUrl}/api/rooms`, { method: 'POST' });
  const { code } = (await res.json()) as { code: string };
  const tv = await h.openRole('tv', 'tv', `/screen/${code}`);
  const hd = await h.openRole('hd', 'tv 720p', `/screen/${code}`);

  for (const [role, want] of [
    [tv, 1],
    [hd, 2 / 3],
  ] as const) {
    await expectText(role, `code ${code}`);
    // String expressions: they run in the page, and this file is typechecked without DOM types.
    if (await role.page.evaluate<boolean>('document.documentElement.scrollWidth > innerWidth'))
      throw new Error(`${role.name}: horizontal scroll`);
    const transform = await role.page.evaluate<string>(
      "getComputedStyle(document.querySelector('.fixed.inset-0 > div')).transform",
    );
    const scale = transform === 'none' ? 1 : Number(/matrix\(([^,]+)/.exec(transform)?.[1]);
    if (Math.abs(scale - want) > 0.01)
      throw new Error(`${role.name}: stage transform ${transform}, want scale ${want}`);
    await role.screenshot('size');
  }

  await tv.page.keyboard.press('?');
  await tv.page.getByRole('region', { name: 'Keys' }).waitFor({ timeout: 3000 });
  await tv.screenshot('keys');
  await tv.page.keyboard.press('Escape');
  await tv.page.getByRole('region', { name: 'Keys' }).waitFor({ state: 'hidden', timeout: 3000 });

  for (const mode of ['Quiet', 'Muted', 'Sound']) {
    await tv.page.keyboard.press('m');
    await tv.page.getByRole('status').filter({ hasText: mode }).waitFor({ timeout: 3000 });
  }

  const errors = Object.entries(h.consoleErrors()).filter(([, list]) => list.length > 0);
  if (errors.length > 0) throw new Error(`console errors: ${JSON.stringify(errors)}`);
}

// F01 smoke scenario: the app loads on a Screen and two phones, each in its own browser context,
// with no console errors (run.ts reports them and fails the run).
import { expectText, type Harness } from './harness.js';

export default async function smoke(h: Harness): Promise<void> {
  const screen = await h.openRole('screen', 'tv', '/');
  const phones = await Promise.all([
    h.openRole('ana', 'Pixel 7', '/'),
    h.openRole('ben', 'small phone', '/'),
  ]);

  for (const role of [screen, ...phones]) {
    await expectText(role, 'Find it on the map. Closest pin wins.');
    // A string expression: it runs in the page, and this file is typechecked without DOM types.
    const overflow = await role.page.evaluate<boolean>(
      'document.documentElement.scrollWidth > window.innerWidth',
    );
    if (overflow) throw new Error(`${role.name}: horizontal scroll`);
  }

  // Each role is its own device: storage written by one phone is invisible to the others.
  const [ana, ben] = phones;
  await ana.page.evaluate(() => localStorage.setItem('pinpoint-smoke', 'ana'));
  if ((await ben.page.evaluate(() => localStorage.getItem('pinpoint-smoke'))) !== null)
    throw new Error('ben: sees ana’s localStorage; contexts are not isolated');

  const errors = Object.entries(h.consoleErrors()).filter(([, list]) => list.length > 0);
  if (errors.length > 0) throw new Error(`console errors: ${JSON.stringify(errors)}`);
}

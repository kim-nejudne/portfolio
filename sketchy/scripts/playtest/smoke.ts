// F01 smoke scenario: a Screen and 3 phones, each in its own browser context.
import { expectText, type Harness } from './harness.js';

const CODE = 'TEST';

export default async function smoke(h: Harness): Promise<void> {
  const screen = await h.openRole('screen', 'tv', `/screen/${CODE}`);
  const phones = await Promise.all([
    h.openRole('ana', 'Pixel 7', `/play/${CODE}`),
    h.openRole('ben', 'iPhone 13', `/play/${CODE}`),
    h.openRole('cara', 'small phone', `/play/${CODE}`),
  ]);

  await expectText(screen, `Screen ${CODE}`);
  for (const phone of phones) await expectText(phone, `Play ${CODE}`);

  // Each role is its own device: storage written by one phone is invisible to the others.
  const [ana, ben] = phones;
  await ana.page.evaluate(() => localStorage.setItem('sketchy-smoke', 'ana'));
  const seenByBen = await ben.page.evaluate(() => localStorage.getItem('sketchy-smoke'));
  if (seenByBen !== null)
    throw new Error('ben: sees ana’s localStorage; contexts are not isolated');

  const viewports = [screen, ...phones].map(
    (r) => `${r.name} ${JSON.stringify(r.page.viewportSize())}`,
  );
  console.log(`opened ${viewports.join(', ')}`);
}

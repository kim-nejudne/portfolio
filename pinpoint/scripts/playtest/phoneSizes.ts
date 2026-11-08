// F57 scenario: a round on the smallest (360 × 640) and largest (430 × 932) phones the spec
// targets. At every stage neither scrolls sideways and every tap target is at least 48 × 48 px.
// Enter on the map locks in with a 30 ms buzz, the 5 s warning buzzes [60, 40, 60], the live
// region speaks, and the prompt bar's text fits 20 → 14 px.
//   npm run playtest -- scripts/playtest/phoneSizes.ts
import { type Harness, type Role } from './harness.js';

// String expressions: they run in the page, and this file is typechecked without DOM types.
const SMALL_TARGETS = `[...document.querySelectorAll(
  'button, a[href], input:not(.sr-only), select, textarea, [role=button], label:has(> input[type=radio])'
)].flatMap((e) => {
  const r = e.getBoundingClientRect();
  if (r.width === 0 || r.height === 0 || r.width >= 47.5 && r.height >= 47.5) return [];
  return [(e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30)
    + ' ' + Math.round(r.width) + '×' + Math.round(r.height)];
})`;
const STUB_VIBRATE = `navigator.vibrate = (p) => { (window.buzzes ??= []).push(p); return true; }`;

async function fits(role: Role, stage: string): Promise<void> {
  if (await role.page.evaluate<boolean>('document.documentElement.scrollWidth > innerWidth'))
    throw new Error(`${role.name} at ${stage}: horizontal scroll`);
  const small = await role.page.evaluate<string[]>(SMALL_TARGETS);
  if (small.length > 0) throw new Error(`${role.name} at ${stage}: small targets ${small}`);
}

const announced = (role: Role) =>
  role.page.evaluate<string>(
    "document.querySelector('[aria-live=polite][aria-atomic]').textContent",
  );

async function waitFor(role: Role, what: string, test: () => Promise<boolean>, ms = 30_000) {
  for (const end = Date.now() + ms; Date.now() < end; await role.page.waitForTimeout(200))
    if (await test()) return;
  throw new Error(`${role.name}: timed out waiting for ${what}`);
}

export default async function phoneSizes(h: Harness): Promise<void> {
  const res = await fetch(`${h.baseUrl}/api/rooms`, { method: 'POST' });
  const { code } = (await res.json()) as { code: string };
  await h.openRole('screen', 'tv', `/screen/${code}`);
  const mika = await h.openRole('mika', 'small phone', `/play/${code}`);
  const ben = await h.openRole('ben', 'large phone', `/play/${code}`);
  const phones = [mika, ben];

  for (const [phone, name] of [
    [mika, 'Mika'],
    [ben, 'Ben'],
  ] as const) {
    await phone.page.getByLabel('Your name').waitFor();
    await fits(phone, 'join form');
    await phone.page.getByLabel('Your name').fill(name);
    // Both forms opened together, so both would offer 🦊.
    if (phone === ben) await phone.page.getByRole('radio', { name: '🐼' }).check({ force: true });
    await phone.page.getByRole('button', { name: 'Join' }).click();
  }
  await mika.page.getByRole('region', { name: 'Game settings' }).waitFor({ timeout: 5000 });
  await ben.page.getByText(/Waiting for/).waitFor({ timeout: 5000 });
  for (const phone of phones) await fits(phone, 'lobby');

  // The prompt bar's sizing rule in this browser: 20 px when it fits, 14 px at the floor.
  // Real names of 5, 25 and 60 characters in a 300 px bar: [font px, fits on one line].
  const sizes = await ben.page.evaluate<[number, boolean][]>(`[5, 25, 60].map((n) => {
    const box = document.createElement('div');
    box.className = 'prompt-fit-box';
    box.style.width = '300px';
    const h1 = document.createElement('h1');
    h1.className = 'prompt-fit board-face';
    h1.style.setProperty('--chars', n);
    h1.style.whiteSpace = 'nowrap';
    h1.textContent = 'Saint-Rémy-de-Provence Wy'.padEnd(n, 'm').slice(0, n);
    box.append(h1);
    document.body.append(box);
    const result = [parseFloat(getComputedStyle(h1).fontSize), h1.scrollWidth <= h1.clientWidth];
    box.remove();
    return result;
  })`);
  const [short, mid, long] = sizes;
  if (short![0] !== 20 || !short![1] || Math.abs(mid![0] - 300 / (25 * 0.62)) > 0.1 || !mid![1])
    throw new Error(`prompt sizes for 5 and 25 characters in 300 px: ${JSON.stringify(sizes)}`);
  if (long![0] !== 14 || long![1]) throw new Error(`60 characters: ${JSON.stringify(long)}`);

  // Short and easy, so a small local category can start it.
  for (const [group, option] of [
    ['Difficulty', 'Easy'],
    ['Rounds', '5'],
    ['Timer', '20 s'],
  ])
    await mika.page
      .getByRole('group', { name: group })
      .getByRole('button', { name: option, exact: true })
      .click();
  await mika.page.getByRole('button', { name: 'Start ▶' }).click();
  for (const phone of phones) {
    await phone.page.getByRole('timer').first().waitFor({ timeout: 15_000 });
    await phone.page.evaluate(STUB_VIBRATE);
    await fits(phone, 'guessing');
    const text = await announced(phone);
    if (!/^Round 1 of \d+\. Find .+\.$/.test(text)) throw new Error(`${phone.name} said "${text}"`);
    const px = await phone.page.evaluate<number | null>(
      "(e => e && parseFloat(getComputedStyle(e).fontSize))(document.querySelector('.prompt-fit'))",
    );
    if (px !== null && (px < 14 || px > 20)) throw new Error(`${phone.name}: prompt at ${px} px`);
    await phone.screenshot('guessing');
  }

  // Mika locks in with Enter on the focused map.
  await mika.page.getByRole('application', { name: 'Map. Pan to aim the crosshair.' }).focus();
  await mika.page.keyboard.press('Enter');
  await mika.page.getByRole('heading', { name: 'Boarding · Locked in' }).waitFor({ timeout: 5000 });
  if ((await announced(mika)) !== 'Locked in.')
    throw new Error(`Mika said "${await announced(mika)}"`);
  const mikaBuzz = await mika.page.evaluate<unknown>('window.buzzes');
  if (JSON.stringify(mikaBuzz) !== '[30]')
    throw new Error(`Mika buzzed ${JSON.stringify(mikaBuzz)}`);
  await fits(mika, 'locked in');

  // Ben waits for the 5 s warning, then taps Lock in.
  await waitFor(
    ben,
    'the 5 s buzz',
    async () =>
      (await ben.page.evaluate<string>('JSON.stringify(window.buzzes ?? [])')) === '[[60,40,60]]',
  );
  await ben.page.getByRole('button', { name: 'Lock in' }).click();
  for (const phone of phones) {
    await phone.page.getByRole('region', { name: 'Your result' }).waitFor({ timeout: 30_000 });
    await waitFor(phone, 'the result line', async () =>
      /^[\d,.]+ kilometres, [\d,]+ points\./.test(await announced(phone)),
    );
    await phone.page.waitForTimeout(600); // the flip
    await fits(phone, 'result');
    await phone.screenshot('result');
  }

  const errors = Object.entries(h.consoleErrors()).filter(([, list]) => list.length > 0);
  if (errors.length > 0) throw new Error(`console errors: ${JSON.stringify(errors)}`);
}

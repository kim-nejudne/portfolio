// The end-to-end smoke (F58): the built server with the dev fixture, a Screen and two phones play a
// 5-round Name game to the finale. Every page records its traffic, and no round's target
// coordinates may reach a page before that page has seen the round's REVEAL.
import { devices, expect, test, type Browser, type Page } from 'playwright/test';
import type { LatLng, Phase, ScreenView } from '../shared/types.js';

const ROUNDS = 5;

/** One page's traffic in arrival order: request URLs and bodies, API and socket payloads. */
interface Traffic {
  entries: { text: string }[];
  pending: Promise<unknown>[];
  pageErrors: string[];
}

function record(page: Page): Traffic {
  const t: Traffic = { entries: [], pending: [], pageErrors: [] };
  page.on('pageerror', (err) => t.pageErrors.push(err.message));
  page.on('request', (req) => t.entries.push({ text: `${req.url()}\n${req.postData() ?? ''}` }));
  page.on('response', (res) => {
    // Built assets, fonts, sounds and tiles are static files made before any room existed.
    const path = new URL(res.url()).pathname;
    if (!path.startsWith('/api/') && !path.startsWith('/socket.io/')) return;
    const entry = { text: '' }; // its slot is taken now, so the body keeps its arrival order
    t.entries.push(entry);
    t.pending.push(
      res.text().then(
        (body) => (entry.text = body),
        () => {},
      ),
    );
  });
  page.on('websocket', (ws) => {
    ws.on('framereceived', (f) => t.entries.push({ text: String(f.payload) }));
    ws.on('framesent', (f) => t.entries.push({ text: String(f.payload) }));
  });
  return t;
}

type AnyView = Pick<ScreenView, 'phase'> & {
  round: { number: number } | null;
  reveal?: ScreenView['reveal'];
};

/** The `state` views in a socket frame or a polling body (packets split by U+001E). */
function views(text: string): AnyView[] {
  return text.split('\x1e').flatMap((packet) => {
    const m = /^42\d*(\[.*)$/s.exec(packet);
    if (!m) return [];
    try {
      const [event, data] = JSON.parse(m[1]!) as [string, AnyView];
      return event === 'state' ? [data] : [];
    } catch {
      return [];
    }
  });
}

/** The coordinate as a JSON number, not as part of a longer one. */
const numberPattern = (n: number) =>
  new RegExp(`(?<![\\d.])${String(n).replace(/[.-]/g, '\\$&')}(?![\\d])`);

const REVEALED: Phase[] = ['REVEAL', 'SCOREBOARD', 'FINAL'];

/** Lines naming each round whose target shows up on the page before its REVEAL. */
function leaks(name: string, traffic: Traffic, targets: Map<number, LatLng>): string[] {
  const found: string[] = [];
  let revealedUpTo = 0;
  for (const entry of traffic.entries) {
    for (const v of views(entry.text))
      if (REVEALED.includes(v.phase) && v.round)
        revealedUpTo = Math.max(revealedUpTo, v.round.number);
    for (const [round, { lat, lng }] of targets) {
      if (round <= revealedUpTo) continue;
      if (numberPattern(lat).test(entry.text) || numberPattern(lng).test(entry.text))
        found.push(
          `${name}: round ${round}'s ${lat}, ${lng} before its reveal in ${entry.text.slice(0, 200)}`,
        );
    }
  }
  return found;
}

async function phone(browser: Browser, code: string, name: string, emoji?: string) {
  // defaultBrowserType picks a browser, not a context option; the rest is the phone.
  const pixel: Partial<(typeof devices)['Pixel 7']> = { ...devices['Pixel 7'] };
  delete pixel.defaultBrowserType;
  const page = await (await browser.newContext(pixel)).newPage();
  const traffic = record(page);
  await page.goto(`/play/${code}`);
  await page.getByLabel('Your name').fill(name);
  // Both forms are open at once, so both would offer the same first emoji.
  if (emoji) await page.getByRole('radio', { name: emoji }).check({ force: true });
  await page.getByRole('button', { name: 'Join' }).click();
  return { name, page, traffic };
}

test('a 5-round Name game reaches the finale with no target before its reveal', async ({
  browser,
  request,
}) => {
  const res = await request.post('/api/rooms');
  expect(res.ok()).toBe(true);
  const { code } = (await res.json()) as { code: string };

  const screen = await (
    await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  ).newPage();
  const screenTraffic = record(screen);
  await screen.addLocatorHandler(
    screen.getByRole('button', { name: /^(Tap|Click) to start/ }),
    (b) => b.click(),
  );
  await screen.goto(`/screen/${code}`);

  const ana = await phone(browser, code, 'Ana');
  await ana.page.getByRole('region', { name: 'Game settings' }).waitFor();
  const ben = await phone(browser, code, 'Ben', '🐼');
  await expect(ben.page.getByText(/Waiting for/)).toBeVisible();
  const phones = [ana, ben];

  // Ana is the VIP: World (dev), Name, Easy, 5 rounds.
  await ana.page.getByRole('button', { name: /World \(dev\)/ }).click();
  for (const [group, option] of [
    ['Mode', 'Name'],
    ['Difficulty', 'Easy'],
    ['Rounds', String(ROUNDS)],
    ['Timer', '20 s'],
  ] as const)
    await ana.page
      .getByRole('group', { name: group })
      .getByRole('button', { name: option, exact: true })
      .click();
  await ana.page.getByRole('button', { name: 'Start ▶' }).click();

  for (let round = 1; round <= ROUNDS; round++) {
    for (const p of phones) {
      await expect(p.page.getByRole('timer').first()).toBeVisible({ timeout: 60_000 });
      await expect(p.page.getByText(`Round ${round} of ${ROUNDS}. Find`)).toBeAttached();
      await p.page.getByRole('button', { name: 'Lock in' }).click();
    }
    // The reveal reaches both phones: each flips to its own result.
    for (const p of phones) {
      const result = p.page.getByRole('region', { name: 'Your result' });
      await expect(result).toBeVisible({ timeout: 60_000 });
      await expect(p.page.getByText(/^[\d,.]+ kilometres, [\d,]+ points\./)).toBeAttached({
        timeout: 30_000,
      });
    }
  }

  await expect(screen.getByRole('list', { name: 'Podium' })).toBeVisible({ timeout: 60_000 });
  for (const p of phones)
    await expect(p.page.getByText(/^Final\. \S+ of 2, [\d,]+ points\.$/)).toBeAttached({
      timeout: 30_000,
    });

  // The Screen's reveal views name each round's target.
  const all = [screenTraffic, ...phones.map((p) => p.traffic)];
  await Promise.all(all.flatMap((t) => t.pending));
  const targets = new Map<number, LatLng>();
  for (const { text } of screenTraffic.entries)
    for (const v of views(text))
      if (v.phase === 'REVEAL' && v.round && v.reveal)
        targets.set(v.round.number, v.reveal.place.position);
  expect([...targets.keys()].sort()).toEqual([1, 2, 3, 4, 5]);
  // The pattern finds each target in the Screen's own reveal traffic, so the check below can bite.
  for (const { lat, lng } of targets.values())
    expect(
      screenTraffic.entries.some(
        ({ text }) => numberPattern(lat).test(text) && numberPattern(lng).test(text),
      ),
    ).toBe(true);

  expect([
    ...leaks('screen', screenTraffic, targets),
    ...phones.flatMap((p) => leaks(p.name, p.traffic, targets)),
  ]).toEqual([]);
  for (const t of all) expect(t.pageErrors).toEqual([]);
});

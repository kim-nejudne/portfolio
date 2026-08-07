/**
 * @vitest-environment jsdom
 *
 * Which screen a URL lands on.
 *
 * This exists because the landing page moved the shop. `/` used to be the Till
 * behind the gate; it is now a public front door, and the Till is `/till`. That
 * is a change no type checker can see — every route in this app is a string,
 * and four separate places in the app said `'/'` meaning "the Till", including
 * the redirect a sale runs through the moment money changes hands. Getting one
 * of them wrong sends a shopkeeper to a marketing page mid-transaction, and
 * nothing would have failed.
 *
 * So the assertions here are about reachability, not rendering: can a stranger
 * read the front door without a PIN, does the shop still refuse to open
 * without one, and does the keypad let you in to the right place.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { UNLOCK_PIN } from '../lib/unlock';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="pathname">{location.pathname}</span>;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderAt(path: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={[path]}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  return container;
}

const pathname = () =>
  container?.querySelector('[data-testid="pathname"]')?.textContent ?? null;

const keypad = () => container?.querySelector('[data-testid="pin-1"]');

async function tapPin(pin: string) {
  for (const digit of pin) {
    const key = container?.querySelector<HTMLButtonElement>(`[data-testid="pin-${digit}"]`);
    if (!key) throw new Error(`no keypad button for ${digit}`);
    await act(async () => {
      key.click();
    });
  }
}

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('the front door', () => {
  it('serves the landing page at / to a locked visitor, with no redirect', async () => {
    const el = await renderAt('/');

    expect(pathname()).toBe('/');
    expect(el.textContent).toContain('The lista is the record of trust.');
    // The whole point: a stranger must not meet a keypad first.
    expect(keypad()).toBeFalsy();
  });

  it('names the demo PIN on the landing page, so the way in is not a secret', async () => {
    const el = await renderAt('/');

    // Scoped to the landing page's own line rather than the document. Searching
    // the whole tree passed while `/` was redirecting to the keypad, which
    // prints the PIN too — the assertion was true of the page it exists to
    // prove we are no longer on. Caught by sabotage, not by review.
    expect(el.querySelector('.landing-pin')?.textContent).toContain(UNLOCK_PIN);
  });

  it('offers the way in as a link to the shop, not to the keypad', async () => {
    const el = await renderAt('/');
    const cta = el.querySelector<HTMLAnchorElement>('a.landing-cta');

    // One link that is right in both states: the gate sends it to the keypad
    // while locked and straight through once unlocked.
    expect(cta?.getAttribute('href')).toBe('/till');
  });
});

describe('the gate', () => {
  it('still refuses the till without a PIN', async () => {
    await renderAt('/till');

    expect(pathname()).toBe('/unlock');
    expect(keypad()).toBeTruthy();
  });

  it('refuses the lista too — the landing page did not open the app up', async () => {
    await renderAt('/lista');
    expect(pathname()).toBe('/unlock');
  });

  it('lands on the till after the right PIN, not on the landing page', async () => {
    await renderAt('/till');
    expect(pathname()).toBe('/unlock');

    await tapPin(UNLOCK_PIN);

    expect(pathname()).toBe('/till');
  });

  it('stays on the keypad after a wrong PIN', async () => {
    await renderAt('/till');

    // Derived rather than hardcoded, and derived without comparing: every digit
    // shifted by one is always a different string, so this stays wrong even if
    // the demo PIN changes. `UNLOCK_PIN` is a literal type, so a `!==` guard
    // against a fixed alternative is a compile error rather than a safety net.
    await tapPin([...UNLOCK_PIN].map((d) => String((Number(d) + 1) % 10)).join(''));

    expect(pathname()).toBe('/unlock');
  });
});

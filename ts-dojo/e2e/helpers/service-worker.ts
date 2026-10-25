// Playwright helpers for the specs that need the service worker and its precache (F15's offline
// test does the same inline in e2e/offline.spec.ts): a Chrome on a real profile directory, so a
// second launch is a cold start with only what the first left behind, and a wait for an active
// worker that controls the page (its install, and so the whole precache, is done by then).
import { chromium, type BrowserContext, type Page } from '@playwright/test';

/** Resolves once a service worker is active and controls the page. */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active === null) throw new Error('no active worker');
    if (navigator.serviceWorker.controller === null) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, {
          once: true,
        });
      });
    }
  });
}

/** Installed Chrome on the profile in `dir`, service workers allowed, online or offline. */
export function launchProfile(
  dir: string,
  baseURL: string,
  offline: boolean,
): Promise<BrowserContext> {
  return chromium.launchPersistentContext(dir, {
    channel: 'chrome',
    headless: true,
    baseURL,
    offline,
    serviceWorkers: 'allow',
    viewport: { width: 1280, height: 800 },
  });
}

/**
 * Server time. The scaffold froze this at a DEMO_NOW constant so its fixtures
 * would always look freshly plausible; with a real database behind it, the
 * clock is just the clock.
 *
 * Still not called during render on the client: the floor board starts its own
 * ticker after mount, which is what keeps server and client first paints in
 * agreement.
 */
export function getNow(): string {
  return new Date().toISOString();
}

// subscribeToClock lives in ./live — it is a browser ticker.

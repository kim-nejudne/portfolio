/**
 * The demo clock. Fixture timestamps are written against this anchor so every
 * screen is deterministic and nothing differs between a server and a client render.
 *
 * When the NestJS API lands, `getNow()` returns `new Date().toISOString()` and
 * `subscribeToClock` keeps its signature.
 */
export const DEMO_NOW = '2026-08-03T09:12:00+08:00';

export function getNow(): string {
  return DEMO_NOW;
}

/**
 * Wall-clock ticks for the floor board. The interval lives here, not in a
 * component: the board only ever receives an ISO string.
 */
export function subscribeToClock(
  onTick: (iso: string) => void,
  intervalMs = 1000,
): () => void {
  const emit = () => {
    onTick(new Date().toISOString());
  };
  emit();
  const timer = setInterval(emit, intervalMs);
  return () => clearInterval(timer);
}

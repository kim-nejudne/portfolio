/**
 * The demo clock. Fixture timestamps are written against this anchor so every
 * screen is deterministic and nothing differs between a server and a client render.
 *
 * When the NestJS API lands, `getNow()` returns `new Date().toISOString()`.
 */
export const DEMO_NOW = '2026-08-03T09:12:00+08:00';

export function getNow(): string {
  return DEMO_NOW;
}

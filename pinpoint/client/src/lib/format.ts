import type { View } from '#shared/types.js';

/** "1,240 km"; one decimal under 10 km ("4.2 km"), as the reveal rail writes distances. */
export function formatKm(km: number): string {
  const digits = km < 9.95 ? 1 : 0; // 9.96 would print "10.0"
  return `${km.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`;
}

/** With no live, visible category: the VIP card, other phones and the Screen's settings row. */
export const NO_DESTINATIONS = 'No destinations yet. Check back soon.';

/** The settings departures row: "WORLD · NAME · MIXED · 10 ROUNDS · 30 S" (no category until one is picked). */
export function settingsLine(view: Pick<View, 'settings' | 'categoryName'>): string {
  const s = view.settings;
  return [view.categoryName, s.mode, s.difficulty, `${s.rounds} rounds`, `${s.timerSeconds} s`]
    .filter(Boolean)
    .join(' · ')
    .toUpperCase();
}

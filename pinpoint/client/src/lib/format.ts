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

/** Up to 22 cells per row of prompt flaps (spec: Look and tokens); words wrap whole, ≤ 40 chars fit 2 rows. */
export const FLAP_ROW_CELLS = 22;

export function flapRows(text: string, cells = FLAP_ROW_CELLS): string[] {
  const rows: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = rows.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= cells)
      rows[rows.length - 1] = `${last} ${word}`;
    else rows.push(word);
  }
  return rows;
}

export type GateState = 'nowBoarding' | 'boarding' | 'finalCall' | 'delayed';

const GATE_TEXT: Record<GateState, string> = {
  nowBoarding: 'Now boarding',
  boarding: 'Boarding',
  finalCall: 'Final call',
  delayed: 'Delayed',
};

/** "Round 3/10 · ×1.5 · Boarding"; a ×1 round has no multiplier segment (DESIGN.md "Gate label"). */
export function gateLabel(
  round: { number: number; total: number; multiplier: number },
  state: GateState,
): string {
  return [
    `Round ${round.number}/${round.total}`,
    round.multiplier > 1 && `×${round.multiplier}`,
    GATE_TEXT[state],
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The intro's multiplier row on a boosted round: ×2 is only ever the final round (spec: Escalation). */
export function multiplierRow(multiplier: number): string | null {
  if (multiplier === 2) return '×2 Final round';
  return multiplier > 1 ? `×${multiplier} Bonus round` : null;
}

/** Scoreboard movement: "▲2", "▼1", or nothing. */
export function formatMovement(movement: number): string {
  if (movement > 0) return `▲${movement}`;
  return movement < 0 ? `▼${-movement}` : '';
}

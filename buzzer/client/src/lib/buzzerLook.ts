import type { BuzzerKind } from './buzzerState.js';

/**
 * How the Lit buzzer draws one state (`docs/ux/09` § The buzzer). Play.tsx writes these onto the
 * button as `data-cap`, `data-bulb`, `data-tone` and `data-mark`, and `.lit-buzzer` in index.css
 * draws them: only the cap's translate and the bulb's opacity ever animate.
 */
export interface BuzzerLook {
  /** Up off its wall and pressable, or sunk onto it. */
  cap: 'up' | 'down';
  /** The bulb under the dome: dark, breathing while it takes a buzz, or lit. */
  bulb: 'off' | 'breathe' | 'on';
  /** The dome's red, drained (grayscale 0.8) or dimmed (brightness 0.8). */
  tone: 'red' | 'drained' | 'dim';
  /** A 6px orange-pass ring round the base (too early), or a 6px ink X over the cap (locked out). */
  mark: 'none' | 'warn' | 'x';
}

const look = (
  cap: BuzzerLook['cap'],
  bulb: BuzzerLook['bulb'],
  tone: BuzzerLook['tone'] = 'red',
  mark: BuzzerLook['mark'] = 'none',
): BuzzerLook => ({ cap, bulb, tone, mark });

/**
 * Every kind's look. `null`: the buzzer is not drawn, as the choice tiles, the text box or the
 * final result take its place.
 */
export const BUZZER_LOOK: Record<BuzzerKind, BuzzerLook | null> = {
  // The lobby's test buzzer: up and pressable, dark; each press flares the bulb once (Play.tsx).
  practice: look('up', 'off'),
  // A false-start press is still taken while `live`; it then turns `early`.
  idle: look('down', 'off', 'drained'),
  live: look('up', 'breathe'),
  pressed: look('down', 'on'),
  // The answer countdown sits under it as a figure (Play.tsx).
  won: look('down', 'on'),
  early: look('down', 'off', 'red', 'warn'),
  lost: look('up', 'off', 'dim'),
  out: look('down', 'off', 'drained', 'x'),
  // Under the answer card at reveal, sunk and drained like a locked buzzer.
  revealed: look('down', 'off', 'drained'),
  choice: null,
  typed: null,
  final: null,
};

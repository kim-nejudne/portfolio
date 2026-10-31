import { sketchButtonClass, type SketchVariant } from './SketchButton.js';

/**
 * The host's sheets (F63): Settings, Add your own words and the players dialog, on the token
 * Screen and the crown phone. Each is a page of dot-grid paper; sizes are in vmin with px floors,
 * so a TV, a tablet and a 360 px phone read the same sheet.
 */

/** The dot grid at the Screen's 3.3 vmin pitch, never finer than the phone's 22 px. */
export const SHEET_DOTS =
  'paper-dots [background-size:max(3.3vmin,22px)_max(3.3vmin,22px)] [background-position:max(1.65vmin,11px)_max(1.65vmin,11px)]';

/** A full-page sheet (Settings, Add your own words): it covers the lobby it was opened from. */
export const FULL_SHEET = `absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-paper ${SHEET_DOTS} text-ink`;

/** The sheet's heading: Patrick Hand (no bold), with a `pen` underline like the logo's scribble. */
export const SHEET_TITLE =
  'min-w-0 border-b-[length:max(3px,0.5vmin)] border-pen pb-[0.4vmin] leading-tight font-normal';

/**
 * A sketch button at the sheet's size (Done, Add words, Close), with a 44 px floor. Its smaller
 * shadow is `!`, so the press drops it with `!` too.
 */
export const sheetButton = (variant: SketchVariant) =>
  `${sketchButtonClass(variant)} min-h-11! shrink-0 px-[3vmin]! text-[max(3.2vmin,18px)]! shadow-[0.28vmin_0.42vmin_0_var(--color-ink)]! not-disabled:active:shadow-none! aria-disabled:opacity-70`;

/**
 * One choice among a setting's values: a hand-bordered paper button; the room's value (pressed) is
 * on the highlighter with a hard shadow, as on the Host sheet's feed toggle.
 */
export const OPTION =
  'min-h-11 min-w-11 rounded-[1.6vmin_0.5vmin_1.6vmin_0.5vmin] border-2 border-ink bg-paper px-[2vmin] py-[0.8vmin] text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen aria-pressed:bg-hl aria-pressed:shadow-[0.28vmin_0.42vmin_0_var(--color-ink)] aria-disabled:opacity-60';

/** A hand-bordered input: the same wobbly border as a sketch button, on paper. */
export const HAND_INPUT =
  'sketch-border w-full bg-paper px-[2vmin] py-[1vmin] text-ink caret-pen focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen';

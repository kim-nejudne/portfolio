import { HOVER } from './hover.js';

// Class strings for the Squeeze building blocks (design.md), shared by every surface. Full
// strings, so Tailwind can see them. Sizes are for the phone and desktop pages; the Screen adds its
// own. The display face is for heads and figures only: every class here is Manrope (font-sans).

/** A tile: paper-2, no border and no shadow, at the card radius. */
export const CARD = 'rounded-card bg-surface p-6';

/** A small label ("First to buzz", "Also buzzed", a category line): Manrope 700, sentence case. 14px: the floor (F92). */
export const LABEL = 'font-sans text-sm font-bold text-muted';

/** A pill or chip: surface fill and a 2px border. */
export const PILL = 'rounded-full border-2 border-edge bg-surface';

/** A muted text link or link-styled button, 44px tall to tap: Back to start, Cancel (FND-05). */
export const LINK =
  'inline-flex min-h-11 items-center text-muted underline underline-offset-4 hover:text-ink disabled:opacity-40';

/** The text input of the join and name forms. Muted edge: a field needs 3:1 on the paper. */
export const INPUT =
  'w-full rounded-control border-2 border-muted bg-bg px-4 py-3 font-sans focus:border-ink';

const PRESS = 'transition not-disabled:active:scale-95 disabled:opacity-40';

/** Squeeze's press: down 1px and the deeper peach (design.md Controls). */
const PRIMARY_PRESS =
  'transition not-disabled:hover:bg-accent-hover not-disabled:active:translate-y-px not-disabled:active:bg-accent-2 disabled:bg-bg-deep disabled:text-muted';

/**
 * Peach fill, accent-ink Manrope 700: Join, Host a game, Start game, Next question. Disabled, it
 * sinks to paper-3 with a muted label rather than fading, because faded peach reads as brown (LND-08).
 */
export const BUTTON_PRIMARY = `min-h-11 rounded-control bg-accent px-6 py-4 font-sans font-bold text-accent-ink ${PRIMARY_PRESS}`;

/** Landing's two actions, Join and Host a game: one column class and one button class, so neither outweighs the other (F134). */
export const LANDING_ACTION = 'flex flex-col gap-3';
export const LANDING_BUTTON = `${BUTTON_PRIMARY} text-xl`;

/** `BUTTON_PRIMARY` at the size of the set pages' row buttons: a set card's Host (LIB-02). */
export const BUTTON_PRIMARY_SMALL = `min-h-11 rounded-control bg-accent px-4 py-2 font-sans text-base font-bold text-accent-ink ${PRIMARY_PRESS}`;

/** A 2px ink outline with an ink label on no fill: Save to My sets. */
export const BUTTON_OUTLINE = `min-h-11 rounded-control border-2 border-ink bg-transparent px-6 py-4 font-sans font-bold text-ink ${PRESS} ${HOVER}`;

/** Surface fill and a border: the remote's smaller actions. */
export const BUTTON_SECONDARY = `min-h-11 rounded-[14px] border-2 border-edge bg-surface px-4 py-3 ${PRESS} ${HOVER}`;

const SMALL = `min-h-11 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-base font-bold ${PRESS}`;

/** The set pages' row buttons: Edit, Duplicate, Preview, Export JSON. */
export const BUTTON_SMALL = `${SMALL} ${HOVER}`;

/** A 44×44 square holding one `Icon`: a drag grip, a `⋯` trigger, a Remove ×. Name it with `aria-label`. */
export const BUTTON_ICON = `flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-edge bg-surface ${PRESS} ${HOVER}`;

/**
 * The look of an action that can't be taken back, before it is armed: red text, and a red border
 * under the pointer. For a button shape of its own; never together with `HOVER`, whose ink border
 * would fight the red one.
 */
export const DANGER = 'text-buzz not-disabled:hover:border-buzz not-disabled:hover:hover-tint';

/** A small destructive button: Delete, Kick. Keep its `ConfirmButton` and put it last in its row. */
export const BUTTON_DANGER = `${SMALL} ${DANGER}`;

/** A text field or select on the set pages and the game builder. */
export const FIELD =
  'min-h-11 w-full rounded-control border-2 border-muted bg-bg px-3 py-2 font-sans text-lg text-ink disabled:opacity-40 aria-invalid:border-buzz';

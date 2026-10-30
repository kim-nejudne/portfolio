import { HOVER } from './hover.js';

// Class strings for the "Prime Time" building blocks, shared by every surface. Full strings, so
// Tailwind can see them. Sizes are for the phone and desktop pages; the Screen adds its own.

/** A card or panel: surface fill, 2px border, 20px radius. */
export const CARD = 'rounded-[20px] border-2 border-edge bg-surface p-6';

/** A small uppercase label ("FIRST TO BUZZ", "ALSO BUZZED", a category line). 14px: the floor (F92). */
export const LABEL = 'text-sm font-bold tracking-[3px] text-muted uppercase';

/** A pill or chip: surface fill and a 2px border. */
export const PILL = 'rounded-full border-2 border-edge bg-surface';

/** A muted text link or link-styled button, 44px tall to tap: Back to start, Cancel (FND-05). */
export const LINK =
  'inline-flex min-h-11 items-center text-muted underline underline-offset-4 hover:text-ink disabled:opacity-40';

/** The text input of the join and name forms. */
export const INPUT =
  'w-full rounded-[14px] border-2 border-edge bg-bg px-4 py-3 font-display focus:border-accent';

const PRESS = 'transition not-disabled:active:scale-95 disabled:opacity-40';

/**
 * Gold fill, indigo Bungee label: Join, Host a game, Start game, Next question. Disabled, it turns
 * indigo with a muted label rather than fading, because faded gold reads as brown (LND-08).
 */
export const BUTTON_PRIMARY =
  'min-h-11 rounded-2xl bg-accent px-6 py-4 font-display text-accent-ink transition not-disabled:hover:bg-accent-hover not-disabled:active:scale-95 disabled:bg-edge disabled:text-muted';

/** A gold outline with a gold Bungee label on no fill: Save to My sets. */
export const BUTTON_OUTLINE = `min-h-11 rounded-2xl border-2 border-accent bg-transparent px-6 py-4 font-display text-accent not-disabled:hover:border-accent-hover not-disabled:hover:text-accent-hover ${PRESS}`;

/** Surface fill and a border: the remote's smaller actions. */
export const BUTTON_SECONDARY = `min-h-11 rounded-[14px] border-2 border-edge bg-surface px-4 py-3 ${PRESS} ${HOVER}`;

const SMALL = `min-h-11 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-base font-bold ${PRESS}`;

/** The set pages' row buttons: Edit, Duplicate, Preview, Export JSON. */
export const BUTTON_SMALL = `${SMALL} ${HOVER}`;

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
  'min-h-11 w-full rounded-xl border-2 border-edge bg-bg px-3 py-2 text-lg text-ink disabled:opacity-40 aria-invalid:border-buzz';

import { HOVER } from './hover.js';

// Class strings for the Overprint building blocks (design.md), shared by every surface. Full
// strings, so Tailwind can see them. Sizes are for the phone and desktop pages; the Screen adds its
// own. The display face is for heads and figures only: controls and labels are Archivo Narrow 600
// (font-outlier), fields Archivo (font-sans). Square and flat: every radius token is 0.

/** A tile: paper-2, no border and no shadow, square. */
export const CARD = 'rounded-card bg-surface p-6';

/**
 * A tile or level cell you choose, around a sr-only radio or checkbox: a 2px ink outline inside the
 * box on the stock, and once chosen it floods the teal pass, multiplied (F149). Hover tints at once;
 * nothing tweens (design.md Motion). Level cells, picker tiles, board categories.
 */
export const CHOICE_TILE =
  'cursor-pointer rounded-control inset-ring-2 inset-ring-ink text-ink not-has-checked:not-has-disabled:hover:hover-tint has-checked:bg-accent has-checked:text-accent-ink has-checked:mix-blend-multiply has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus has-disabled:cursor-default has-disabled:opacity-40';

/** A ruled listing (design.md Rules): the 4px ink bar over it and a hairline under each row. /sets and the pickers (F149). */
export const RULED =
  'flex flex-col border-t-4 border-ink divide-y divide-edge border-b border-b-edge';

/** A small label ("First to buzz", "Also buzzed", a category line): Archivo Narrow 600, sentence case, untracked. 14px: the floor (F92). */
export const LABEL = 'font-outlier text-sm font-semibold text-muted';

/** A field's label ("Question", "Mode", "Choices"): Archivo Narrow 600 in ink, sentence case (F150). */
export const FIELD_LABEL = 'font-outlier font-semibold text-ink';

/** A status badge in a row ("Needs review", "Live", "Added"): a square paper-3 chip with no border; the caller adds its state colour (F141). */
export const BADGE =
  'shrink-0 rounded-pill bg-bg-deep px-2 font-outlier text-sm font-semibold whitespace-nowrap';

/** An admin figure (a count, a dollar sum): Anybody 900 at 150% in tabular figures, so columns of them line up (F141). */
export const FIGURE = 'font-display font-black font-stretch-150% tabular-nums';

/** A chip: surface fill and a 2px border, square. */
export const PILL = 'rounded-pill border-2 border-edge bg-surface';

/** A text link or link-styled button, 44px tall to tap: Back to start, Cancel (FND-05). Ink, a 2px ink underline that turns orange on hover. */
export const LINK =
  'inline-flex min-h-11 items-center text-ink underline decoration-ink decoration-2 underline-offset-4 not-disabled:hover:decoration-accent-2 disabled:opacity-40';

/** The text input of the join and name forms: a 2px ink edge inside the box (design.md Rules). */
export const INPUT = 'w-full rounded-control border-2 border-ink bg-bg px-4 py-3 font-sans';

const PRESS = 'transition not-disabled:active:scale-95 disabled:opacity-40';

/** Archivo Narrow 600 in capitals, untracked: the type of a primary and an outline button. */
const CONTROL_TYPE = 'font-outlier font-semibold uppercase';

/**
 * Overprint's press does not tween: hover pulls the block through the orange pass at once, and the
 * press darkens it an ink step. Disabled, it empties to a 2px ink-2 inset outline rather than
 * fading (LND-08).
 */
const PRIMARY_PRESS =
  'not-disabled:hover:bg-accent-hover not-disabled:hover:text-accent-2-ink not-disabled:active:bg-ink-2 not-disabled:active:text-paper disabled:bg-transparent disabled:text-ink-2 disabled:inset-ring-2 disabled:inset-ring-ink-2';

/** An ink block with paper type: Join, Host a game, Start game, Next question. */
export const BUTTON_PRIMARY = `min-h-11 rounded-control bg-ink px-6 py-4 ${CONTROL_TYPE} text-paper ${PRIMARY_PRESS}`;

/**
 * Landing's two actions, Join and Host a game: one column class, so neither outweighs the other
 * (F134). Index.css's `.passes` prints the first on the teal pass and the second on the orange (F144).
 */
export const LANDING_ACTION = 'flex flex-col gap-4';
const LANDING_SIZE = `min-h-11 rounded-control px-6 py-3 ${CONTROL_TYPE} text-base leading-none`;
/** Join: the mock's ink block. */
export const LANDING_BUTTON = `${LANDING_SIZE} bg-ink text-paper ${PRIMARY_PRESS}`;
/** Host a game: the outline at Join's size; on the orange pass, hover pulls it through teal (design.md Controls). */
export const LANDING_BUTTON_LINE = `${LANDING_SIZE} border-2 border-ink bg-transparent text-ink not-disabled:hover:bg-accent not-disabled:active:bg-ink-2 not-disabled:active:text-paper disabled:opacity-40`;

/** `BUTTON_PRIMARY` at the size of the set pages' row buttons: a set card's Host (LIB-02). */
export const BUTTON_PRIMARY_SMALL = `min-h-11 rounded-control bg-ink px-4 py-2 ${CONTROL_TYPE} text-base text-paper ${PRIMARY_PRESS}`;

/** The secondary: a 2px ink outline inside the box, ink type on no fill, the primary's size: Save to My sets. */
export const BUTTON_OUTLINE = `min-h-11 rounded-control border-2 border-ink bg-transparent px-6 py-4 ${CONTROL_TYPE} text-ink not-disabled:active:bg-bg-deep disabled:opacity-40 ${HOVER}`;

/** The primary and the outline without their size: the Screen sizes its own in cqw for the sofa (F146). */
export const SCREEN_BUTTON_PRIMARY = `min-h-11 rounded-control bg-ink ${CONTROL_TYPE} leading-none text-paper ${PRIMARY_PRESS}`;
export const SCREEN_BUTTON_OUTLINE = `min-h-11 rounded-control border-2 border-ink bg-transparent ${CONTROL_TYPE} leading-none text-ink not-disabled:active:bg-bg-deep disabled:opacity-40 ${HOVER}`;

/** Surface fill and a border: the remote's smaller actions. */
export const BUTTON_SECONDARY = `min-h-11 rounded-control border-2 border-edge bg-surface px-4 py-3 ${PRESS} ${HOVER}`;

// The secondary at row size (F149): a 2px ink outline, ink capitals on no fill; the press sinks to
// paper-3 and does not tween.
const SMALL = `min-h-11 rounded-control border-2 border-ink bg-transparent px-3 py-2 ${CONTROL_TYPE} text-base text-ink not-disabled:active:bg-bg-deep disabled:opacity-40`;

/** The set pages' row buttons: Edit, Duplicate, Preview, Export JSON. */
export const BUTTON_SMALL = `${SMALL} ${HOVER}`;

/** A 44×44 square holding one `Icon`: a drag grip, a `⋯` trigger, a Remove ×. Name it with `aria-label`. */
export const BUTTON_ICON = `flex min-h-11 min-w-11 items-center justify-center rounded-control border-2 border-ink text-ink not-disabled:active:bg-bg-deep disabled:opacity-40 ${HOVER}`;

/**
 * The look of an action that can't be taken back, before it is armed: red text, and a red border
 * under the pointer. For a button shape of its own; never together with `HOVER`, whose ink border
 * would fight the red one.
 */
export const DANGER = 'text-buzz not-disabled:hover:border-buzz not-disabled:hover:hover-tint';

/** A small destructive button: Delete, Kick, in a 2px red outline (design.md Controls). Keep its `ConfirmButton` and put it last in its row. */
export const BUTTON_DANGER = `${SMALL} border-buzz! ${DANGER}`;

/** A text field or select on the set pages and the game builder: a 2px ink edge inside the box. */
export const FIELD =
  'min-h-11 w-full rounded-control border-2 border-ink bg-bg px-3 py-2 font-sans text-lg text-ink disabled:opacity-40 aria-invalid:border-buzz';

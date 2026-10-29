// Class strings for the "Prime Time" building blocks, shared by every surface. Full strings, so
// Tailwind can see them. Sizes are for the phone and desktop pages; the Screen adds its own.

/** A card or panel: surface fill, 2px border, 20px radius. */
export const CARD = 'rounded-[20px] border-2 border-edge bg-surface p-6';

/** A small uppercase label ("FIRST TO BUZZ", "ALSO BUZZED", a category line). */
export const LABEL = 'text-[13px] font-bold tracking-[3px] text-muted uppercase';

/** A pill or chip: surface fill and a 2px border. */
export const PILL = 'rounded-full border-2 border-edge bg-surface';

/** The text input of the join and name forms. */
export const INPUT =
  'w-full rounded-[14px] border-2 border-edge bg-bg px-4 py-3 font-display focus:border-accent';

const PRESS = 'transition not-disabled:active:scale-95 disabled:opacity-40';

/** Gold fill, indigo Bungee label: Join, Host a game, Start game, Next question. */
export const BUTTON_PRIMARY = `min-h-11 rounded-2xl bg-accent px-6 py-4 font-display text-accent-ink not-disabled:hover:bg-accent-hover ${PRESS}`;

/** A gold outline with a gold Bungee label on no fill: Save to My sets. */
export const BUTTON_OUTLINE = `min-h-11 rounded-2xl border-2 border-accent bg-transparent px-6 py-4 font-display text-accent not-disabled:hover:border-accent-hover not-disabled:hover:text-accent-hover ${PRESS}`;

/** Surface fill and a border: the remote's smaller actions. */
export const BUTTON_SECONDARY = `min-h-11 rounded-[14px] border-2 border-edge bg-surface px-4 py-3 ${PRESS}`;

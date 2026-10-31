import type { Translate } from '../../lib/copy.js';

// SPEC-QUESTION: the spec gives no time for "Jun is back (new phone)"; 4 s, as the crown toast (DECISIONS 64).
/** How long the Screen says "Jun is back (new phone)" after an `fx rejoined` (F42). */
export const REJOINED_TOAST_MS = 4000;

/**
 * "Jun is back (new phone)" when a player's pid moved to another phone (F42), on a sticky note. Always mounted, so
 * screen readers announce it; empty and visually hidden otherwise. Below the top bar, where
 * "Need 2 players" sits, so it covers neither the timer nor "Jun’s phone reconnecting…".
 */
export function RejoinedToast({ name, t }: { name: string | null; t: Translate }) {
  return (
    <p
      role="status"
      className={
        name === null
          ? 'sr-only'
          : 'pointer-events-none absolute top-[16vmin] left-1/2 z-20 max-w-[90vw] -translate-x-1/2 truncate sketch-border bg-sticky px-[3vmin] py-[1vmin] font-hand text-[max(4vmin,20px)] text-ink shadow-[0.42vmin_0.56vmin_0_var(--color-ink)]'
      }
    >
      {name === null ? '' : t('backNewPhone', { name })}
    </p>
  );
}

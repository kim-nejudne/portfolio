import { useEffect, useState } from 'react';
import type { Translate } from '../../lib/copy.js';

/** Leave takes two taps; the second must come within this. */
const CONFIRM_MS = 4000;

/** "Leave", then "Tap again to leave" (with "Your points will be lost" mid-game). */
export function LeaveButton({
  onLeave,
  inGame,
  t,
}: {
  onLeave: () => void;
  inGame: boolean;
  t: Translate;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => (armed ? onLeave() : setArmed(true))}
      // Underlined at the bottom of the page (in the page's text colour, so it reads on the dark
      // standings too until F61); armed, a highlighter sketch button that asks again.
      className={`min-h-11 px-4 text-lg hover:bg-none ${
        armed
          ? 'sketch-border bg-hl text-ink shadow-[2px_3px_0_var(--color-ink)]'
          : 'underline decoration-2 underline-offset-4'
      }`}
    >
      {armed ? t(inGame ? 'leaveConfirmGame' : 'leaveConfirm') : t('leave')}
    </button>
  );
}

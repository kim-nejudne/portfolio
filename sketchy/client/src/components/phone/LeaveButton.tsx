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
      className={`min-h-11 rounded-xl px-4 text-base ${
        armed ? 'bg-[#B71C1C] font-bold text-white' : 'border border-white/30 text-white/80'
      }`}
    >
      {armed ? t(inGame ? 'leaveConfirmGame' : 'leaveConfirm') : t('leave')}
    </button>
  );
}

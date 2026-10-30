import { useState } from 'react';
import type { ScreenView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';

/**
 * The token Screen's **Next** during REVEAL and SCOREBOARD (`host:next`): the only way on when
 * auto-advance is off, and a shortcut past the 8 s / 6 s when it is on. A row of its own above the
 * footer, so it never covers a drawing or a score. Hidden while paused, when the server refuses
 * `host:next`. F24's control bar and its `N` and Space keys replace it.
 */
export function NextButton({
  view,
  socket,
  t,
}: {
  view: ScreenView;
  socket: GameSocket;
  t: Translate;
}) {
  const [sending, setSending] = useState(false);
  if (!view.host || view.paused || (view.phase !== 'REVEAL' && view.phase !== 'SCOREBOARD'))
    return null;

  const next = async () => {
    setSending(true);
    try {
      // A refusal (the phase already moved on) needs no message: the next `state` shows it.
      await socket.timeout(5000).emitWithAck('host:next', {});
    } catch {
      // No ack: the host can tap again.
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex shrink-0 justify-end px-[3vmin] pb-[1vmin]">
      <button
        type="button"
        onClick={next}
        disabled={sending}
        aria-busy={sending}
        className="min-h-11 min-w-11 rounded-[2vmin] bg-[#FF6B35] px-[4vmin] py-[1vmin] text-[max(3.5vmin,20px)] font-bold text-[#1D1B22] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-75"
      >
        {t('next')} <span aria-hidden="true">▶</span>
      </button>
    </div>
  );
}

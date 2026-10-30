import { useEffect, useRef } from 'react';
import type { PlayerChipView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { HostPlayerList } from '../HostPlayerList.js';

/**
 * The token Screen's players dialog (Host controls): one player, from tapping their lobby chip, or
 * everyone, from the control bar's Players button. Give host crown and Kick for each. Esc, Close
 * or the backdrop close it, and focus goes back to what opened it.
 */
export function PlayersDialog({
  players,
  title,
  socket,
  t,
  onClose,
}: {
  players: PlayerChipView[];
  title: string;
  socket: GameSocket;
  t: Translate;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-black/80 p-[3vmin]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="players-title"
        tabIndex={-1}
        className="flex max-h-full w-[min(96vw,110vmin)] flex-col gap-[2vmin] overflow-y-auto overscroll-contain rounded-[2vmin] bg-[#2A2730] p-[4vmin] outline-none"
      >
        <div className="flex items-center justify-between gap-[3vmin]">
          <h2
            id="players-title"
            className="font-display min-w-0 truncate text-[max(4vmin,22px)] font-bold"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-[1.5vmin] bg-[#FF6B35] px-[3vmin] py-[1vmin] text-[max(2.8vmin,16px)] font-bold text-[#1D1B22] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t('close')}
          </button>
        </div>
        <HostPlayerList players={players} socket={socket} t={t} size="screen" />
      </div>
    </div>
  );
}

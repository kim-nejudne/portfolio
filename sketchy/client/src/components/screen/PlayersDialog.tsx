import { useEffect, useRef } from 'react';
import type { PlayerChipView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { HostPlayerList } from '../HostPlayerList.js';
import { SHEET_DOTS, SHEET_TITLE, sheetButton } from '../sketch/sheet.js';

/**
 * The token Screen's players dialog (Host controls): one player, from tapping their lobby chip, or
 * everyone, from the control bar's Players button. Give host crown and Kick for each. Esc, Close
 * or the veil close it, and focus goes back to what opened it. A dot-grid sheet with a hard shadow
 * on a paper veil (F63).
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
      className="absolute inset-0 z-40 flex cursor-pointer items-center justify-center bg-paper/80 p-[3vmin]"
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
        data-sheet="players"
        className={`flex max-h-full w-[min(96vw,110vmin)] cursor-auto flex-col gap-[2vmin] overflow-y-auto overscroll-contain rounded-[0.6vmin] border-[length:max(2px,0.28vmin)] border-ink bg-paper ${SHEET_DOTS} p-[4vmin] text-ink shadow-[0.8vmin_1vmin_0_var(--color-ink)] outline-none`}
      >
        <div className="flex items-center justify-between gap-[3vmin]">
          <h2 id="players-title" className={`${SHEET_TITLE} truncate text-[max(4.4vmin,22px)]`}>
            {title}
          </h2>
          <button type="button" onClick={onClose} className={sheetButton('primary')}>
            {t('close')}
          </button>
        </div>
        <HostPlayerList players={players} socket={socket} t={t} size="screen" />
      </div>
    </div>
  );
}

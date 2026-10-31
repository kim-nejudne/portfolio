import { useEffect, useRef, useState } from 'react';
import type { Avatar } from '../../../../shared/types.js';
import type { CopyKey, Translate } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { AvatarPicker } from './AvatarPicker.js';

const ACK_TIMEOUT_MS = 5000;

/**
 * Sends `player:avatar` and resolves with the copy key to show, or null once the server took it.
 * Offline it sends nothing: Socket.IO would buffer the change and send it after a reconnect.
 */
export async function sendAvatar(
  socket: Pick<GameSocket, 'connected' | 'timeout'>,
  avatar: Avatar,
): Promise<CopyKey | null> {
  if (!socket.connected) return 'avatarFailed';
  try {
    const res = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('player:avatar', { avatar });
    if (res.ok) return null;
    return res.error === 'rateLimited' ? 'tooFast' : 'avatarFailed';
  } catch {
    return 'avatarFailed';
  }
}

/**
 * A tap in the dialog: null when it should close (the current avatar again, which sends nothing, or
 * the server took the new one, and then `onSaved` has it), else the copy key to show.
 */
export async function chooseAvatar(
  socket: Pick<GameSocket, 'connected' | 'timeout'>,
  current: Avatar,
  next: Avatar,
  onSaved: (avatar: Avatar) => void,
): Promise<CopyKey | null> {
  if (next === current) return null;
  const message = await sendAvatar(socket, next);
  if (!message) onSaved(next);
  return message;
}

/**
 * Change avatar (F54), over the phone lobby while open: the 24 emoji with the player's current one
 * picked. A tap sends `player:avatar`; the server's `ok` closes the dialog (the next snapshot shows
 * the new avatar) and `onSaved` stores it for the next join. A refusal stays open with a message.
 * Done or Esc closes it unchanged.
 */
export function ChangeAvatarDialog({
  avatar,
  socket,
  t,
  onSaved,
  onClose,
}: {
  /** The player's avatar in the latest snapshot. */
  avatar: Avatar;
  socket: GameSocket;
  t: Translate;
  onSaved: (avatar: Avatar) => void;
  onClose: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pick = async (next: Avatar) => {
    if (sending) return;
    setSending(true);
    setError(null);
    const message = await chooseAvatar(socket, avatar, next, onSaved);
    setSending(false);
    if (message) return setError(t(message));
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-avatar-title"
      aria-busy={sending}
      className="absolute inset-0 z-20 flex flex-col gap-3 overflow-y-auto overscroll-contain bg-[#1D1B22] px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="change-avatar-title" className="font-display text-2xl leading-tight font-bold">
          {t('changeAvatar')}
        </h2>
        <button
          ref={done}
          type="button"
          onClick={onClose}
          className="min-h-11 min-w-11 shrink-0 rounded-xl bg-[#FF6B35] px-4 text-lg font-bold text-[#1D1B22] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {t('settingsDone')}
        </button>
      </div>
      <AvatarPicker avatar={avatar} onAvatar={(next) => void pick(next)} t={t} />
      <p role="status" className="min-h-[1.5em] text-center text-base text-[#FFD166]">
        {error ?? ''}
      </p>
    </div>
  );
}

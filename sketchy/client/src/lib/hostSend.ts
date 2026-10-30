// Sending a host action from the crown phone or the token Screen: the server validates and applies
// it, and the next snapshot shows the result. Only the outcomes a host can act on get a message.

import { useCallback, useEffect, useState } from 'react';
import type { ClientPayloads } from '../../../shared/types.js';
import type { CopyKey, Translate } from './copy.js';
import type { HostEvent } from './hostKeys.js';
import type { GameSocket } from './socket.js';

const ACK_TIMEOUT_MS = 5000;
/** How long a hint or a refusal stays up. */
export const STATUS_MS = 3000;

/**
 * Sends `event` and resolves with the copy key to show, or null. Offline it sends nothing:
 * Socket.IO would buffer the event and send it on reconnect, and a Skip or Kick tapped during a
 * wifi blip must not land later. Other refusals (the phase moved on, a race) need no message.
 */
export async function sendHost<E extends HostEvent>(
  socket: GameSocket,
  event: E,
  payload: ClientPayloads[E],
): Promise<CopyKey | null> {
  if (!socket.connected) return 'hostActionFailed';
  try {
    const res = await socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(event as HostEvent, payload as never);
    if (res.ok) return null;
    if (res.error === 'notAvailable') return 'notYet';
    if (res.error === 'notEnoughPlayers') return 'needTwoPlayers';
    return null;
  } catch {
    return 'hostActionFailed';
  }
}

/**
 * A host action sender for one panel: which action (by any key the caller picks) is in flight,
 * and a status line that clears after `STATUS_MS`.
 */
export function useHostSender(socket: GameSocket, t: Translate) {
  const [sending, setSending] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const send = useCallback(
    async <E extends HostEvent>(key: string, event: E, payload: ClientPayloads[E]) => {
      setSending(key);
      setStatus(null);
      const message = await sendHost(socket, event, payload);
      setSending(null);
      if (message) setStatus(t(message));
    },
    [socket, t],
  );

  return { sending, status, setStatus, send };
}

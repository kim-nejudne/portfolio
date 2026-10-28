import { useCallback, useState, type RefObject } from 'react';
import type {
  Ack,
  ClientEvent,
  ClientPayloads,
  HostView,
  ScreenView,
} from '../../../shared/types.js';
import type { GameSocket } from './socket.js';

const NOT_CONNECTED_ERROR = 'Not connected';

/** Every event the host remote, or a Screen holding the hostToken, sends once it has joined. */
export type HostEvent = Exclude<Extract<ClientEvent, `host:${string}`>, 'host:join'>;

/** Sends a host event and calls back with the server's ack. */
export type SendHost = <E extends HostEvent>(
  event: E,
  payload: ClientPayloads[E],
  ack: (res: Ack) => void,
) => void;

/**
 * `GameSocket.emit` seen with a generic host event. Socket.IO types the arguments as
 * `Parameters<…[E]>`, which TypeScript can't resolve for a generic `E`. A `GameSocket` is still
 * checked against this shape when assigned to it.
 */
interface HostEmitter {
  emit<E extends HostEvent>(event: E, payload: ClientPayloads[E], ack: (res: Ack) => void): unknown;
}

function emitHost<E extends HostEvent>(
  socket: HostEmitter,
  event: E,
  payload: ClientPayloads[E],
  ack: (res: Ack) => void,
): void {
  socket.emit(event, payload, ack);
}

/** A `SendHost` over the page's open socket. With no socket it acks "Not connected". */
export function useSendHost(socketRef: RefObject<GameSocket | null>): SendHost {
  return useCallback<SendHost>(
    (event, payload, ack) => {
      const socket = socketRef.current;
      if (socket) emitHost(socket, event, payload, ack);
      else ack({ ok: false, error: NOT_CONNECTED_ERROR });
    },
    [socketRef],
  );
}

/**
 * Sends host events for the whole remote. `busy` is true from a press until a new snapshot
 * or a rejection arrives, so a double tap sends once and a lost ack never leaves the buttons stuck
 * after a reconnect. An ok ack keeps them busy: the new snapshot is what moves them on. A
 * rejection, for example a stale action from a second host tab, goes to `onRejected`.
 */
export function useHostCommand(
  view: HostView | ScreenView,
  send: SendHost,
  onRejected: (error: string) => void,
): HostCommand {
  const [sentFrom, setSentFrom] = useState<HostView | ScreenView | null>(null);

  const run: SendCommand = (event, payload) => {
    setSentFrom(view);
    send(event, payload, (res) => {
      if (res.ok) return;
      setSentFrom(null);
      onRejected(res.error);
    });
  };

  return { busy: sentFrom === view, run };
}

type SendCommand = <E extends HostEvent>(event: E, payload: ClientPayloads[E]) => void;

/** One lock for every button on the remote: a press anywhere waits for the next snapshot. */
export interface HostCommand {
  busy: boolean;
  run: SendCommand;
}

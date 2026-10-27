import { useState } from 'react';
import type { Ack, ClientEvent, ClientPayloads, HostView } from '../../../shared/types.js';

/** Every event the host remote sends once it has joined. */
export type HostEvent = Exclude<Extract<ClientEvent, `host:${string}`>, 'host:join'>;

/** Sends a host event and calls back with the server's ack. */
export type SendHost = <E extends HostEvent>(
  event: E,
  payload: ClientPayloads[E],
  ack: (res: Ack) => void,
) => void;

/**
 * Sends host events for the whole remote. `busy` is true from a press until a new snapshot
 * or a rejection arrives, so a double tap sends once and a lost ack never leaves the buttons stuck
 * after a reconnect. An ok ack keeps them busy: the new snapshot is what moves them on. A
 * rejection, for example a stale action from a second host tab, goes to `onRejected`.
 */
export function useHostCommand(
  view: HostView,
  send: SendHost,
  onRejected: (error: string) => void,
): HostCommand {
  const [sentFrom, setSentFrom] = useState<HostView | null>(null);

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

import { useEffect, useState } from 'react';
import type { Translate } from './copy.js';
import {
  CONFIRM_LABELS,
  CONFIRM_MS,
  controlEvent,
  press,
  type Armed,
  type ControlId,
  type HostView,
} from './hostKeys.js';
import { useHostSender } from './hostSend.js';
import type { GameSocket } from './socket.js';

/**
 * The crown phone's host controls (Host controls): a tap sends, or for a two-tap control arms it
 * ("Tap again to skip") until a second tap within `CONFIRM_MS`. A first tap never carries over into
 * another phase or turn. Shared by the Host sheet and the final page's Rematch / Back to lobby
 * (F61), and the token Screen's final page (F66); each keeps its own arming.
 */
export function useHostTaps(
  view: HostView & { turn: { id: number } | null },
  socket: GameSocket,
  t: Translate,
) {
  const { sending, status, setStatus, send } = useHostSender(socket, t);
  const scope = `${view.phase}:${view.turn?.id ?? ''}`;
  const [armedAt, setArmed] = useState<(Armed & { scope: string }) | null>(null);
  const armed = armedAt?.scope === scope ? armedAt : null;

  useEffect(() => {
    if (!armedAt) return;
    // The hint goes with the arming, so "Tap again…" never sits under a button that has reset.
    const timer = setTimeout(() => {
      setArmed(null);
      setStatus(null);
    }, CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [armedAt, setStatus]);

  // `now` is the click's own timestamp (performance.now()'s clock).
  const tap = (control: ControlId, now: number) => {
    if (sending) return;
    const { command, armed: next } = press(control, armed, now);
    setArmed(next && { ...next, scope });
    if (command.kind === 'arm') {
      const hint = CONFIRM_LABELS[control];
      if (hint) setStatus(t(hint));
      return;
    }
    const { event, payload } = controlEvent(control, view);
    void send(control, event, payload);
  };

  // While armed, the button itself asks again: the hint stays in the status line for screen
  // readers only.
  const hint = armed ? CONFIRM_LABELS[armed.control] : undefined;
  const statusIsHint = hint !== undefined && status === t(hint);
  return { armed, tap, sending, status, statusIsHint, send };
}

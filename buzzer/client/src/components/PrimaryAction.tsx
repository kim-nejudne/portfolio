import { useState } from 'react';
import type { Ack, HostView, Phase } from '../../../shared/types.js';

/** The host events the primary button sends. None of them carries a payload. */
export type PrimaryEvent = 'host:start' | 'host:open' | 'host:reveal' | 'host:next';

interface PrimaryActionProps {
  view: HostView;
  /** Sends the event and calls back with the server's ack. */
  send: (event: PrimaryEvent, ack: (res: Ack) => void) => void;
  /** Shows why the server refused, for example a stale action from a second host tab. */
  onRejected: (error: string) => void;
}

/**
 * The remote's full-width primary button (UI spec, Host remote). Its label and event follow the
 * phase; the server decides whether the action is allowed.
 */
export function PrimaryAction({ view, send, onRejected }: PrimaryActionProps) {
  // The snapshot the last press was sent from. A new snapshot or a rejection re-enables the button,
  // so a double tap sends once and a lost ack never leaves it stuck after a reconnect. An ok ack
  // keeps it disabled: the new snapshot is what moves the button on.
  const [sentFrom, setSentFrom] = useState<HostView | null>(null);
  const action = primaryFor(view);
  if (!action) return null;

  function press(event: PrimaryEvent) {
    setSentFrom(view);
    send(event, (res) => {
      if (res.ok) return;
      setSentFrom(null);
      onRejected(res.error);
    });
  }

  return (
    <button
      type="button"
      onClick={() => press(action.event)}
      disabled={sentFrom === view}
      className="w-full rounded-3xl bg-accent px-6 py-6 font-display text-3xl text-accent-ink transition active:scale-95 disabled:opacity-40"
    >
      {action.label}
    </button>
  );
}

const BY_PHASE: Partial<Record<Phase, { label: string; event: PrimaryEvent }>> = {
  LOBBY: { label: 'Start game', event: 'host:start' },
  QUESTION: { label: 'Open buzzers', event: 'host:open' },
  OPEN: { label: 'Reveal answer', event: 'host:reveal' },
  COLLECTING: { label: 'Reveal answer', event: 'host:reveal' },
  // TODO(F22): Correct / Wrong side by side once judging is wired (F21). Until then the host reveals.
  BUZZED: { label: 'Reveal answer', event: 'host:reveal' },
};

function primaryFor(view: HostView): { label: string; event: PrimaryEvent } | null {
  if (view.phase === 'REVEAL') {
    // `host:next` after the last question shows the final results instead of another question.
    const last = view.questionIndex >= view.questionCount - 1;
    return { label: last ? 'Show final results' : 'Next question', event: 'host:next' };
  }
  return BY_PHASE[view.phase] ?? null;
}

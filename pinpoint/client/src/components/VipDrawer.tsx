import { useEffect, useState } from 'react';
import type { Phase, VipControl } from '#shared/types.js';
import type { GameSocket } from '../lib/socket.js';

/** How long a two-tap control stays armed (DESIGN.md "Button"). */
export const CONFIRM_MS = 3000;

const PRIMARY =
  'min-h-12 w-full rounded-button bg-amber px-6 text-lg font-semibold text-board-bg [@media(hover:hover)]:hover:brightness-110 active:scale-[0.96] disabled:opacity-50';
const SECONDARY =
  'min-h-12 w-full rounded-button border border-line px-6 font-semibold text-text [@media(hover:hover)]:hover:bg-board-bg active:scale-[0.96] disabled:opacity-50';
const DESTRUCTIVE =
  'min-h-12 w-full rounded-button border border-delayed px-6 font-semibold text-delayed [@media(hover:hover)]:hover:bg-board-bg active:scale-[0.96] disabled:opacity-50';

type Control = 'next' | 'pause' | 'resume' | 'skipRound' | 'end';

/** Label, style, and the armed label of a two-tap control (spec: VIP controls). */
const CONTROLS: Record<Control, { label: string; style: string; confirm?: (p: Phase) => string }> =
  {
    next: { label: 'Next', style: PRIMARY },
    pause: { label: 'Pause', style: SECONDARY },
    resume: { label: 'Resume', style: SECONDARY },
    skipRound: {
      label: 'Skip round',
      style: DESTRUCTIVE,
      confirm: (p) => (p === 'REVEAL' ? 'Tap again to void this round' : 'Tap again to skip'),
    },
    // SPEC-QUESTION: DECISIONS 29 (End game takes two taps in every phase)
    end: { label: 'End game', style: DESTRUCTIVE, confirm: () => 'Tap again to end the game' },
  };

// shortcut: Players (F22), Round settings (F23), Rematch, Back to lobby and Cancel (F24) are not
// drawn yet; each lands here with its feature.
const isDrawn = (c: VipControl): c is Control => c in CONTROLS;

/** The controls the drawer draws for `controls`: the ★ button shows only when there are some. */
export const drawerControls = (controls: VipControl[]): Control[] => controls.filter(isDrawn);

/**
 * The VIP drawer (DESIGN.md "VIP drawer"): a bottom sheet over the player's own view, opened only
 * by the ★ button. An action that lands closes it; a refusal shows its text.
 */
export function VipDrawer({
  phase,
  controls,
  socket,
  onClose,
}: {
  phase: Phase;
  controls: VipControl[];
  socket: GameSocket | null;
  onClose: () => void;
}) {
  const [armed, setArmed] = useState<Control | null>(null);
  const [sending, setSending] = useState<Control | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function tap(control: Control) {
    if (CONTROLS[control].confirm && armed !== control) return setArmed(control);
    setArmed(null);
    setError(null);
    if (!socket) return;
    setSending(control);
    socket.emit(`vip:${control}`, {}, (res) => {
      setSending(null);
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <>
      {/* Taps outside the sheet close it. Above the paused overlay (z 1100), below Click to start. */}
      <div className="fixed inset-0 z-[1150] bg-board-bg/60" onClick={onClose} />
      <section
        id="vip-drawer"
        role="dialog"
        aria-label="VIP controls"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-[1160] flex flex-col gap-3 rounded-t-card border-t border-line bg-board-panel px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <h2 className="board-face text-sm text-amber">★ VIP</h2>
        {/* The armed label is announced: only the button text changes. */}
        <p aria-live="polite" className="sr-only">
          {armed && CONTROLS[armed].confirm?.(phase)}
        </p>
        {drawerControls(controls).map((c, i) => {
          const { label, style, confirm } = CONTROLS[c];
          return (
            <button
              key={c}
              type="button"
              autoFocus={i === 0}
              disabled={sending !== null}
              onClick={() => tap(c)}
              className={style}
            >
              {sending === c ? '…' : armed === c && confirm ? confirm(phase) : label}
            </button>
          );
        })}
        {error && (
          <p role="alert" className="text-delayed">
            {error}
          </p>
        )}
      </section>
    </>
  );
}

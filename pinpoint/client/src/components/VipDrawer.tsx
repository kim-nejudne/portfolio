import { useEffect, useState } from 'react';
import { ROUND_OPTIONS, TIMER_OPTIONS } from '#shared/constants.js';
import type { Ack, GameSettings, Phase, PublicPlayer, VipControl } from '#shared/types.js';
import type { GameSocket } from '../lib/socket.js';
import { Segmented } from './VipLobby.js';

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

type Drawn = Control | 'kick' | 'roundSettings';

// shortcut: Rematch, Back to lobby and Cancel (F24) are not drawn yet; they land with F24.
const isDrawn = (c: VipControl): c is Drawn =>
  c === 'kick' || c === 'roundSettings' || c in CONTROLS;

/** The controls the drawer draws for `controls`: the ★ button shows only when there are some. */
export const drawerControls = (controls: VipControl[]): Drawn[] => controls.filter(isDrawn);

const KICK_CONFIRM = 'Tap again to kick';
const KICK =
  'min-h-12 shrink-0 rounded-button border border-delayed px-4 font-semibold text-delayed [@media(hover:hover)]:hover:bg-board-bg active:scale-[0.96] disabled:opacity-50';

/**
 * The VIP drawer (DESIGN.md "VIP drawer"): a bottom sheet over the player's own view, opened only
 * by the ★ button. An action that lands closes it; a refusal shows its text.
 */
export function VipDrawer({
  phase,
  controls,
  players,
  meId,
  settings,
  played,
  socket,
  onClose,
}: {
  phase: Phase;
  controls: VipControl[];
  /** The game's settings: Round settings shows the timer and total rounds. */
  settings: GameSettings;
  /** Rounds played so far: Round settings disables a total at or below it. */
  played: number;
  /** Everyone in the room; the Players list kicks all but the VIP (spec: VIP). */
  players: PublicPlayer[];
  meId: string;
  socket: GameSocket | null;
  onClose: () => void;
}) {
  // A control, or `kick:<playerId>` for a Players row.
  const [armed, setArmed] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  // The refusal and the key it answers: a Round settings refusal shows under its controls.
  const [error, setError] = useState<{ key: string; text: string } | null>(null);

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

  /**
   * A two-tap key arms first; the second tap (or the only one) sends through `emit`. A landed
   * action closes the drawer, except a Round settings change, so the VIP can change both.
   */
  function tap(
    key: string,
    twoTap: boolean,
    emit: (s: GameSocket, ack: (res: Ack) => void) => void,
    close = true,
  ) {
    if (twoTap && armed !== key) return setArmed(key);
    setArmed(null);
    setError(null);
    if (!socket) return;
    setSending(key);
    emit(socket, (res) => {
      setSending(null);
      if (!res.ok) setError({ key, text: res.error });
      else if (close) onClose();
    });
  }

  const roundSettings = (change: Partial<Pick<GameSettings, 'timerSeconds' | 'rounds'>>) =>
    tap('roundSettings', false, (s, ack) => s.emit('vip:roundSettings', change, ack), false);

  const others = players.filter((p) => p.id !== meId);
  const armedKick = armed?.startsWith('kick:')
    ? others.find((p) => `kick:${p.id}` === armed)
    : null;
  const armedLabel = armedKick
    ? `Tap again to kick ${armedKick.name}`
    : armed && CONTROLS[armed as Control]?.confirm?.(phase);

  return (
    <>
      {/* Taps outside the sheet close it. Above the paused overlay (z 1100), below Click to start. */}
      <div className="fixed inset-0 z-[1150] bg-board-bg/60" onClick={onClose} />
      <section
        id="vip-drawer"
        role="dialog"
        aria-label="VIP controls"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-[1160] flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-card border-t border-line bg-board-panel px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <h2 className="board-face text-sm text-amber">★ VIP</h2>
        {/* The armed label is announced: only the button text changes. */}
        <p aria-live="polite" className="sr-only">
          {armedLabel}
        </p>
        {drawerControls(controls).map((c, i) => {
          if (c === 'roundSettings')
            return (
              <section
                key={c}
                aria-labelledby="vip-round-settings"
                aria-busy={sending === c}
                className="flex flex-col gap-2"
              >
                <h3 id="vip-round-settings" className="font-semibold text-text-dim">
                  Round settings
                </h3>
                <Segmented
                  legend="Timer"
                  value={settings.timerSeconds}
                  onChange={(timerSeconds) => roundSettings({ timerSeconds })}
                  disabled={sending !== null}
                  options={TIMER_OPTIONS.map((t) => ({
                    value: t,
                    label: `${t} s`,
                    reason: null,
                  }))}
                />
                <Segmented
                  legend="Rounds"
                  value={settings.rounds}
                  onChange={(rounds) => roundSettings({ rounds })}
                  disabled={sending !== null}
                  options={ROUND_OPTIONS.map((r) => ({
                    value: r,
                    label: String(r),
                    // SPEC-QUESTION: DECISIONS 31 (the reason under a disabled count)
                    reason: r <= played ? `${played} rounds already played` : null,
                  }))}
                />
                {error?.key === c && (
                  <p role="alert" className="text-delayed">
                    {error.text}
                  </p>
                )}
              </section>
            );
          if (c === 'kick')
            return (
              <section key={c} aria-labelledby="vip-players" className="flex flex-col gap-2">
                <h3 id="vip-players" className="font-semibold text-text-dim">
                  Players
                </h3>
                {others.length === 0 ? (
                  <p className="text-text-dim">No other players</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {others.map((p, j) => {
                      const key = `kick:${p.id}`;
                      return (
                        <li key={p.id} className="flex items-center gap-3">
                          <span aria-hidden="true" className="text-2xl">
                            {p.emoji}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate font-semibold ${p.connected ? 'text-text' : 'text-text-dim'}`}
                          >
                            {p.name}
                          </span>
                          <button
                            type="button"
                            autoFocus={i === 0 && j === 0}
                            aria-label={armed === key ? KICK_CONFIRM : `Kick ${p.name}`}
                            disabled={sending !== null}
                            onClick={() =>
                              tap(key, true, (s, ack) =>
                                s.emit('vip:kick', { playerId: p.id }, ack),
                              )
                            }
                            className={KICK}
                          >
                            {sending === key ? '…' : armed === key ? KICK_CONFIRM : 'Kick'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          const { label, style, confirm } = CONTROLS[c];
          return (
            <button
              key={c}
              type="button"
              autoFocus={i === 0}
              disabled={sending !== null}
              onClick={() => tap(c, confirm !== undefined, (s, ack) => s.emit(`vip:${c}`, {}, ack))}
              className={style}
            >
              {sending === c ? '…' : armed === c && confirm ? confirm(phase) : label}
            </button>
          );
        })}
        {error && error.key !== 'roundSettings' && (
          <p role="alert" className="text-delayed">
            {error.text}
          </p>
        )}
      </section>
    </>
  );
}

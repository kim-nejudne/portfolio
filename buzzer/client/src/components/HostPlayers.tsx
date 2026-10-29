import { useState } from 'react';
import { SCORE_DELTA_MAX } from '../../../shared/constants.js';
import type { HostView } from '../../../shared/types.js';
import { useRoomStore } from '../lib/roomStore.js';
import type { HostCommand } from '../lib/useHostCommand.js';
import { ConfirmButton } from './ConfirmButton.js';
import { PlayerAvatar } from './PlayerAvatar.js';

interface HostPlayersProps {
  view: HostView;
  command: HostCommand;
}

const small =
  'min-h-11 rounded-xl border-2 border-edge bg-bg px-3 py-2 font-display transition not-disabled:active:scale-95 disabled:opacity-40';

/**
 * The remote's Players tab (UI spec, Host remote): each player's score and connection, buttons
 * that adjust the score by the current question's value, a Custom amount, and Kick. Without a
 * current question (the lobby, or a game ended from it) there is no value to adjust by, so those
 * buttons are hidden; Custom stays.
 *
 * While the remote's own socket is not connected, the last snapshot's statuses may be stale, so
 * every row says "status unknown", dimmed, until it reconnects (F41).
 */
export function HostPlayers({ view, command }: HostPlayersProps) {
  const { busy, run } = command;
  const step = view.question?.points ?? 0;
  const { players } = view;
  const unknown = useRoomStore((state) => state.connection) !== 'connected';

  return (
    <section aria-labelledby="players-heading" className="flex flex-col gap-2">
      <h2 id="players-heading" className="font-display text-xl text-accent">
        Players ({players.length})
      </h2>
      {players.length === 0 ? (
        <p className="text-muted">No one has joined yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li
              key={player.id}
              aria-label={player.name}
              className="flex flex-col gap-2 rounded-2xl border-2 border-edge bg-surface px-3 py-2"
            >
              {/* Greyed while offline or unknown; the buttons below stay full strength, since they still work. */}
              <p
                className={`flex items-center gap-3 ${player.connected && !unknown ? '' : 'opacity-40'}`}
              >
                <span
                  aria-hidden
                  style={{ backgroundColor: player.color }}
                  className="size-4 shrink-0 rounded-full"
                />
                <PlayerAvatar avatar={player.avatar} className="text-xl" />
                <span className="min-w-0 flex-1 truncate font-bold">{player.name}</span>
                <span className="text-sm text-muted">
                  {unknown
                    ? 'status unknown'
                    : player.connected
                      ? `online · ${Math.round(player.rttMs)} ms`
                      : 'offline'}
                </span>
                <span className="font-display text-xl">{player.score}</span>
              </p>
              <p className="flex flex-wrap items-center gap-2">
                {step > 0 && (
                  <>
                    <button
                      type="button"
                      aria-label={`Subtract ${step} from ${player.name}`}
                      onClick={() => run('host:adjustScore', { playerId: player.id, delta: -step })}
                      disabled={busy}
                      className={small}
                    >
                      −{step}
                    </button>
                    <button
                      type="button"
                      aria-label={`Add ${step} to ${player.name}`}
                      onClick={() => run('host:adjustScore', { playerId: player.id, delta: step })}
                      disabled={busy}
                      className={small}
                    >
                      +{step}
                    </button>
                  </>
                )}
                <CustomAdjust player={player} command={command} />
                <span className="ml-auto">
                  <ConfirmButton
                    label="Kick"
                    confirmLabel="Confirm kick"
                    ariaLabel={`Kick ${player.name}`}
                    onConfirm={() => run('host:kick', { playerId: player.id })}
                    disabled={busy}
                    className={small}
                  />
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A whole number of points from 1 to `SCORE_DELTA_MAX`, or null. */
function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return amount >= 1 && amount <= SCORE_DELTA_MAX ? amount : null;
}

/**
 * Custom: a field for any amount, then Subtract or Add. The field takes digits only, because a
 * phone's number pad has no minus key; the two buttons give the sign (DECISIONS F67).
 */
function CustomAdjust({
  player,
  command: { busy, run },
}: {
  player: HostView['players'][number];
  command: HostCommand;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const amount = parseAmount(text);
  const adjust = (delta: number) => {
    run('host:adjustScore', { playerId: player.id, delta });
    setOpen(false);
    setText('');
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Custom amount for ${player.name}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`${small} ${open ? 'border-accent' : ''}`}
      >
        Custom
      </button>
      {open && (
        <span className="flex w-full items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label={`Amount for ${player.name}`}
            placeholder="Amount"
            maxLength={String(SCORE_DELTA_MAX).length + 2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-11 w-0 min-w-0 flex-1 rounded-xl border-2 border-edge bg-bg px-3 py-2 font-display text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            aria-label={
              amount === null
                ? `Subtract custom amount from ${player.name}`
                : `Subtract ${amount} from ${player.name}`
            }
            onClick={() => amount !== null && adjust(-amount)}
            disabled={busy || amount === null}
            className={small}
          >
            −{amount ?? ''}
          </button>
          <button
            type="button"
            aria-label={
              amount === null
                ? `Add custom amount to ${player.name}`
                : `Add ${amount} to ${player.name}`
            }
            onClick={() => amount !== null && adjust(amount)}
            disabled={busy || amount === null}
            className={small}
          >
            +{amount ?? ''}
          </button>
        </span>
      )}
    </>
  );
}

import { useState } from 'react';
import { SCORE_DELTA_MAX } from '../../../shared/constants.js';
import type { HostView, TeamView } from '../../../shared/types.js';
import { useRoomStore } from '../lib/roomStore.js';
import { HOVER } from '../lib/hover.js';
import type { HostCommand } from '../lib/useHostCommand.js';
import { BUTTON_ICON } from '../lib/ui.js';
import { OverflowMenu, type MenuItem } from './OverflowMenu.js';
import { PlayerAvatar } from './PlayerAvatar.js';

interface HostPlayersProps {
  view: HostView;
  command: HostCommand;
}

const small = `min-h-11 rounded-xl border-2 border-edge bg-bg px-3 py-2 font-display transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`;

/**
 * The remote's Players tab (UI spec, Host remote): each player's score and connection, buttons
 * that adjust the score by the current question's value, a Custom amount, and Kick in a `⋯` menu.
 * Without a current question (the lobby, or a game ended from it) there is no value to adjust by,
 * so those buttons are hidden; Custom stays.
 *
 * While the remote's own socket is not connected, the last snapshot's statuses may be stale, so
 * every row says "status unknown", dimmed, until it reconnects (F41).
 *
 * With teams on, the rows are grouped by team; each row's `⋯` menu moves the player (F83, F98).
 */
export function HostPlayers({ view, command }: HostPlayersProps) {
  const { players, teams } = view;
  const unknown = useRoomStore((state) => state.connection) !== 'connected';
  const rowProps = { view, command, unknown };

  return (
    // A size container: where the list has room (the tablet's column), each row is one line (HST-10).
    <section aria-labelledby="players-heading" className="@container/players flex flex-col gap-2">
      <h2 id="players-heading" className="font-display text-xl text-accent">
        Players ({players.length})
      </h2>
      {players.length === 0 ? (
        <p className="text-muted">No one has joined yet.</p>
      ) : teams ? (
        <TeamGroups players={players} teams={teams} rowProps={rowProps} />
      ) : (
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <PlayerRow key={player.id} player={player} {...rowProps} />
          ))}
        </ul>
      )}
    </section>
  );
}

type HostPlayer = HostView['players'][number];

interface RowProps {
  view: HostView;
  command: HostCommand;
  /** The remote's socket is down, so every status may be stale. */
  unknown: boolean;
}

/**
 * With teams on (F83): one group per team in index order, as on the Screen's lobby, each headed
 * by the team's colour, name, player count and score; members in join order. An empty team keeps
 * its heading. A player on no team, which the server never leaves while teams are on, still gets
 * a row under "No team" rather than vanishing.
 */
function TeamGroups({
  players,
  teams,
  rowProps,
}: {
  players: HostPlayer[];
  teams: TeamView[];
  rowProps: RowProps;
}) {
  const byId = new Map(players.map((player) => [player.id, player]));
  const grouped = new Set(teams.flatMap((team) => team.memberIds));
  const unteamed = players.filter((player) => !grouped.has(player.id));

  return (
    <div className="flex flex-col gap-4">
      {teams.map((team) => {
        const members = team.memberIds.flatMap((id) => byId.get(id) ?? []);
        const headingId = `team-${team.index}-heading`;
        return (
          <section key={team.index} aria-labelledby={headingId} className="flex flex-col gap-2">
            <h3 id={headingId} className="flex items-center gap-2 font-display text-lg">
              <span
                aria-hidden
                style={{ backgroundColor: team.color }}
                className="size-4 shrink-0 rounded-sm"
              />
              <span style={{ color: team.color }}>{team.name}</span>
              <span className="text-sm font-normal text-muted">
                {members.length} {members.length === 1 ? 'player' : 'players'}
              </span>
              <span className="ml-auto">{team.score}</span>
            </h3>
            {members.length === 0 ? (
              <p className="text-muted">No players yet</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {members.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    team={team}
                    teams={teams}
                    {...rowProps}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {unteamed.length > 0 && (
        <section aria-labelledby="team-none-heading" className="flex flex-col gap-2">
          <h3 id="team-none-heading" className="font-display text-lg text-muted">
            No team
          </h3>
          <ul className="flex flex-col gap-2">
            {unteamed.map((player) => (
              <PlayerRow key={player.id} player={player} team={null} teams={teams} {...rowProps} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * One player (HST-04). Line 1: colour, avatar, the whole name (up to two lines) with the connection
 * under it, and the score. Line 2, on the right (or on line 1 where the list is wide, HST-10): the
 * adjust buttons and a `⋯` menu holding the team
 * moves and, last and red, Kick, so Kick never sits beside a score button. A move is off outside
 * the lobby and REVEAL, where the server refuses it (`canChangeTeams`); the row moves with the next
 * snapshot.
 */
function PlayerRow({
  player,
  view,
  command,
  unknown,
  team,
  teams,
}: RowProps & { player: HostPlayer; team?: TeamView | null; teams?: TeamView[] }) {
  const { busy, run } = command;
  const step = view.question?.points ?? 0;
  // Greyed while offline or unknown; the buttons below stay full strength, since they still work.
  const dim = player.connected && !unknown ? '' : 'opacity-40';
  const moves: MenuItem[] = (teams ?? [])
    .filter((option) => option.index !== team?.index)
    .map((option) => ({
      label: `Move to ${option.name}`,
      onSelect: () => run('host:setTeam', { playerId: player.id, team: option.index }),
      disabled: busy || !view.canChangeTeams,
    }));
  const kick: MenuItem = {
    label: 'Kick',
    confirmLabel: 'Confirm kick',
    onSelect: () => run('host:kick', { playerId: player.id }),
    disabled: busy,
  };

  return (
    <li
      aria-label={player.name}
      className="flex flex-col gap-2 rounded-2xl border-2 border-edge bg-surface px-3 py-2 @xl/players:flex-row @xl/players:flex-wrap @xl/players:items-center"
    >
      <p
        className={`flex items-center gap-3 @xl/players:min-w-0 @xl/players:flex-1 @xl/players:basis-48 ${dim}`}
      >
        <span
          aria-hidden
          style={{ backgroundColor: player.color }}
          className="size-4 shrink-0 rounded-full"
        />
        <PlayerAvatar avatar={player.avatar} className="text-xl" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 font-bold break-words">{player.name}</span>
          <span className="text-sm text-muted">
            {unknown
              ? 'status unknown'
              : player.connected
                ? `online · ${Math.round(player.rttMs)} ms`
                : 'offline'}
          </span>
        </span>
        <span className="font-display text-xl">{player.score}</span>
      </p>
      {/* On one line, the buttons join the row itself, so Custom's field still takes a line below. */}
      <div className="flex flex-wrap items-center justify-end gap-2 @xl/players:contents">
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
        <OverflowMenu
          label={`More for ${player.name}`}
          trigger={<span aria-hidden>⋯</span>}
          triggerClassName={`${BUTTON_ICON} bg-bg font-bold`}
          items={[...moves, kick]}
        />
      </div>
    </li>
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
        // Its own line, under the row's buttons.
        <span className="order-last flex w-full items-center gap-2">
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

import { useRef } from 'react';
import type { Phase, RankedPlayer, TeamView } from '../../../shared/types.js';
import { teamsByRank } from '../lib/teams.js';
import { useFlip } from '../lib/useFlip.js';
import { PlayerAvatar } from './PlayerAvatar.js';
import { useCopy } from '../lib/copy.js';

/** How many players the rail lists. */
export const STANDINGS_TOP = 5;
/** With teams on, the teams come first and fewer players fit above the host bar at 1080p (F82). */
export const STANDINGS_TOP_WITH_TEAMS = 3;

/** The question phases that show the rail; the lobby, the scoreboard and the Final screen rank everyone. */
const STANDINGS_PHASES: readonly Phase[] = ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL'];

interface StandingsRailProps {
  phase: Phase;
  /** Ranked, best first, as the Screen view sends them. */
  players: RankedPlayer[];
  /** `RoomSettings.showStandings`. */
  show: boolean;
  /** With teams on, every team in index order: listed by rank above the players (F82). */
  teams?: TeamView[] | null;
}

/**
 * The top 5 along the Screen's right edge during a question (UI spec, Screen view: Question); with
 * teams on, every team by rank, then the top 3 players (F82). It
 * takes its own column beside the question, so it never covers the card, and only at 1280×720 and
 * up, where the card keeps room beside it. Rows slide when the order changes.
 */
export function StandingsRail({ phase, players, show, teams = null }: StandingsRailProps) {
  const list = useRef<HTMLOListElement>(null);
  const teamList = useRef<HTMLOListElement>(null);
  const top = players.slice(0, teams ? STANDINGS_TOP_WITH_TEAMS : STANDINGS_TOP);
  const ranked = teams ? teamsByRank(teams) : [];
  useFlip(list, top.map((p) => p.id).join(','));
  useFlip(teamList, ranked.map((team) => team.index).join(','));
  const t = useCopy();
  if (!show || top.length === 0 || !STANDINGS_PHASES.includes(phase)) return null;

  return (
    <aside
      aria-label="Standings"
      // Capped by height too, so an ultrawide display does not stretch it (F100).
      className="hidden w-[min(17vw,30.3vh)] shrink-0 flex-col gap-[1.6vh] [@media(min-width:1280px)_and_(min-height:720px)]:flex"
    >
      <p className="shrink-0 text-[max(var(--screen-min-label),min(1.2vw,2.1vh))] font-bold tracking-[0.25em] text-muted uppercase">
        {t('standings')}
      </p>
      {teams && (
        <>
          <ol
            ref={teamList}
            aria-label="Teams"
            className="flex shrink-0 flex-col gap-[1vh] text-[max(var(--screen-min-body),min(1.6vw,2.8vh))]"
          >
            {ranked.map((team) => (
              <li
                key={team.index}
                data-flip-key={team.index}
                style={{ borderColor: team.color }}
                className="flex items-center gap-[0.5em] rounded-[0.6em] border-2 bg-surface px-[0.6em] py-[0.4em]"
              >
                <span className="w-[1.4em] shrink-0 text-right font-display text-muted tabular-nums">
                  {team.rank}
                </span>
                <span
                  aria-hidden="true"
                  data-team-color
                  style={{ backgroundColor: team.color }}
                  className="size-[0.55em] shrink-0 rounded-full"
                />
                <span className="min-w-0 flex-1 truncate font-display">{team.name}</span>
                <span className="shrink-0 font-display tabular-nums">{team.score}</span>
              </li>
            ))}
          </ol>
          <p className="mt-[0.6vh] shrink-0 text-[max(var(--screen-min-label),min(1.2vw,2.1vh))] font-bold tracking-[0.25em] text-muted uppercase">
            {t('players')}
          </p>
        </>
      )}
      <ol
        ref={list}
        aria-label={teams ? 'Players' : undefined}
        className="flex min-h-0 flex-col gap-[1vh] text-[max(var(--screen-min-body),min(1.6vw,2.8vh))]"
      >
        {top.map((player) => (
          <li
            key={player.id}
            data-flip-key={player.id}
            className={`flex items-center gap-[0.5em] rounded-[0.6em] border-2 border-edge bg-surface px-[0.6em] py-[0.4em] ${player.connected ? '' : 'opacity-40'}`}
          >
            <span className="w-[1.4em] shrink-0 text-right font-display text-muted tabular-nums">
              {player.rank}
            </span>
            <span
              aria-hidden="true"
              data-player-color
              style={{ backgroundColor: player.color }}
              className="size-[0.55em] shrink-0 rounded-full"
            />
            <PlayerAvatar avatar={player.avatar} />
            <span className="min-w-0 flex-1 truncate font-bold">{player.name}</span>
            <span className="shrink-0 font-display tabular-nums">{player.score}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

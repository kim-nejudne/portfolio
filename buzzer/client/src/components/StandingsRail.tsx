import { useRef } from 'react';
import type { Phase, RankedPlayer, TeamView } from '../../../shared/types.js';
import { teamsByRank } from '../lib/teams.js';
import { useFlip } from '../lib/useFlip.js';
import { ColourDot } from './ColourDot.js';
import { PlayerAvatar } from './PlayerAvatar.js';
import { FLASH_MS } from './ScreenFlash.js';
import { useCopy } from '../lib/copy.js';

/** How many players the rail lists. */
export const STANDINGS_TOP = 5;
/** With teams on, the teams come first and fewer players fit above the host bar at 1080p (F82). */
export const STANDINGS_TOP_WITH_TEAMS = 3;
/** The slim rail's players, below 1280×720 (SCR-15). */
export const STANDINGS_TOP_SLIM = 3;

/**
 * Where the rail cannot show at all: portrait, or under 1024px wide (SCR-15). The rail itself
 * follows the same rule in CSS; Game setup reads it to say so beside the setting.
 */
export const RAIL_HIDDEN_QUERY = '(max-width: 63.99rem), (orientation: portrait)';

/** Rows and avatars that only the full rail shows, from 1280×720. */
const FULL_ONLY = 'hidden [@media(min-width:1280px)_and_(min-height:720px)]:flex';

/**
 * A ruled row: a hairline under it (design.md Rules). Its fill is the ground's own paper, so while
 * rows slide past each other the riser covers the row it passes instead of their text overlapping (F154).
 */
const ROW = 'items-baseline gap-[0.5em] border-b border-edge bg-bg py-[0.35em]';
/** Rank and score: Anybody 900 at 150% in tabular figures. */
const FIGURE = 'shrink-0 font-display font-black tabular-nums font-stretch-150%';
/** The rail's heads: Archivo Narrow 600 (design.md Rules). */
const HEAD =
  'shrink-0 font-outlier text-[max(var(--screen-min-label),min(1.2vw,2.1vh))] font-semibold text-muted';

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
 * takes its own column beside the question, so it never covers the card. From 1280×720 it is full;
 * on a smaller landscape display (a 1366×768 laptop under its browser bar, a 1024×768 tablet) a
 * slim rail shows the top 3 players without avatars, narrower; in portrait or under 1024px wide
 * there is no room beside the card and it hides (SCR-15). Rows slide when the order changes. A
 * ruled table under the 4px ink bar (M32).
 */
export function StandingsRail({ phase, players, show, teams = null }: StandingsRailProps) {
  const list = useRef<HTMLOListElement>(null);
  const teamList = useRef<HTMLOListElement>(null);
  const top = players.slice(0, teams ? STANDINGS_TOP_WITH_TEAMS : STANDINGS_TOP);
  const ranked = teams ? teamsByRank(teams) : [];
  // A judgement reorders the rail as the Screen flashes: the rows wait for the flash (F154).
  useFlip(list, top.map((p) => p.id).join(','), FLASH_MS);
  useFlip(teamList, ranked.map((team) => team.index).join(','), FLASH_MS);
  const t = useCopy();
  if (!show || top.length === 0 || !STANDINGS_PHASES.includes(phase)) return null;

  return (
    <aside
      aria-label="Standings"
      // Capped by height too, so an ultrawide display does not stretch it (F100).
      className="hidden w-[min(15vw,26.7vh)] shrink-0 flex-col gap-[1vh] border-t-4 border-ink pt-[0.6vh] [@media(min-width:1024px)_and_(orientation:landscape)]:flex [@media(min-width:1280px)_and_(min-height:720px)]:w-[min(17vw,30.3vh)]"
    >
      <p className={HEAD}>{t('standings')}</p>
      {teams && (
        <>
          <ol
            ref={teamList}
            aria-label="Teams"
            className="flex shrink-0 flex-col text-[max(var(--screen-min-body),min(1.6vw,2.8vh))]"
          >
            {ranked.map((team) => (
              <li key={team.index} data-flip-key={team.index} className={`flex ${ROW}`}>
                <span className={`w-[1.6em] text-right text-muted ${FIGURE}`}>{team.rank}</span>
                <ColourDot square data-team-color color={team.color} />
                <span className="min-w-0 flex-1 truncate font-semibold">{team.name}</span>
                <span className={FIGURE}>{team.score}</span>
              </li>
            ))}
          </ol>
          <p className={`mt-[0.6vh] ${HEAD}`}>{t('players')}</p>
        </>
      )}
      <ol
        ref={list}
        aria-label={teams ? 'Players' : undefined}
        className="flex min-h-0 flex-col text-[max(var(--screen-min-body),min(1.6vw,2.8vh))]"
      >
        {top.map((player, i) => (
          <li
            key={player.id}
            data-flip-key={player.id}
            // A name never truncates (F153): when it and the score do not share a line, the score
            // drops under it, on the right, and a name wider than the rail wraps.
            className={`${i < STANDINGS_TOP_SLIM ? 'flex' : FULL_ONLY} flex-wrap ${ROW} ${player.connected ? '' : 'opacity-40'}`}
          >
            <span className="flex min-w-0 flex-auto items-baseline gap-[0.5em]">
              <span className={`w-[1.6em] text-right text-muted ${FIGURE}`}>{player.rank}</span>
              <ColourDot square data-player-color color={player.color} />
              <PlayerAvatar avatar={player.avatar} className={FULL_ONLY} />
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{player.name}</span>
            </span>
            <span className={`ml-auto ${FIGURE}`}>{player.score}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

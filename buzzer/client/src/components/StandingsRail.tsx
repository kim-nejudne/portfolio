import { useRef } from 'react';
import type { Phase, RankedPlayer } from '../../../shared/types.js';
import { useFlip } from '../lib/useFlip.js';
import { PlayerAvatar } from './PlayerAvatar.js';

/** How many players the rail lists. */
export const STANDINGS_TOP = 5;

/** The question phases that show the rail; the lobby, the scoreboard and the Final screen rank everyone. */
const STANDINGS_PHASES: readonly Phase[] = ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL'];

interface StandingsRailProps {
  phase: Phase;
  /** Ranked, best first, as the Screen view sends them. */
  players: RankedPlayer[];
  /** `RoomSettings.showStandings`. */
  show: boolean;
}

/**
 * The top 5 along the Screen's right edge during a question (UI spec, Screen view: Question). It
 * takes its own column beside the question, so it never covers the card, and only at 1280×720 and
 * up, where the card keeps room beside it. Rows slide when the order changes.
 */
export function StandingsRail({ phase, players, show }: StandingsRailProps) {
  const list = useRef<HTMLOListElement>(null);
  const top = players.slice(0, STANDINGS_TOP);
  useFlip(list, top.map((p) => p.id).join(','));
  if (!show || top.length === 0 || !STANDINGS_PHASES.includes(phase)) return null;

  return (
    <aside
      aria-label="Standings"
      className="hidden w-[17vw] shrink-0 flex-col gap-[1.6vh] [@media(min-width:1280px)_and_(min-height:720px)]:flex"
    >
      <p className="shrink-0 text-[min(1.2vw,2.1vh)] font-bold tracking-[0.25em] text-muted uppercase">
        Standings
      </p>
      <ol ref={list} className="flex min-h-0 flex-col gap-[1vh] text-[min(1.6vw,2.8vh)]">
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

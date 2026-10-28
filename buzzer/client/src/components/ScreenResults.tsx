import { useEffect, useRef, useState } from 'react';
import type { RankedPlayer } from '../../../shared/types.js';
import { ordinal, podiumSteps, replayOrder, type PodiumStep } from '../lib/results.js';
import { prefersReducedMotion, useFlip } from '../lib/useFlip.js';

/** A Screen card: the phone's 20px radius and 24–28px padding, at 1280 wide. */
const SCREEN_CARD =
  'rounded-[min(1.56vw,2.8vh)] border-2 border-edge bg-surface px-[2.2vw] py-[min(2vw,3.5vh)]';

/** How long the scoreboard shows the previous standings before it reorders. */
export const REORDER_DELAY_MS = 800;

interface ScoreboardProps {
  players: RankedPlayer[];
  /** Player ids in the order the scoreboard last showed them; empty the first time. */
  lastOrder: string[];
  /** Called with the order on screen once it is the current ranking. */
  onShown: (order: string[]) => void;
}

/**
 * The scoreboard overlay (UI spec, Screen view: Scoreboard). It opens in the order it last showed,
 * then slides into the current ranking, so the audience sees who climbed. Later score changes
 * slide too. With reduced motion it opens in the current ranking.
 */
export function Scoreboard({ players, lastOrder, onShown }: ScoreboardProps) {
  const [replaying, setReplaying] = useState(() => lastOrder.length > 0 && !prefersReducedMotion());
  const shown = replaying ? replayOrder(lastOrder, players) : players;

  useEffect(() => {
    if (!replaying) return;
    const timer = setTimeout(() => setReplaying(false), REORDER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [replaying]);

  const order = shown.map((p) => p.id).join(',');
  useEffect(() => {
    if (!replaying) onShown(order.split(','));
  }, [replaying, order, onShown]);

  return (
    <section
      aria-label="Scoreboard"
      className="absolute inset-0 flex flex-col bg-bg px-[3.75vw] pt-[1vh] pb-[3vh]"
    >
      <div className={`${SCREEN_CARD} flex min-h-0 flex-1 flex-col gap-[3vh]`}>
        <h2 className="shrink-0 font-display text-[min(3vw,5.3vh)] text-accent">Scoreboard</h2>
        {/* The host can show it in the lobby, or after kicking everyone. */}
        {shown.length === 0 ? (
          <p className="text-[min(3vw,5.5vh)] text-muted">No players yet</p>
        ) : (
          <RankingList players={shown} />
        )}
      </div>
    </section>
  );
}

/** The Final screen: a top-3 podium, then everyone's rank and score (UI spec, Screen view: Final). */
export function FinalResults({ players }: { players: RankedPlayer[] }) {
  if (players.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <h1 className="font-display text-[5vw] text-muted">Game over</h1>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 gap-[3vw] px-[3.75vw] pt-[1vh] pb-[3vh]">
      <section aria-label="Podium" className="flex min-w-0 flex-[3] flex-col gap-[3vh]">
        <h1 className="shrink-0 font-display text-[min(4.4vw,9vh)] text-accent [text-shadow:0.3vw_0.3vw_0_var(--color-bg-deep)]">
          Final results
        </h1>
        <ol className="flex min-h-0 flex-1 items-end justify-center gap-[1.5vw]">
          {podiumSteps(players).map((step) => (
            <Step key={step.rank} step={step} />
          ))}
        </ol>
      </section>
      <section
        aria-label="Full ranking"
        className={`${SCREEN_CARD} flex min-w-0 flex-[2] flex-col gap-[2vh]`}
      >
        <h2 className="shrink-0 font-display text-[min(2vw,3.6vh)] text-accent">Full ranking</h2>
        <RankingList players={players} />
      </section>
    </div>
  );
}

/** Step heights, top step first. Full class strings, so Tailwind can see them. */
const STEP_HEIGHT = ['h-[30vh]', 'h-[21vh]', 'h-[14vh]'] as const;

function Step({ step }: { step: PodiumStep }) {
  const names = step.players.length > 3 ? 'text-[min(1.6vw,3vh)]' : 'text-[min(2.6vw,5vh)]';
  // The winners' step is lit gold, in the stage ring; the others stand on surface.
  const top = step.rank === 1;
  return (
    <li
      aria-label={`${ordinal(step.rank)} place`}
      className="flex min-h-0 max-w-[16vw] min-w-0 flex-1 flex-col items-stretch justify-end gap-[1vh]"
    >
      <ul className="flex min-h-0 flex-col gap-[0.8vh] overflow-hidden">
        {step.players.map((player) => (
          <li
            key={player.id}
            style={{ backgroundColor: player.color }}
            className={`truncate rounded-[1.5vh] px-[1vw] py-[0.6vh] text-center font-display text-bg ${names}`}
          >
            {player.name}
          </li>
        ))}
      </ul>
      <div
        data-winner={top || undefined}
        className={`flex shrink-0 flex-col items-center justify-start gap-[0.5vh] rounded-t-[2vh] border-2 pt-[2vh] ${STEP_HEIGHT[step.height]} ${
          top
            ? 'border-accent bg-accent text-accent-ink shadow-[0_0_2vw_color-mix(in_oklab,var(--color-accent)_45%,transparent)]'
            : 'border-edge bg-surface'
        }`}
      >
        <span className="font-display text-[min(4vw,8vh)] leading-none">{ordinal(step.rank)}</span>
        <span
          className={`font-display text-[min(2vw,4vh)] tabular-nums ${top ? 'text-accent-ink' : 'text-muted'}`}
        >
          {step.players[0]!.score}
        </span>
      </div>
    </li>
  );
}

/**
 * Ranked rows of rank, name and score, filling down each column. Up to 10 players fit one
 * column; more spread over two or three, and the text shrinks to keep 50 on screen.
 */
function RankingList({ players }: { players: RankedPlayer[] }) {
  const list = useRef<HTMLOListElement>(null);
  useFlip(list, players.map((p) => p.id).join(','));
  const columns = players.length <= 10 ? 1 : players.length <= 24 ? 2 : 3;
  const rows = Math.max(Math.ceil(players.length / columns), 1);
  const text =
    players.length <= 10
      ? 'text-[min(3vw,5.5vh)]'
      : players.length <= 24
        ? 'text-[min(2vw,3.6vh)]'
        : 'text-[min(1.4vw,2.4vh)]';
  return (
    <ol
      ref={list}
      style={{ gridTemplateRows: `repeat(${rows}, minmax(0, auto))` }}
      className={`grid min-h-0 grid-flow-col content-start gap-x-[1.5vw] gap-y-[0.8vh] overflow-hidden ${text}`}
    >
      {players.map((player) => (
        <li
          key={player.id}
          data-flip-key={player.id}
          className={`flex items-center gap-[0.8em] rounded-[0.6em] bg-bg px-[0.7em] py-[0.45em] ${player.connected ? '' : 'opacity-40'}`}
        >
          <span className="w-[1.8em] shrink-0 text-right font-display text-muted tabular-nums">
            {player.rank}
          </span>
          <span
            aria-hidden="true"
            style={{ backgroundColor: player.color }}
            className="size-[0.55em] shrink-0 rounded-full"
          />
          <span className="min-w-0 flex-1 truncate font-bold">{player.name}</span>
          <span className="shrink-0 font-display tabular-nums">{player.score}</span>
        </li>
      ))}
    </ol>
  );
}

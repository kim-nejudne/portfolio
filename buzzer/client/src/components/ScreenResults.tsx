import { useEffect, useRef, useState } from 'react';
import type { RankedPlayer, SessionView } from '../../../shared/types.js';
import { PlayerAvatar } from './PlayerAvatar.js';
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
          <RankingList rows={shown} />
        )}
      </div>
    </section>
  );
}

/**
 * The Final screen: a top-3 podium, then everyone's rank and score (UI spec, Screen view: Final).
 * From game 2, a Tonight card beside the ranking lists the night's totals (F77).
 */
export function FinalResults({
  players,
  session = null,
}: {
  players: RankedPlayer[];
  session?: SessionView | null;
}) {
  if (players.length === 0 && !session?.totals.length) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <h1 className="font-display text-[5vw] text-muted">Game over</h1>
      </div>
    );
  }
  const tonight = session && session.totals.length > 0 ? session.totals : null;
  // Beside the Tonight card, a long ranking keeps the width its columns need (F77).
  const rankingFlex = tonight && players.length > 10 ? 'flex-[3]' : 'flex-[2]';
  return (
    <div className="flex min-h-0 flex-1 gap-[3vw] px-[3.75vw] pt-[1vh] pb-[3vh]">
      <section
        aria-label="Podium"
        className={`flex min-w-0 flex-col gap-[3vh] ${tonight ? 'flex-[2]' : 'flex-[3]'}`}
      >
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
        className={`${SCREEN_CARD} flex min-w-0 ${rankingFlex} flex-col gap-[2vh]`}
      >
        <h2 className="shrink-0 font-display text-[min(2vw,3.6vh)] text-accent">Full ranking</h2>
        <RankingList rows={players} dense={tonight !== null} />
      </section>
      {tonight && (
        <section
          aria-label="Tonight"
          className={`${SCREEN_CARD} flex min-w-0 flex-[2] flex-col gap-[2vh]`}
        >
          <h2 className="shrink-0 font-display text-[min(2vw,3.6vh)] text-accent">Tonight</h2>
          <RankingList rows={tonightRows(tonight.slice(0, TONIGHT_ROWS), players)} dense />
          {tonight.length > TONIGHT_ROWS && (
            <p className="shrink-0 text-[min(1.6vw,2.9vh)] text-muted">
              and {tonight.length - TONIGHT_ROWS} more
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/** The Tonight card lists the night's top 10: one column, legible beside the game's ranking. */
export const TONIGHT_ROWS = 10;

/** A row of a ranking list: a player's game score, or their night total. */
interface RankingRow {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  score: number;
  rank: number;
  /** Dimmed when false: disconnected, or gone from the room for a night total. */
  connected: boolean;
}

/** The night's totals as ranking rows. A player who left keeps a dimmed row, as a disconnected one does. */
function tonightRows(totals: SessionView['totals'], players: RankedPlayer[]): RankingRow[] {
  const here = new Map(players.map((p) => [p.id, p.connected]));
  return totals.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    ...(t.avatar !== undefined && { avatar: t.avatar }),
    score: t.total,
    rank: t.rank,
    connected: here.get(t.id) ?? false,
  }));
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
            <PlayerAvatar avatar={player.avatar} className="mr-[0.3em]" />
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

/** Ranking text sizes, largest first. Full class strings, so Tailwind can see them. */
const RANKING_TEXT = [
  'text-[min(3vw,5.5vh)]',
  'text-[min(2vw,3.6vh)]',
  'text-[min(1.4vw,2.4vh)]',
] as const;

/**
 * Ranked rows of rank, name and score, filling down each column. Up to 10 players fit one
 * column; more spread over two or three, and the text shrinks to keep 50 on screen. `dense`
 * never uses the largest text, for a short list in a narrower card beside the Tonight card (F77).
 */
function RankingList({ rows: players, dense = false }: { rows: RankingRow[]; dense?: boolean }) {
  const list = useRef<HTMLOListElement>(null);
  useFlip(list, players.map((p) => p.id).join(','));
  const size = players.length <= 10 ? 0 : players.length <= 24 ? 1 : 2;
  const columns = size + 1;
  const rows = Math.max(Math.ceil(players.length / columns), 1);
  const text = RANKING_TEXT[dense ? Math.max(size, 1) : size];
  return (
    <ol
      ref={list}
      // Columns that may shrink below their content, so a long name truncates instead of pushing
      // the score past the card's edge (the avatar made rows wider, F75).
      style={{
        gridTemplateRows: `repeat(${rows}, minmax(0, auto))`,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
      className={`grid min-h-0 grid-flow-col content-start gap-x-[1.5vw] gap-y-[0.8vh] overflow-hidden ${text}`}
    >
      {players.map((player) => (
        <li
          key={player.id}
          data-flip-key={player.id}
          className={`flex items-center gap-[0.6em] rounded-[0.6em] bg-bg px-[0.7em] py-[0.45em] ${player.connected ? '' : 'opacity-40'}`}
        >
          {/* Two digits fit 1.4em, as on the standings rail; the room it frees goes to the name. */}
          <span className="w-[1.4em] shrink-0 text-right font-display text-muted tabular-nums">
            {player.rank}
          </span>
          <span
            aria-hidden="true"
            style={{ backgroundColor: player.color }}
            className="size-[0.55em] shrink-0 rounded-full"
          />
          {/* The avatar sits inside the name, not in a column of its own, so it costs no extra gap. */}
          <span className="min-w-0 flex-1 truncate font-bold">
            <PlayerAvatar avatar={player.avatar} className="mr-[0.3em] text-[0.85em]" />
            {player.name}
          </span>
          <span className="shrink-0 font-display tabular-nums">{player.score}</span>
        </li>
      ))}
    </ol>
  );
}

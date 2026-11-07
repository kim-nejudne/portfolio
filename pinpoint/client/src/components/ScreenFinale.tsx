import { useEffect, useRef, useState } from 'react';
import { formatKm } from '#shared/geo.js';
import { ordinal } from '#shared/scoring.js';
import type { Award, FinalPass, FinalView, PublicPlayer, ScreenView } from '#shared/types.js';
import { SplitFlap } from './SplitFlap.js';

// Finale timings from entering FINAL (spec: Finale, [default]).
const STEP_AT: Record<number, number> = { 3: 600, 2: 1800, 1: 3000 };
const PASSES_AT = 5000;
const PASS_GAP_MS = 150;
const AWARDS_AT = 8000;
const AWARD_GAP_MS = 2500;

// Podium block heights per rank, laid out 2nd · 1st · 3rd.
const STEP_HEIGHT: Record<number, string> = { 1: 'h-[150px]', 2: 'h-[105px]', 3: 'h-[70px]' };
const STEP_ORDER = [2, 1, 3];

const num = (n: number) => n.toLocaleString('en-US');

/**
 * Milliseconds since the finale mounted, advanced only at the given moments.
 * SPEC-QUESTION: timed from the Screen's arrival in FINAL, so a refreshed Screen replays it (DECISIONS 36).
 */
function useElapsed(moments: number[]): number {
  const [elapsed, setElapsed] = useState(0);
  const mountedAt = useRef<number | null>(null);
  const key = moments.join();
  useEffect(() => {
    // A player joining or leaving mid-finale changes the moments; keep counting from the mount.
    mountedAt.current ??= Date.now();
    const since = Date.now() - mountedAt.current;
    const ids = key
      .split(',')
      .map(Number)
      .map((m) => setTimeout(() => setElapsed((e) => Math.max(e, m)), m - since));
    return () => ids.forEach(clearTimeout);
  }, [key]);
  return elapsed;
}

/** FINAL: the podium, every player's boarding pass and the travel awards, staged in that order. */
export function ScreenFinale({ view }: { view: ScreenView }) {
  const { final } = view;
  const passAt = (i: number) => PASSES_AT + i * PASS_GAP_MS;
  const awardAt = (i: number) => AWARDS_AT + i * AWARD_GAP_MS;
  const elapsed = useElapsed(
    final
      ? [
          ...final.podium.map((s) => STEP_AT[s.rank]!),
          ...final.passes.map((_, i) => passAt(i)),
          ...final.awards.map((_, i) => awardAt(i)),
        ]
      : [],
  );
  // The VIP ended the game before a round was revealed (spec: VIP controls).
  if (!final)
    return (
      <h1 className="board-face flex flex-1 items-center justify-center text-[64px] text-amber">
        No rounds played
      </h1>
    );
  const byId = new Map(view.players.map((p) => [p.id, p]));
  const playersOf = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []);
  const awards = final.awards.filter((_, i) => elapsed >= awardAt(i));
  return (
    <div className="flex min-h-0 flex-1 gap-12 px-16 pt-10 pb-6">
      <h1 className="sr-only">Final</h1>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Podium final={final} elapsed={elapsed} playersOf={playersOf} />
        <ol aria-label="Boarding passes" className="grid grid-cols-4 gap-4">
          {final.passes
            .filter((_, i) => elapsed >= passAt(i))
            .map((pass) => {
              const player = byId.get(pass.playerId);
              return player && <PassCard key={pass.playerId} pass={pass} player={player} />;
            })}
        </ol>
        {view.settings.mode === 'picture' && (
          // The live host, so it reads pinpoint.kimnejudne.dev in production.
          <p className="mt-auto text-[22px] text-text-dim">
            Photo credits: {window.location.host}/credits/{view.code}
          </p>
        )}
      </div>
      {final.awards.length > 0 && (
        <ol
          aria-label="Travel awards"
          aria-live="polite"
          className="flex w-[560px] shrink-0 flex-col gap-6"
        >
          {awards.map((a) => (
            <AwardCard key={a.id} award={a} winners={playersOf(a.playerIds)} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** The top 3 ranks; tied players stand on one step, and only occupied steps rise. */
function Podium({
  final,
  elapsed,
  playersOf,
}: {
  final: FinalView;
  elapsed: number;
  playersOf: (ids: string[]) => PublicPlayer[];
}) {
  return (
    <ol aria-label="Podium" className="flex h-[280px] shrink-0 items-end justify-center gap-4">
      {STEP_ORDER.map((rank) => {
        const step = final.podium.find((s) => s.rank === rank);
        if (!step) return null; // only held ranks get a step
        // Not risen yet: an empty slot keeps the other steps where they will stand.
        if (elapsed < STEP_AT[rank]!)
          return <li key={rank} aria-hidden="true" className="w-[320px]" />;
        return (
          <li key={rank} className="finale-in flex w-[320px] flex-col items-stretch gap-3">
            {/* shortcut: a tie of more than 3 on one step clips; widen the steps if that matters. */}
            <ul className="flex max-h-[115px] flex-col justify-end gap-1 overflow-hidden">
              {playersOf(step.playerIds).map((p) => (
                <li key={p.id} className="flex items-center justify-center gap-3">
                  <span aria-hidden="true" className="text-[36px] leading-none">
                    {p.emoji}
                  </span>
                  <span className="truncate text-[28px] font-semibold text-text">{p.name}</span>
                </li>
              ))}
            </ul>
            <div
              className={`board-face flex items-start justify-center rounded-t-card border border-b-0 border-line bg-board-panel pt-4 text-[64px] leading-none text-amber ${STEP_HEIGHT[rank]}`}
            >
              <span aria-hidden="true">{rank}</span>
              <span className="sr-only">{ordinal(rank)} place</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// shortcut: a plain pass (no notches); the BoardingPass component is F54's.
function PassCard({ pass, player }: { pass: FinalPass; player: PublicPlayer }) {
  return (
    <li
      aria-label={`${player.name}'s boarding pass`}
      className="finale-in flex min-w-0 flex-col gap-2 rounded-pass border-l-[6px] bg-pass-bg px-4 py-3 text-pass-text"
      style={{ borderLeftColor: player.color }}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-[32px] leading-none">
          {player.emoji}
        </span>
        <span className="min-w-0 flex-1 truncate text-[26px] font-bold">{player.name}</span>
      </div>
      <div className="board-face flex items-baseline justify-between gap-3 border-t border-dashed border-line pt-2 leading-none">
        <span className="text-[32px]">{ordinal(pass.rank)}</span>
        <span className="text-[28px]">{num(pass.total)}</span>
      </div>
      {pass.bestRound && (
        <p className="board-face line-clamp-2 text-[22px] leading-tight">{pass.bestRound}</p>
      )}
      {pass.avgKm !== null && (
        <p className="board-face text-[22px] leading-tight">Avg {formatKm(pass.avgKm)}</p>
      )}
    </li>
  );
}

function AwardCard({ award, winners }: { award: Award; winners: PublicPlayer[] }) {
  return (
    <li className="finale-in flex flex-col gap-3 rounded-card border border-line bg-board-panel p-6">
      <SplitFlap
        text={award.title.toUpperCase()}
        label={award.title}
        cellClass="h-[48px] w-[32px] rounded-flap-screen text-[30px]"
      />
      <p className="flex flex-wrap gap-x-4 text-[28px] font-semibold text-text">
        {winners.map((p) => (
          <span key={p.id}>
            <span aria-hidden="true">{p.emoji}</span> {p.name}
          </span>
        ))}
      </p>
      <p className="text-[24px] text-text-dim">{award.stat}</p>
    </li>
  );
}

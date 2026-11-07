import { FINAL_CALL_MS } from '#shared/constants.js';
import { closestIds, competitionRanks } from '#shared/scoring.js';
import type { PublicPlayer, RoundResult, ScreenView } from '#shared/types.js';
import { flapRows, formatKm, formatMovement, gateLabel, multiplierRow } from '../lib/format.js';
import { useServerNow } from '../lib/useServerNow.js';
import { Photo } from './Photo.js';
import { PlayerTile } from './PlayerTile.js';
import { RevealMap } from './RevealMap.js';
import { SplitFlap } from './SplitFlap.js';

type Round = NonNullable<ScreenView['round']>;
type Reveal = NonNullable<ScreenView['reveal']>;

const num = (n: number) => n.toLocaleString('en-US');

/** A name in 22-cell flap rows, read once as a whole. */
function FlapRows({
  text,
  className,
  cellClass,
}: {
  text: string;
  className: string;
  cellClass: string;
}) {
  return (
    <div role="img" aria-label={text} className={`flex flex-col ${className}`}>
      {flapRows(text).map((row, i) => (
        <span key={i} aria-hidden="true" data-row={row}>
          <SplitFlap text={row} cellClass={cellClass} />
        </span>
      ))}
    </div>
  );
}

/** The gate label's flaps beside the timer: 40 px glyphs. */
const GATE_CELL = 'h-[64px] w-[44px] rounded-flap-screen text-[40px]';

/** INTRO: the gate label flapping in large at the centre, and the multiplier row on a boosted round. */
export function ScreenIntro({ round }: { round: Round }) {
  const boost = multiplierRow(round.multiplier);
  return (
    <div className="m-auto flex flex-col items-center gap-10 text-center">
      <h1>
        {/* 48 px cells: "Round 10/10 · ×1.5 · Now boarding" (33 cells) fits 1920. */}
        <SplitFlap
          text={gateLabel(round, 'nowBoarding')}
          cellClass="h-[76px] w-[48px] rounded-flap-screen text-[56px]"
        />
      </h1>
      {boost && <SplitFlap text={boost} tone="text" cellClass={GATE_CELL} />}
    </div>
  );
}

/** The board-style card in place of a photo that failed to load (spec: Provider outages). */
function PhotoUnavailable({ cellClass }: { cellClass: string }) {
  return (
    <div className="flex size-full items-center justify-center bg-board-panel">
      <SplitFlap text="PHOTO UNAVAILABLE" label="Photo unavailable" cellClass={cellClass} />
    </div>
  );
}

/**
 * GUESSING: the gate label top left, the timer top right from `endsAt` on the server's clock, the
 * prompt, and the player tiles along the bottom. No map. Name mode shows the display name in prompt
 * flaps; Picture mode the photo contained in 1500 × 820 with its credit, the gate label and timer
 * in the margins beside it and compact tiles, so all of it fits 1080 (DECISIONS 57).
 */
export function ScreenGuessing({
  view,
  round,
}: {
  view: Pick<ScreenView, 'players' | 'paused'>;
  round: Round;
}) {
  const now = useServerNow();
  // Paused, the clock stops at the pause: `endsAt` moves forward by the pause on resume.
  const at = view.paused?.since ?? now;
  const leftMs = round.endsAt === null ? null : Math.max(0, round.endsAt - at);
  const finalCall = round.gate === 'boarding' && leftMs !== null && leftMs <= FINAL_CALL_MS;
  const state = finalCall ? 'finalCall' : round.gate;
  const red = state === 'finalCall' || state === 'delayed';
  const label = gateLabel(round, state);
  const timer = leftMs !== null && (
    <p
      role="timer"
      className={`board-face text-[120px] leading-none ${finalCall ? 'text-delayed' : 'text-amber'}`}
    >
      {Math.ceil(leftMs / 1000)}
    </p>
  );
  const tiles = (compact: boolean) => (
    <ul
      aria-label="Players"
      className={`flex flex-wrap justify-center ${compact ? 'gap-x-4' : 'gap-x-8 gap-y-6'}`}
    >
      {view.players.map((p) => (
        <PlayerTile
          key={p.id}
          player={p}
          lockedIn={round.lockedIn.includes(p.id)}
          compact={compact}
        />
      ))}
    </ul>
  );
  const { prompt } = round;

  // SPEC-QUESTION: DECISIONS 57 (the Picture layout fitting 1080)
  if (prompt.kind === 'picture')
    return (
      <div className="flex flex-1 flex-col justify-between pt-6 pb-2">
        <div className="flex items-start justify-between">
          {/* Each part on its own row of small flaps, to fit the margin beside the photo. */}
          {/* SPEC-QUESTION: DECISIONS 61 (24 px gate flaps in Picture mode) */}
          <div role="img" aria-label={label} className="flex w-[210px] flex-col gap-2 pl-2">
            {label.split(' · ').map((part, i) => (
              <span key={i} aria-hidden="true">
                <SplitFlap
                  text={part}
                  tone={red ? 'delayed' : 'amber'}
                  gap="gap-0.5"
                  cellClass="h-[34px] w-[16px] rounded-flap-screen text-[24px]"
                />
              </span>
            ))}
          </div>
          <figure className="flex w-[1500px] flex-col gap-1">
            <div className="flex h-[820px] items-center justify-center border-2 border-line">
              <Photo
                src={prompt.photoUrl}
                alt="The photo to find"
                className="size-full object-contain"
                fallback={
                  <PhotoUnavailable cellClass="h-[104px] w-[72px] rounded-flap-screen text-[64px]" />
                }
              />
            </div>
            <figcaption className="text-[22px] text-text-dim">{prompt.credit}</figcaption>
          </figure>
          <div className="flex w-[210px] justify-center">{timer}</div>
        </div>
        {tiles(true)}
      </div>
    );

  return (
    <div className="flex flex-1 flex-col px-16 pt-12 pb-8">
      <div className="flex items-start justify-between">
        <SplitFlap text={label} tone={red ? 'delayed' : 'amber'} cellClass={GATE_CELL} />
        {timer}
      </div>
      <div className="m-auto flex flex-col items-center gap-6">
        <div
          role="img"
          aria-label={prompt.displayName}
          className="flex flex-col items-center gap-6"
        >
          {flapRows(prompt.displayName).map((row, i) => (
            <SplitFlap
              key={i}
              text={row}
              cellClass="h-[104px] w-[72px] rounded-flap-screen text-[64px]"
            />
          ))}
        </div>
      </div>
      {tiles(false)}
    </div>
  );
}

/** The rows the rail shows: the first `revealedCount`, then the missed ones once every scored row is in (DECISIONS 26). */
export function railRows(reveal: Reveal): RoundResult[] {
  const scored = reveal.results.filter((r) => r.distanceKm !== null);
  const rows = scored.slice(0, reveal.revealedCount);
  const allIn = reveal.revealStage !== 'pins' && rows.length === scored.length;
  return allIn ? reveal.results : rows;
}

/** REVEAL: the band with the name and fact, the map on the left and the rail on the right. */
export function ScreenReveal({ view, reveal }: { view: ScreenView; reveal: Reveal }) {
  const { place } = reveal;
  const landed = reveal.revealStage !== 'pins';
  const scored = reveal.results.filter((r) => r.distanceKm !== null);
  const ranks = competitionRanks(scored.map((r) => -(r.distanceKm ?? 0)));
  const rankOf = new Map(scored.map((r, i) => [r.playerId, ranks[i]!]));
  const closest = closestIds(reveal.results);
  const byId = new Map(view.players.map((p) => [p.id, p]));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-col justify-center gap-3 px-16 py-4">
        {landed ? (
          <div className="flex items-center gap-8">
            {place.photoUrl && (
              <div className="flex h-[180px] w-[240px] shrink-0 items-center justify-center">
                <Photo
                  src={`${place.photoUrl}/thumb`}
                  alt={`Photo of ${place.name}`}
                  className="max-h-full max-w-full object-contain"
                  fallback={
                    <p className="board-face flex size-full items-center justify-center border-2 border-line bg-board-panel text-center text-[22px] text-amber">
                      Photo unavailable
                    </p>
                  }
                />
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-3">
              <FlapRows
                text={place.displayName}
                className="gap-2"
                cellClass="h-[64px] w-[44px] rounded-flap-screen text-[40px]"
              />
              <p className="line-clamp-2 text-[32px] leading-tight text-text">{place.fact}</p>
              {place.credit && <p className="text-[22px] text-text-dim">{place.credit}</p>}
            </div>
          </div>
        ) : (
          view.round && (
            <p className="board-face text-[40px] text-amber">
              Round {view.round.number}/{view.round.total}
            </p>
          )
        )}
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[1340px] shrink-0">
          <RevealMap
            target={place.position}
            results={reveal.results}
            players={view.players}
            revealStage={reveal.revealStage}
            revealedCount={reveal.revealedCount}
          />
        </div>
        <ol aria-label="Results" className="flex w-[580px] flex-col overflow-hidden bg-board-panel">
          {railRows(reveal).map((r) => {
            const player = byId.get(r.playerId);
            return (
              player && (
                <RailRow
                  key={r.playerId}
                  result={r}
                  player={player}
                  rank={rankOf.get(r.playerId) ?? null}
                  closest={closest.includes(r.playerId)}
                />
              )
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Tag({ children, tone }: { children: string; tone: 'amber' | 'dim' }) {
  return (
    <span
      className={`board-face rounded-button border-2 px-2 py-0.5 text-[22px] leading-none ${tone === 'amber' ? 'border-amber text-amber' : 'border-text-dim text-text-dim'}`}
    >
      {children}
    </span>
  );
}

function RailRow({
  result: r,
  player,
  rank,
  closest,
}: {
  result: RoundResult;
  player: PublicPlayer;
  rank: number | null;
  closest: boolean;
}) {
  const missed = r.distanceKm === null;
  return (
    // 72 px, shrinking to 64 px so 12 rows fit under a two-row name.
    <li className="flex h-[72px] min-h-16 shrink items-center gap-3 border-b border-line px-4">
      <span className="board-face flex size-10 shrink-0 items-center justify-center rounded-button bg-board-bg text-[24px] text-text">
        {rank ?? ''}
      </span>
      <span aria-hidden="true" className="text-[36px]">
        {player.emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[28px] font-semibold text-text">{player.name}</span>
        {(r.bullseye || closest || (!missed && !r.lockedIn)) && (
          <span className="flex gap-2">
            {r.bullseye && <Tag tone="amber">Bullseye</Tag>}
            {closest && <Tag tone="dim">Closest</Tag>}
            {!missed && !r.lockedIn && <Tag tone="dim">Not locked in</Tag>}
          </span>
        )}
      </span>
      <span className="board-face flex shrink-0 flex-col items-end text-[32px] leading-none">
        {r.distanceKm === null ? (
          <span className="text-text-dim">—</span>
        ) : (
          <>
            <span className="text-text">{formatKm(r.distanceKm)}</span>
            <span className="text-amber">
              {r.multiplier > 1 ? `×${r.multiplier} → ${num(r.points)}` : `+${num(r.points)}`}
            </span>
          </>
        )}
      </span>
    </li>
  );
}

/** SCOREBOARD: the departures board of standings. */
export function ScreenStandings({ view }: { view: ScreenView }) {
  const byId = new Map(view.players.map((p) => [p.id, p]));
  return (
    <div className="flex flex-1 flex-col gap-6 px-16 pt-12 pb-8">
      <h1 className="board-face text-[40px] text-amber">
        {view.round && `Round ${view.round.number}/${view.round.total} · Standings`}
      </h1>
      <ol aria-label="Standings" className="flex flex-col">
        {(view.standings ?? []).map((s) => {
          const p = byId.get(s.playerId);
          if (!p) return null;
          return (
            <li
              key={s.playerId}
              className={`board-face flex h-16 items-center gap-6 border-b border-line text-[36px] leading-none ${p.connected ? '' : 'opacity-40 grayscale'}`}
            >
              <span className="w-16 text-text">{s.rank}</span>
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-button border-2 text-[32px]"
                style={{ borderColor: p.color }}
              >
                {p.emoji}
              </span>
              <span className="flex flex-1 items-center gap-4">
                <SplitFlap
                  text={p.name}
                  tone="text"
                  cellClass="h-[56px] w-[40px] rounded-flap-screen text-[36px]"
                />
                {p.isVip && (
                  <span role="img" aria-label="VIP" className="text-amber">
                    ★
                  </span>
                )}
                {!p.connected && <span className="sr-only">(disconnected)</span>}
              </span>
              <span className="w-48 text-right text-amber">+{num(s.roundPoints)}</span>
              <span className="w-48 text-right text-text">{num(s.total)}</span>
              <span
                className={`w-24 text-right ${s.movement < 0 ? 'text-delayed' : 'text-on-time'}`}
              >
                {formatMovement(s.movement)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

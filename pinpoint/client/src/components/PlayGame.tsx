import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FINAL_CALL_MS, WORLD_ID } from '#shared/constants.js';
import { clampBounds } from '#shared/geo.js';
import { ordinal } from '#shared/scoring.js';
import type { Box, LatLng, MyResult, PausedView, PlayerView, PublicPlayer } from '#shared/types.js';
import { formatKm, gateLabel, multiplierRow } from '../lib/format.js';
import type { GameSocket } from '../lib/socket.js';
import { useLeafletMap } from '../lib/useLeafletMap.js';
import { useServerNow } from '../lib/useServerNow.js';
import { MapView } from './MapView.js';
import { PausedOverlay } from './PausedOverlay.js';
import { pinIcon } from './RevealMap.js';

type Round = NonNullable<PlayerView['round']>;

const num = (n: number) => n.toLocaleString('en-US');

// shortcut: plain passes (no notches, tear line, stripe or flip); BoardingPass and the flip are F54's.
const PASS = 'flex w-full flex-col gap-3 rounded-pass bg-pass-bg p-5 text-pass-text';

/** The phone's paused text (spec: Pausing); none during the 3-2-1. */
export function pausedMessage(paused: PausedView): string | null {
  if (paused.reasons.includes('vip')) return 'Delayed · the VIP paused the round';
  return paused.reasons.includes('screenAway') ? 'Waiting for the Screen…' : null;
}

/**
 * The phone from INTRO to FINAL (spec: Player view, items 3–9), with the paused overlay over
 * everything under the top bar, so the VIP's ★ button stays in reach.
 */
export function PlayGame({ view, socket }: { view: PlayerView; socket: GameSocket | null }) {
  const rematchAt = view.phase === 'FINAL' ? view.rematchAt : null;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Inert while covered, so focus and keys can't reach the map or cards under it. */}
      <div
        inert={view.paused !== null || rematchAt !== null}
        className="flex min-h-0 flex-1 flex-col"
      >
        <PlayPhase view={view} socket={socket} />
      </div>
      {view.paused && (
        <PausedOverlay
          countdownAt={view.paused.resumeAt}
          message={pausedMessage(view.paused)}
          cellClass="h-[240px] w-[160px] rounded-flap-phone text-[200px]"
        />
      )}
      {rematchAt !== null && (
        <PausedOverlay
          countdownAt={rematchAt}
          message={null}
          label="Rematch in"
          cellClass="h-[240px] w-[160px] rounded-flap-phone text-[200px]"
        />
      )}
    </div>
  );
}

/** Keeps the zoom a player locked in at, so the locked-in card's mini map can show it. */
function PlayPhase({ view, socket }: { view: PlayerView; socket: GameSocket | null }) {
  const [locked, setLocked] = useState<{ round: number; zoom: number } | null>(null);
  const { phase, round, me } = view;

  if (phase === 'FINAL') return <FinalCard view={view} />;
  if (me.waiting || !round) return <WaitingCard round={round} />;
  if (phase === 'INTRO' || phase === 'GUESSING') {
    if (round.myLock) {
      const zoom = locked?.round === round.number ? locked.zoom : null;
      return <LockedCard view={view} round={round} lock={round.myLock} zoom={zoom} />;
    }
    return (
      <RoundMap
        // One map per round, kept from INTRO into GUESSING so its tiles are already loaded.
        key={round.number}
        view={view}
        round={round}
        socket={socket}
        onLocked={(zoom) => setLocked({ round: round.number, zoom })}
      />
    );
  }
  return <ResultCard view={view} round={round} />;
}

/**
 * Whole seconds left from `endsAt` on the server's clock, stopped at `pausedSince` while paused;
 * red in the last 5 s unless `plain`.
 */
function Timer({
  endsAt,
  pausedSince,
  plain = false,
}: {
  endsAt: number | null;
  pausedSince: number | undefined;
  plain?: boolean;
}) {
  const now = useServerNow();
  if (endsAt === null) return null;
  const leftMs = Math.max(0, endsAt - (pausedSince ?? now));
  const colour = plain ? '' : leftMs <= FINAL_CALL_MS ? 'text-delayed' : 'text-amber';
  return (
    <p role="timer" className={`board-face shrink-0 text-2xl ${colour}`}>
      {Math.ceil(leftMs / 1000)}
    </p>
  );
}

/** INTRO and GUESSING: the prompt bar, the map clamped to the padded box, the crosshair and Lock in. */
function RoundMap({
  view,
  round,
  socket,
  onLocked,
}: {
  view: PlayerView;
  round: Round;
  socket: GameSocket | null;
  onLocked: (zoom: number) => void;
}) {
  const intro = view.phase === 'INTRO';
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = view.region?.box;
  if (!box) return null; // the view carries the region from INTRO on
  const world = view.settings.categoryId === WORLD_ID;
  const boost = multiplierRow(round.multiplier);

  function lockIn(centre: LatLng, zoom: number) {
    if (sending || !socket) return;
    setSending(true);
    setError(null);
    // Final: there is no unlock. The view's `myLock` then swaps this map for the locked-in card.
    socket.emit('player:lockIn', centre, (res) => {
      if (res.ok) return onLocked(zoom);
      setSending(false);
      setError(res.error);
    });
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-12 items-center gap-3 border-b border-line bg-board-panel px-4 py-1">
        {intro ? (
          <p className="board-face text-lg text-amber">{gateLabel(round, 'nowBoarding')}</p>
        ) : (
          <>
            <Prompt prompt={round.prompt} />
            <Timer endsAt={round.endsAt} pausedSince={view.paused?.since} />
          </>
        )}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div inert={intro} className="flex min-h-0 flex-1 flex-col">
          <MapView
            box={box}
            // The World's padded box is wider than the world and taller than Mercator's limit.
            maxBounds={world ? undefined : clampBounds(box)}
            worldCopyJump={world}
            initialCentre={round.myAim}
            onAim={intro ? undefined : (centre) => socket?.emit('player:aim', centre, () => {})}
            onLockIn={lockIn}
            lockDisabled={intro || sending || !socket || view.paused !== null}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="absolute inset-x-4 top-2 z-[600] rounded-button border border-delayed bg-board-panel px-4 py-2 text-delayed"
          >
            {error}
          </p>
        )}
        {intro && (
          <div className="absolute inset-x-4 top-1/2 z-[600] flex -translate-y-1/2 flex-col items-center gap-3 rounded-card border border-line bg-board-bg/85 px-4 py-6 text-center">
            <h1 className="board-face text-4xl text-amber">
              Round {round.number} of {round.total}
            </h1>
            {boost && <p className="board-face text-2xl text-text">{boost}</p>}
          </div>
        )}
      </div>
    </main>
  );
}

function Prompt({ prompt }: { prompt: Round['prompt'] }) {
  if (prompt.kind === 'name') {
    // shortcut: wraps at 20 px; F57 shrinks it to 14 px first.
    return (
      <h1 className="board-face min-w-0 flex-1 text-xl leading-tight break-words text-amber">
        {prompt.displayName}
      </h1>
    );
  }
  return <PicturePrompt prompt={prompt} />;
}

/**
 * The 72 × 48 thumbnail; a tap opens the photo full screen. A thumbnail that fails to load (the
 * file is gone mid-game) leaves the board-style "Photo unavailable" card in its place.
 */
function PicturePrompt({ prompt }: { prompt: Extract<Round['prompt'], { kind: 'picture' }> }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  if (failed === prompt.thumbUrl)
    return (
      <p className="board-face min-w-0 flex-1 text-[20px] text-amber">
        <span className="rounded-button bg-flap-bg px-2 py-1">Photo unavailable</span>
      </p>
    );
  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        ref={button}
        aria-label="Open the photo"
        onClick={() => setOpen(true)}
        className="block h-12 w-[72px] rounded-button bg-board-bg active:scale-[0.96]"
      >
        <img
          src={prompt.thumbUrl}
          alt=""
          onError={() => setFailed(prompt.thumbUrl)}
          className="size-full object-contain"
        />
      </button>
      {open && (
        <PhotoViewer
          src={prompt.photoUrl}
          credit={prompt.credit}
          onClose={() => {
            setOpen(false);
            button.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/**
 * The photo full screen, with pinch zoom and a close button. Leaflet (already in the phone bundle)
 * does the zooming and panning on a plain pixel CRS: no tiles, so no map attribution, the credit
 * line instead. Zoom runs from the whole photo to 8× it.
 */
function PhotoViewer({
  src,
  credit,
  onClose,
}: {
  src: string;
  credit: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const map = L.map(ref.current!, {
      crs: L.CRS.Simple,
      minZoom: -5, // without tile layers Leaflet's floor is 0 (1:1), too close to fit the photo
      zoomSnap: 0,
      attributionControl: false,
      zoomControl: false,
    }).setView([0, 0], 0);
    const overlay = L.imageOverlay(src, [
      [0, 0],
      [1, 1],
    ]).addTo(map);
    overlay.on('error', () => setFailed(true));
    overlay.on('load', () => {
      const img = overlay.getElement()!;
      const bounds = L.latLngBounds([0, 0], [img.naturalHeight, img.naturalWidth]);
      overlay.setBounds(bounds);
      map.fitBounds(bounds, { animate: false });
      map
        .setMinZoom(map.getZoom())
        .setMaxZoom(map.getZoom() + 3)
        .setMaxBounds(bounds);
    });
    return () => {
      overlay.off(); // a load landing after Close would fit a removed map
      map.remove();
    };
  }, [src]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The photo"
      // Under the paused overlay (1100) and the VIP drawer (1150), over the top bar.
      className="fixed inset-0 z-[1050] flex flex-col bg-board-bg"
    >
      <div className="relative min-h-0 flex-1 touch-none select-none [-webkit-touch-callout:none]">
        <div ref={ref} className="photo-viewer absolute inset-0" />
        {failed && (
          <p className="board-face absolute inset-x-4 top-1/2 z-[500] -translate-y-1/2 rounded-card bg-flap-bg px-4 py-6 text-center text-2xl text-amber">
            Photo unavailable
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <p className="min-w-0 flex-1 text-sm text-text-dim">{credit}</p>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="min-h-12 shrink-0 rounded-button border border-line px-6 font-semibold text-text active:scale-[0.96]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/** GUESSING after Lock in: the timer, who is still guessing, and the player's pin, frozen. */
function LockedCard({
  view,
  round,
  lock,
  zoom,
}: {
  view: PlayerView;
  round: Round;
  lock: LatLng;
  zoom: number | null;
}) {
  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <section aria-label="Boarding pass" className={PASS}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="board-face text-xl">Boarding · Locked in</h1>
          <Timer endsAt={round.endsAt} pausedSince={view.paused?.since} plain />
        </div>
        <p>
          {round.stillGuessing.length > 0 ? (
            <>
              Still guessing: <span className="text-2xl">{round.stillGuessing.join(' ')}</span>
            </>
          ) : (
            'Everyone has locked in'
          )}
        </p>
        {view.region && <MiniMap box={view.region.box} lock={lock} zoom={zoom} me={view.me} />}
      </section>
    </main>
  );
}

/** The player's pin on a 180 px non-interactive map, at the zoom they locked in at (else the box's). */
function MiniMap({
  box,
  lock,
  zoom,
  me,
}: {
  box: Box;
  lock: LatLng;
  zoom: number | null;
  me: Pick<PublicPlayer, 'color' | 'emoji'>;
}) {
  const { ref, map, layer } = useLeafletMap({ box, interactive: false });
  useEffect(() => {
    if (!map) return;
    map.setView([lock.lat, lock.lng], zoom ?? map.getZoom(), { animate: false });
    const pin = L.marker([lock.lat, lock.lng], {
      icon: pinIcon({ color: me.color, emoji: me.emoji }, 32),
      interactive: false,
      keyboard: false,
    }).addTo(map);
    return () => void pin.remove();
  }, [map, lock.lat, lock.lng, zoom, me.color, me.emoji]);

  return (
    <div className="relative h-[180px] overflow-hidden rounded-button">
      <div
        ref={ref}
        role="img"
        aria-label="Your pin"
        className="absolute inset-0"
        // Inline: leaflet.css is unlayered and would beat a Tailwind utility.
        style={{ background: 'var(--board-bg)' }}
      />
      {layer && (
        <p className="pointer-events-none absolute right-0 bottom-0 z-[500] rounded-tl-button bg-board-bg/80 px-2 py-0.5 text-[11px] text-text-dim">
          {layer.attribution}
        </p>
      )}
    </div>
  );
}

/**
 * REVEAL and SCOREBOARD: face down until the view carries the player's own row (the Screen has
 * reached them), then their result; on the scoreboard the rank and the next round.
 */
function ResultCard({ view, round }: { view: PlayerView; round: Round }) {
  const result = view.myResult;
  const scoreboard = view.phase === 'SCOREBOARD';
  let card: ReactNode;
  if (result?.distanceKm != null) card = <ResultPass view={view} result={result} />;
  else if (result || scoreboard) card = <Missed />;
  else card = <FaceDown />;
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-6">
      {card}
      {scoreboard && (
        <p className="board-face text-xl text-amber">
          Next: Round {round.number + 1} of {round.total}
        </p>
      )}
    </main>
  );
}

function FaceDown() {
  return (
    <div
      role="status"
      aria-label="Your result is coming"
      className="flex h-64 w-full items-center justify-center rounded-pass border border-line bg-board-panel"
    >
      <p aria-hidden="true" className="board-face text-3xl tracking-[0.3em] text-text-dim">
        Pinpoint
      </p>
    </div>
  );
}

function Missed() {
  return (
    <section aria-label="Your result" className={PASS}>
      <h1 className="board-face text-xl">Missed this round · 0</h1>
    </section>
  );
}

function Stamp({ children }: { children: string }) {
  return (
    <span className="board-face inline-block -rotate-8 rounded-button border-2 px-2 py-0.5 text-sm">
      {children}
    </span>
  );
}

function ResultPass({ view, result }: { view: PlayerView; result: MyResult }) {
  const { me } = view;
  // SPEC-QUESTION: the rank after a round depends on rows the Screen has not shown yet, so it
  // waits for the scoreboard (DECISIONS 27).
  const scoreboard = view.phase === 'SCOREBOARD';
  const rows: [string, string][] = [
    ['Distance', formatKm(result.distanceKm!)],
    ['Base points', num(result.basePoints)],
    ...(result.multiplier > 1 ? [['Multiplier', `×${result.multiplier}`] as [string, string]] : []),
    ['Round', `+${num(result.points)}`],
    ['Total', num(result.totalAfter)],
    ...(scoreboard
      ? [['Rank', `${ordinal(me.rank)} of ${view.playerCount}`] as [string, string]]
      : []),
  ];
  return (
    <section aria-label="Your result" className={PASS}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl">
          {me.emoji}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{me.name}</h1>
        {result.bullseye && <Stamp>Bullseye</Stamp>}
        {result.closest && <Stamp>Closest</Stamp>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-dashed border-line pt-3">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-pass-text/70">{label}</dt>
            <dd className="board-face text-right text-lg">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Joined mid-game: in from the next round's INTRO. */
function WaitingCard({ round }: { round: Round | null }) {
  const next = round ? round.number + 1 : null;
  const from =
    next !== null && round && next <= round.total
      ? `You're in from round ${next}.`
      : "You're in from the next game.";
  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <section aria-label="Boarding pass" className={PASS}>
        <h1 className="board-face text-xl">Next departure</h1>
        <p>{from} You start at 0.</p>
      </section>
    </main>
  );
}

/** FINAL: the player's own finale pass and their awards (spec: Player view, item 9). */
function FinalCard({ view }: { view: PlayerView }) {
  const { me, final } = view;
  if (!final)
    return (
      <main className="flex flex-1 flex-col px-4 py-6">
        <section aria-label="Your standing" className={PASS}>
          <h1 className="board-face text-xl">Final</h1>
          <p className="board-face text-3xl">No rounds played</p>
        </section>
      </main>
    );
  const { pass, awards } = final;
  return (
    <main className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
      <section
        aria-label="Your boarding pass"
        className={`${PASS} border-l-[6px]`}
        style={{ borderLeftColor: me.color }}
      >
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-3xl">
            {me.emoji}
          </span>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{me.name}</h1>
          <span className="board-face text-sm">Final</span>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-line pt-3">
          <p className="board-face text-3xl">
            {ordinal(pass.rank)} of {view.playerCount}
          </p>
          <p className="board-face text-xl">{num(pass.total)} pts</p>
        </div>
        {pass.bestRound && <p className="board-face">{pass.bestRound}</p>}
        {pass.avgKm !== null && <p className="board-face">Avg {formatKm(pass.avgKm)}</p>}
      </section>
      {awards.length > 0 && (
        <section aria-labelledby="my-awards" className="flex flex-col gap-3">
          <h2 id="my-awards" className="board-face text-xl text-amber">
            Your travel awards
          </h2>
          <ul className="flex flex-col gap-3">
            {awards.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-1 rounded-card border border-line bg-board-panel p-4"
              >
                <span className="board-face text-lg text-amber">{a.title}</span>
                <span className="text-text">{a.stat}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { TOKENS } from '#shared/constants.js';
import type { PausedView, ScreenView } from '#shared/types.js';
import { PlayerTile } from '../components/PlayerTile.js';
import {
  ScreenGuessing,
  ScreenIntro,
  ScreenReveal,
  ScreenStandings,
} from '../components/ScreenGame.js';
import { SplitFlap } from '../components/SplitFlap.js';
import { ScreenFinale } from '../components/ScreenFinale.js';
import { PausedOverlay } from '../components/PausedOverlay.js';
import { StartOverlay } from '../components/StartOverlay.js';
import { unlockAudio } from '../lib/audio.js';
import { NO_DESTINATIONS, settingsLine } from '../lib/format.js';
import { enterFullscreen, toggleFullscreen } from '../lib/fullscreen.js';
import { useRoomStore } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
import { cycleSoundMode, loadSoundMode, type SoundMode } from '../lib/soundMode.js';
import { useRoomSocket, type JoinRoom } from '../lib/useRoomSocket.js';
import { useWakeLock } from '../lib/useWakeLock.js';

const STAGE_W = 1920;
const STAGE_H = 1080;

function subscribeResize(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

/** The 1920 × 1080 design scaled to fit the window, letterboxed on `--board-bg` (DESIGN.md "Screen"). */
export function stageScale(width: number, height: number): number {
  return Math.min(width / STAGE_W, height / STAGE_H);
}

function Stage({ children }: { children: ReactNode }) {
  const scale = useSyncExternalStore(subscribeResize, () =>
    stageScale(window.innerWidth, window.innerHeight),
  );
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-board-bg">
      <div
        className="relative flex shrink-0 flex-col"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

export function Screen({ makeSocket = createSocket }: { makeSocket?: () => GameSocket }) {
  const code = (useParams().code ?? '').toUpperCase();
  const view = useRoomStore((s) => s.view);
  const error = useRoomStore((s) => s.error);
  const [started, setStarted] = useState(false);

  const join = useCallback<JoinRoom>(
    (socket, ack) => socket.emit('screen:join', { code }, ack),
    [code],
  );
  useRoomSocket(code, join, makeSocket);
  useWakeLock(started);

  function start() {
    unlockAudio();
    enterFullscreen();
    setStarted(true);
  }

  if (error) {
    return (
      <Stage>
        <main className="m-auto flex flex-col items-center gap-12 px-16 text-center">
          <h1 className="board-face text-[96px] text-amber">{error}</h1>
          <Link
            to="/"
            className="flex min-h-12 items-center rounded-button border border-line px-8 py-4 text-[32px] font-semibold text-text [@media(hover:hover)]:hover:bg-board-panel"
          >
            Back to Pinpoint
          </Link>
        </main>
      </Stage>
    );
  }

  const screenView = view?.role === 'screen' ? view : null;
  return (
    <Stage>
      {!screenView ? (
        <p role="status" className="board-face m-auto text-[40px] text-text-dim">
          Connecting…
        </p>
      ) : (
        <Phase view={screenView} />
      )}
      {screenView && <JoinStrip view={screenView} />}
      {screenView?.paused && <ScreenPaused paused={screenView.paused} />}
      {screenView?.phase === 'FINAL' && screenView.rematchAt !== null && (
        <PausedOverlay
          countdownAt={screenView.rematchAt}
          message={null}
          label="Rematch in"
          cellClass="h-[240px] w-[160px] rounded-flap-screen text-[200px]"
        />
      )}
      <ScreenKeys />
      {!started && <StartOverlay onStart={start} />}
    </Stage>
  );
}

const SOUND_TOAST_MS = 1500;

/**
 * The Screen's keys (spec: Screen view): `M` cycles Sound / Quiet / Muted (stored on this device)
 * and says so for 1.5 s, `F` toggles fullscreen, `?` shows or hides the key list (Escape hides it).
 */
function ScreenKeys() {
  const [sound, setSound] = useState<{ mode: SoundMode; seq: number } | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'm') {
        const mode = cycleSoundMode(); // outside the updater, which StrictMode runs twice
        setSound((s) => ({ mode, seq: (s?.seq ?? 0) + 1 }));
      } else if (key === 'f') toggleFullscreen();
      else if (key === '?') setHelp((h) => !h);
      else if (key === 'escape') setHelp(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!sound) return;
    const t = setTimeout(() => setSound(null), SOUND_TOAST_MS);
    return () => clearTimeout(t);
  }, [sound]);

  return (
    <>
      {sound && (
        <p
          role="status"
          className="board-face absolute top-8 left-1/2 z-[1250] -translate-x-1/2 rounded-card border border-amber bg-board-panel px-8 py-4 text-[40px] text-amber"
        >
          {sound.mode}
        </p>
      )}
      {help && (
        <section
          aria-label="Keys"
          className="absolute top-1/2 left-1/2 z-[1250] flex -translate-1/2 flex-col gap-6 rounded-card border border-line bg-board-panel px-12 py-10 text-[32px] text-text"
        >
          <h2 className="board-face text-[40px] text-amber">Keys</h2>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-8 gap-y-4">
            <dt className="board-face text-amber">M</dt>
            <dd>Sound / Quiet / Muted (now {sound?.mode ?? loadSoundMode()})</dd>
            <dt className="board-face text-amber">F</dt>
            <dd>Fullscreen</dd>
            <dt className="board-face text-amber">?</dt>
            <dd>This list</dd>
          </dl>
        </section>
      )}
    </>
  );
}

/**
 * Paused (spec: Screen view): the banner while the VIP holds the game, then the 3-2-1. A
 * `screenAway` pause has no banner: a Screen that sees it is the one coming back.
 */
// SPEC-QUESTION: DECISIONS 28 (the banner sits along the bottom, above the join strip)
function ScreenPaused({ paused }: { paused: PausedView }) {
  if (paused.resumeAt === null && paused.reasons.includes('vip'))
    return (
      <p
        role="status"
        className="board-face absolute inset-x-0 bottom-12 z-[1100] border-y-2 border-delayed bg-board-panel py-6 text-center text-[48px] text-delayed"
      >
        Delayed · the VIP paused the game
      </p>
    );
  return (
    <PausedOverlay
      countdownAt={paused.resumeAt}
      message={null}
      cellClass="h-[240px] w-[160px] rounded-flap-screen text-[200px]"
    />
  );
}

function Phase({ view }: { view: ScreenView }) {
  if (view.phase === 'LOBBY') return <Lobby view={view} />;
  if (view.phase === 'INTRO' && view.round) return <ScreenIntro round={view.round} />;
  if (view.phase === 'GUESSING' && view.round)
    return <ScreenGuessing view={view} round={view.round} />;
  if (view.phase === 'REVEAL' && view.reveal)
    return <ScreenReveal view={view} reveal={view.reveal} />;
  if (view.phase === 'SCOREBOARD') return <ScreenStandings view={view} />;
  if (view.phase === 'FINAL') return <ScreenFinale view={view} />;
  return null;
}

function Lobby({ view }: { view: ScreenView }) {
  const fx = useRoomStore((s) => s.fx);
  const wiggle = fx?.fx.kind === 'practice' ? { playerId: fx.fx.playerId, seq: fx.seq } : null;
  return (
    <div className="flex flex-1 flex-col gap-12 px-16 pt-16 pb-8">
      <div className="flex items-start justify-between gap-16">
        <div className="flex flex-col gap-8">
          <p className="board-face text-[40px] text-amber">Room code</p>
          <SplitFlap
            text={view.code}
            label={`Room code ${view.code}`}
            cellClass="h-[240px] w-[160px] rounded-flap-screen text-[200px]"
          />
          <p className="text-[32px] text-text-dim">
            Scan the code or go to <span className="font-semibold text-text">{view.joinUrl}</span>
          </p>
        </div>
        <div className="rounded-card bg-pass-bg p-6">
          <QRCodeSVG
            value={view.joinUrl}
            size={320}
            bgColor={TOKENS.passBg}
            fgColor={TOKENS.passText}
            title={`Join at ${view.joinUrl}`}
          />
        </div>
      </div>

      {view.players.length === 0 ? (
        <p role="status" className="m-auto text-[40px] text-text-dim">
          Waiting for the first player: they&rsquo;ll be the VIP
        </p>
      ) : (
        <ul aria-label="Players" className="flex flex-wrap justify-center gap-x-10 gap-y-8">
          {view.players.map((p) => (
            <PlayerTile
              key={p.id}
              player={p}
              popIn
              wiggleSeq={wiggle?.playerId === p.id ? wiggle.seq : null}
            />
          ))}
        </ul>
      )}

      {view.hasCategories ? (
        <p aria-label="Settings" className="board-face text-center text-[40px] text-amber">
          {settingsLine(view)}
        </p>
      ) : (
        <p aria-label="Settings" className="text-center text-[32px] text-text-dim">
          {NO_DESTINATIONS}
        </p>
      )}
    </div>
  );
}

function JoinStrip({ view }: { view: ScreenView }) {
  const host = new URL(view.joinUrl).host;
  return (
    <p className="mt-auto flex h-12 shrink-0 items-center justify-center bg-board-panel text-[24px] text-text">
      Join at {host} · code {view.code}
    </p>
  );
}

import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { TOKENS } from '#shared/constants.js';
import type { PublicPlayer, ScreenView } from '#shared/types.js';
import { SplitFlap } from '../components/SplitFlap.js';
import { StartOverlay } from '../components/StartOverlay.js';
import { unlockAudio } from '../lib/audio.js';
import { enterFullscreen } from '../lib/fullscreen.js';
import { useRoomStore } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
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
      ) : screenView.phase === 'LOBBY' ? (
        <Lobby view={screenView} />
      ) : (
        // shortcut: later phases render here as their features land (F11 onwards).
        <p className="board-face m-auto text-[40px] text-amber">{screenView.phase}</p>
      )}
      {screenView && <JoinStrip view={screenView} />}
      {!started && <StartOverlay onStart={start} />}
    </Stage>
  );
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
              wiggleSeq={wiggle?.playerId === p.id ? wiggle.seq : null}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** `wiggleSeq`: the practice fx to wiggle for; a new one remounts the square to replay it. */
function PlayerTile({ player, wiggleSeq }: { player: PublicPlayer; wiggleSeq: number | null }) {
  return (
    <li
      className={`flex w-[200px] flex-col items-center gap-3 ${player.connected ? '' : 'opacity-40 grayscale'}`}
    >
      <span
        key={wiggleSeq ?? 'still'}
        data-wiggle={wiggleSeq !== null || undefined}
        className={`relative flex size-32 items-center justify-center rounded-card border-4 text-[64px] ${player.waiting ? 'border-dashed' : ''} ${wiggleSeq !== null ? 'tile-wiggle' : ''}`}
        style={{ borderColor: player.color }}
      >
        <span aria-hidden="true">{player.emoji}</span>
        {player.isVip && (
          <span
            role="img"
            aria-label="VIP"
            className="absolute -top-5 -right-5 flex size-12 items-center justify-center rounded-full bg-amber text-[28px] text-board-bg"
          >
            ★
          </span>
        )}
      </span>
      <span className="w-full text-center text-[24px] font-semibold break-words text-text">
        {player.name}
      </span>
    </li>
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

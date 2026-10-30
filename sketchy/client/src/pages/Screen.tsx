import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { ScreenView } from '../../../shared/types.js';
import { DebugOverlay } from '../components/screen/DebugOverlay.js';
import { NextButton } from '../components/screen/NextButton.js';
import { ScreenLobby } from '../components/screen/ScreenLobby.js';
import { ScreenStandings } from '../components/screen/ScreenStandings.js';
import { ScreenTurn } from '../components/screen/ScreenTurn.js';
import { createClockOffset, createDelayWindow, isDebug, recordPaint } from '../lib/clock.js';
import { translator } from '../lib/copy.js';
import { clearHostToken, loadHostToken } from '../lib/hostTokens.js';
import { createScreenInk } from '../lib/ink.js';
import { keepPinging } from '../lib/ping.js';
import { createInkSocket, createSocket } from '../lib/socket.js';

type Status = 'connecting' | 'live' | 'ended';

const JOIN_ACK_TIMEOUT_MS = 5000;

/** How long the Screen shows "All words used, reshuffling". */
const RESHUFFLE_NOTICE_MS = 4000;

/**
 * The Screen at `/screen/:code`: joins as a Screen (with this device's hostToken, if it created the
 * room), renders the latest `state`, and draws the `/ink` relay live. Landscape layout only (F33
 * adds portrait). Lazy-loaded, so phones never download it.
 */
export function Screen() {
  const code = (useParams().code ?? '').toUpperCase();
  const [status, setStatus] = useState<Status>('connecting');
  const [state, setState] = useState<{ view: ScreenView; at: number } | null>(null);
  // "All words used, reshuffling", for a few seconds after the deck runs out.
  const [reshuffled, setReshuffled] = useState(false);
  const socket = useMemo(() => createSocket(), []);
  const ink = useMemo(() => createScreenInk(), []);
  // `?debug=1` (F16): this Screen's clock offset to the server and the recent ink delays.
  const debug = useMemo(
    () => (isDebug() ? { clock: createClockOffset(), delays: createDelayWindow() } : null),
    [],
  );

  useEffect(() => {
    const join = async (withToken: boolean) => {
      const hostToken = withToken ? loadHostToken(code) : null;
      let res;
      try {
        res = await socket.timeout(JOIN_ACK_TIMEOUT_MS).emitWithAck('screen:join', {
          code,
          ...(hostToken ? { hostToken } : {}),
        });
      } catch {
        // No answer: ask again while connected (a reconnect asks again by itself).
        if (socket.connected) void join(withToken);
        return;
      }
      // `alreadyJoined`: a late answer to an earlier try already let this socket in.
      if (res.ok || res.error === 'alreadyJoined') return setStatus('live');
      if (hostToken && (res.error === 'badHostToken' || res.error === 'invalidPayload')) {
        // A token left from an expired room that had the same code (or a mangled one): join as a
        // plain Screen.
        clearHostToken(code);
        return join(false);
      }
      // No such room (or a malformed code in the URL): nothing to wait for.
      setStatus('ended');
    };
    socket.on('connect', () => void join(true));
    // Socket.IO reconnects by itself; meanwhile the last frame stays up under a badge.
    socket.on('disconnect', () => setStatus((s) => (s === 'ended' ? s : 'connecting')));
    socket.on('state', (view) => {
      if (view.role === 'screen') setState({ view, at: performance.now() });
    });
    let reshuffleTimer: ReturnType<typeof setTimeout> | undefined;
    socket.on('fx', (fx) => {
      if (fx.kind !== 'wordsReshuffled') return;
      setReshuffled(true);
      clearTimeout(reshuffleTimer);
      reshuffleTimer = setTimeout(() => setReshuffled(false), RESHUFFLE_NOTICE_MS);
    });
    socket.on('room:closed', () => {
      setStatus('ended');
      socket.disconnect();
    });
    // A Screen pings only in debug mode, for its clock offset.
    const stopPinging = debug ? keepPinging(socket, { onServerTime: debug.clock.add }) : () => {};
    socket.connect();

    // Every connect, reconnects included, rejoins the Screen's ink room and brings back the drawing
    // with a snapshot; a gap in `seq` asks for a fresh one the same way.
    const inkSocket = createInkSocket();
    const hello = () => inkSocket.emit('ink:hello', { code });
    inkSocket.on('connect', hello);
    inkSocket.on('ink:turn', ({ turnId }) => ink.turn(turnId));
    inkSocket.on('ink:snapshot', (snapshot) => ink.snapshot(snapshot));
    inkSocket.on('ink:batch', (batch) => {
      const applied = ink.batch(batch);
      if (applied === 'gap') hello();
      const sentAt = batch[3];
      if (!debug || applied !== 'ok' || sentAt === undefined) return;
      // The canvas asked for its frame while the batch applied (or earlier), and frame callbacks
      // run in the order asked, so this one runs in the same frame just after the paint.
      // A hidden tab's frames are throttled, which would only measure the throttling.
      requestAnimationFrame(() => {
        if (!document.hidden) recordPaint(debug.delays, debug.clock, sentAt, performance.now());
      });
    });
    inkSocket.connect();

    return () => {
      clearTimeout(reshuffleTimer);
      stopPinging();
      socket.removeAllListeners();
      socket.disconnect();
      inkSocket.removeAllListeners();
      inkSocket.disconnect();
    };
  }, [code, socket, ink, debug]);

  const view = state?.view ?? null;
  const t = translator(view?.settings.copy ?? 'en');

  if (status === 'ended') {
    return (
      <main className="grid h-dvh place-items-center bg-[#1D1B22] p-6 text-center text-white">
        <div className="flex flex-col items-center gap-6">
          <h1 className="font-display text-[max(6vmin,28px)] font-bold">{t('gameEnded')}</h1>
          <Link to="/" className="text-[max(3vmin,18px)] text-[#FF6B35] underline">
            {t('backHome')}
          </Link>
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="grid h-dvh place-items-center bg-[#1D1B22] text-[max(4vmin,20px)] text-white">
        {t('connecting')}
      </main>
    );
  }

  const inTurn = view.phase === 'CHOOSING' || view.phase === 'DRAWING' || view.phase === 'REVEAL';
  return (
    <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-[#1D1B22] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-white select-none">
      {status === 'connecting' && (
        <p
          role="status"
          className="absolute top-[2vmin] right-[2vmin] z-10 rounded-full bg-[#FF6B35] px-[2vmin] py-[0.5vmin] text-[max(2.5vmin,14px)] font-bold text-[#1D1B22]"
        >
          {t('reconnecting')}
        </p>
      )}
      {debug && (
        <DebugOverlay
          socket={socket}
          clock={debug.clock}
          delays={debug.delays}
          players={view.players}
        />
      )}
      {/* Over the CHOOSING panel only, never over a drawing in progress. */}
      {reshuffled && view.phase !== 'DRAWING' && (
        <p
          role="status"
          className="absolute bottom-[6vmin] left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#FFD166] px-[3vmin] py-[1vmin] text-[max(4vmin,20px)] font-bold text-[#1D1B22]"
        >
          {t('wordsReshuffled')}
        </p>
      )}
      <div className="min-h-0 flex-1">
        {view.phase === 'LOBBY' && <ScreenLobby view={view} socket={socket} t={t} />}
        {inTurn && <ScreenTurn view={view} receivedAt={state!.at} ink={ink} t={t} />}
        {(view.phase === 'SCOREBOARD' || view.phase === 'FINAL') && (
          <ScreenStandings view={view} t={t} />
        )}
      </div>
      <NextButton view={view} socket={socket} t={t} />
      <footer className="shrink-0 px-[2vmin] pb-[1vmin] text-[max(2.5vmin,14px)] text-white/70">
        {window.location.host} · <strong className="tracking-widest text-white">{view.code}</strong>
      </footer>
    </main>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { ScreenView } from '../../../shared/types.js';
import { ScreenLobby } from '../components/screen/ScreenLobby.js';
import { ScreenStandings } from '../components/screen/ScreenStandings.js';
import { ScreenTurn } from '../components/screen/ScreenTurn.js';
import { translator } from '../lib/copy.js';
import { clearHostToken, loadHostToken } from '../lib/hostTokens.js';
import { createScreenInk } from '../lib/ink.js';
import { createInkSocket, createSocket } from '../lib/socket.js';

type Status = 'connecting' | 'live' | 'ended';

const JOIN_ACK_TIMEOUT_MS = 5000;

/**
 * The Screen at `/screen/:code`: joins as a Screen (with this device's hostToken, if it created the
 * room), renders the latest `state`, and draws the `/ink` relay live. Landscape layout only (F33
 * adds portrait). Lazy-loaded, so phones never download it.
 */
export function Screen() {
  const code = (useParams().code ?? '').toUpperCase();
  const [status, setStatus] = useState<Status>('connecting');
  const [state, setState] = useState<{ view: ScreenView; at: number } | null>(null);
  const socket = useMemo(() => createSocket(), []);
  const ink = useMemo(() => createScreenInk(), []);

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
    socket.on('room:closed', () => {
      setStatus('ended');
      socket.disconnect();
    });
    socket.connect();

    // Every connect, reconnects included, rejoins the Screen's ink room and brings back the drawing
    // with a snapshot; a gap in `seq` asks for a fresh one the same way.
    const inkSocket = createInkSocket();
    const hello = () => inkSocket.emit('ink:hello', { code });
    inkSocket.on('connect', hello);
    inkSocket.on('ink:turn', ({ turnId }) => ink.turn(turnId));
    inkSocket.on('ink:snapshot', (snapshot) => ink.snapshot(snapshot));
    inkSocket.on('ink:batch', (batch) => {
      if (ink.batch(batch) === 'gap') hello();
    });
    inkSocket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      inkSocket.removeAllListeners();
      inkSocket.disconnect();
    };
  }, [code, socket, ink]);

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
      <div className="min-h-0 flex-1">
        {view.phase === 'LOBBY' && <ScreenLobby view={view} socket={socket} t={t} />}
        {inTurn && <ScreenTurn view={view} receivedAt={state!.at} ink={ink} t={t} />}
        {(view.phase === 'SCOREBOARD' || view.phase === 'FINAL') && (
          <ScreenStandings view={view} t={t} />
        )}
      </div>
      <footer className="shrink-0 px-[2vmin] pb-[1vmin] text-[max(2.5vmin,14px)] text-white/70">
        {window.location.host} · <strong className="tracking-widest text-white">{view.code}</strong>
      </footer>
    </main>
  );
}

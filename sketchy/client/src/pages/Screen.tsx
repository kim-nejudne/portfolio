import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from '../lib/router.js';
import type { ScreenView } from '../../../shared/types.js';
import { DebugOverlay } from '../components/screen/DebugOverlay.js';
import { PausedOverlay } from '../components/PausedOverlay.js';
import { RematchOverlay } from '../components/RematchOverlay.js';
import { HostControls } from '../components/screen/HostControls.js';
import { ScreenLobby } from '../components/screen/ScreenLobby.js';
import { ScreenStandings } from '../components/screen/ScreenStandings.js';
import { ScreenTurn } from '../components/screen/ScreenTurn.js';
import { StartOverlay } from '../components/screen/StartOverlay.js';
import { createClockOffset, createDelayWindow, isDebug, recordPaint } from '../lib/clock.js';
import { translator } from '../lib/copy.js';
import { enterFullscreen } from '../lib/fullscreen.js';
import { DoodleContext, createScreenDoodles } from '../lib/doodles.js';
import { clearHostToken, loadHostToken } from '../lib/hostTokens.js';
import { createScreenInk } from '../lib/ink.js';
import { keepPinging } from '../lib/ping.js';
import { createScreenFx } from '../lib/screenFx.js';
import { playSound, preloadSounds, soundForFx, startSounds } from '../lib/sounds.js';
import { usePointerCoarse } from '../lib/usePointerCoarse.js';
import { useScreenLayout } from '../lib/useScreenLayout.js';
import { createInkSocket, createSocket } from '../lib/socket.js';
import { useScreenSounds } from '../lib/useScreenSounds.js';
import { useWakeLock } from '../lib/wakeLock.js';

type Status = 'connecting' | 'live' | 'ended';

const JOIN_ACK_TIMEOUT_MS = 5000;

/** How long the Screen shows "All words used, reshuffling". */
const RESHUFFLE_NOTICE_MS = 4000;
/** How long the Screen shows "Need 2 players" after a rematch countdown ran out. */
const NEED_TWO_NOTICE_MS = 4000;

/**
 * The Screen at `/screen/:code`: joins as a Screen (with this device's hostToken, if it created the
 * room), renders the latest `state`, and draws the `/ink` relay live, in the landscape or portrait
 * layout its window's shape asks for. Lazy-loaded, so phones never download it.
 */
export function Screen() {
  const code = (useParams().code ?? '').toUpperCase();
  const [status, setStatus] = useState<Status>('connecting');
  const [state, setState] = useState<{ view: ScreenView; at: number } | null>(null);
  // "All words used, reshuffling", for a few seconds after the deck runs out.
  const [reshuffled, setReshuffled] = useState(false);
  // "Need 2 players", for a few seconds after a rematch countdown ends with too few connected.
  const [needTwo, setNeedTwo] = useState(false);
  const layout = useScreenLayout();
  // "Tap to start" (F37): the tap asks for fullscreen and, from then on, a Screen Wake Lock.
  const [started, setStarted] = useState(false);
  const coarse = usePointerCoarse();
  useWakeLock(started && status !== 'ended');
  const socket = useMemo(() => createSocket(), []);
  const ink = useMemo(() => createScreenInk(), []);
  // Lobby doodles (F27), drawn as the players' avatars on every chip.
  const doodles = useMemo(() => createScreenDoodles(), []);
  // "Jun got it!", wrong-guess bubbles and reactions (F34), from `fx` events.
  const turnFx = useMemo(() => createScreenFx(), []);
  const fxState = useSyncExternalStore(turnFx.subscribe, turnFx.getSnapshot);
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
    let needTwoTimer: ReturnType<typeof setTimeout> | undefined;
    socket.on('fx', (fx) => {
      turnFx.push(fx);
      const sound = soundForFx(fx);
      if (sound) playSound(sound);
      if (fx.kind === 'wordsReshuffled') {
        setReshuffled(true);
        clearTimeout(reshuffleTimer);
        reshuffleTimer = setTimeout(() => setReshuffled(false), RESHUFFLE_NOTICE_MS);
      } else if (fx.kind === 'notEnoughPlayers') {
        setNeedTwo(true);
        clearTimeout(needTwoTimer);
        needTwoTimer = setTimeout(() => setNeedTwo(false), NEED_TWO_NOTICE_MS);
      }
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
    inkSocket.on('ink:snapshot', (snapshot) => {
      ink.snapshot(snapshot);
      doodles.replace(snapshot.doodles);
    });
    inkSocket.on('doodle', ({ pid, ops }) => doodles.apply(pid, ops));
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
      clearTimeout(needTwoTimer);
      turnFx.clear();
      stopPinging();
      socket.removeAllListeners();
      socket.disconnect();
      inkSocket.removeAllListeners();
      inkSocket.disconnect();
    };
  }, [code, socket, ink, doodles, turnFx, debug]);

  // Howler starts downloading at once, so the tap can unlock audio without waiting for it.
  useEffect(preloadSounds, []);

  const view = state?.view ?? null;
  const t = translator(view?.settings.copy ?? 'en');
  useScreenSounds(view, state?.at ?? 0);

  // Inside the gesture, as browsers require: fullscreen, audio (F38), and from `started` on, the
  // wake lock.
  const start = () => {
    enterFullscreen();
    void startSounds();
    setStarted(true);
  };
  const startOverlay = !started && <StartOverlay coarse={coarse} onStart={start} t={t} />;

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
        {startOverlay}
      </main>
    );
  }

  const inTurn = view.phase === 'CHOOSING' || view.phase === 'DRAWING' || view.phase === 'REVEAL';
  return (
    <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-[#1D1B22] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-white select-none">
      {status === 'connecting' && (
        <p
          role="status"
          className="absolute top-[2vmin] right-[2vmin] z-20 rounded-full bg-[#FF6B35] px-[2vmin] py-[0.5vmin] text-[max(2.5vmin,14px)] font-bold text-[#1D1B22]"
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
      {needTwo && view.phase === 'FINAL' && (
        <p
          role="status"
          className="absolute top-[16vmin] left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#FFD166] px-[3vmin] py-[1vmin] text-[max(4vmin,20px)] font-bold text-[#1D1B22]"
        >
          {t('needTwoPlayers')}
        </p>
      )}
      <div className="min-h-0 flex-1">
        <DoodleContext value={doodles}>
          {view.phase === 'LOBBY' && <ScreenLobby view={view} socket={socket} t={t} />}
          {inTurn && (
            <ScreenTurn
              view={view}
              receivedAt={state!.at}
              ink={ink}
              layout={layout}
              fx={fxState}
              t={t}
            />
          )}
          {(view.phase === 'SCOREBOARD' || view.phase === 'FINAL') && (
            <ScreenStandings view={view} layout={layout} t={t} />
          )}
        </DoodleContext>
      </div>
      {view.paused && <PausedOverlay view={view} receivedAt={state!.at} variant="screen" t={t} />}
      {view.phase === 'FINAL' && view.rematchInMs !== null && (
        <RematchOverlay view={view} receivedAt={state!.at} variant="screen" t={t} />
      )}
      {/* Always visible. Portrait leads with the code and lets the address run out ("KPRW ·
          sketchy.kimn…"), so the code is never the part cut off. */}
      <footer className="shrink-0 truncate px-[2vmin] pb-[1vmin] text-[max(2.5vmin,14px)] text-white/70">
        {layout === 'portrait' ? (
          <>
            <strong className="tracking-widest text-white">{view.code}</strong> ·{' '}
            {window.location.host}
          </>
        ) : (
          <>
            {window.location.host} ·{' '}
            <strong className="tracking-widest text-white">{view.code}</strong>
          </>
        )}
      </footer>
      {/* The token Screen only; the server checks every host event again. */}
      {view.host && <HostControls view={view} socket={socket} t={t} />}
      {startOverlay}
    </main>
  );
}

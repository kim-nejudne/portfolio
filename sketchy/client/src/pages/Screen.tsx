import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from '../lib/router.js';
import type { ScreenView } from '../../../shared/types.js';
import { DebugOverlay } from '../components/screen/DebugOverlay.js';
import { PausedOverlay } from '../components/PausedOverlay.js';
import { RematchOverlay } from '../components/RematchOverlay.js';
import { REJOINED_TOAST_MS, RejoinedToast } from '../components/screen/RejoinedToast.js';
import { HostControls } from '../components/screen/HostControls.js';
import { ScreenDesk } from '../components/screen/ScreenDesk.js';
import { ScreenLobby } from '../components/screen/ScreenLobby.js';
import { ScreenStandings } from '../components/screen/ScreenStandings.js';
import { ScreenTurn } from '../components/screen/ScreenTurn.js';
import { StartOverlay } from '../components/screen/StartOverlay.js';
import { createClockOffset, createDelayWindow, isDebug, recordPaint } from '../lib/clock.js';
import { translator } from '../lib/copy.js';
import { enterFullscreen } from '../lib/fullscreen.js';
import { createScreenGallery } from '../lib/gallery.js';
import { clearHostToken, loadHostToken } from '../lib/hostTokens.js';
import { createScreenInk } from '../lib/ink.js';
import { codeStripCode } from '../lib/screen.js';
import { keepPinging } from '../lib/ping.js';
import { createScreenFx } from '../lib/screenFx.js';
import { playSound, preloadSounds, soundForFx, startSounds } from '../lib/sounds.js';
import { usePointerCoarse } from '../lib/usePointerCoarse.js';
import { useScreenLayout } from '../lib/useScreenLayout.js';
import { createInkSocket, createSocket } from '../lib/socket.js';
import { useScreenSounds } from '../lib/useScreenSounds.js';
import { useWakeLock } from '../lib/wakeLock.js';

type Status = 'connecting' | 'live' | 'ended';

/** A notice on the Screen: a sticky note with a hand-drawn border and a hard shadow, level. */
const STICKY_TOAST =
  'pointer-events-none absolute left-1/2 z-20 max-w-[90vw] -translate-x-1/2 truncate sketch-border bg-sticky px-[3vmin] py-[1vmin] text-[max(4vmin,20px)] text-ink shadow-[0.42vmin_0.56vmin_0_var(--color-ink)]';

const JOIN_ACK_TIMEOUT_MS = 5000;
/** How long a gallery drawing's `ink:get` may take before it is asked again. */
const INK_GET_TIMEOUT_MS = 5000;

/** How long the Screen shows "All words used, reshuffling". */
const RESHUFFLE_NOTICE_MS = 4000;
/** How long the Screen shows "Need 2 players" after a rematch countdown ran out. */
const NEED_TWO_NOTICE_MS = 4000;

/**
 * The Screen at `/screen/:code`: joins as a Screen (with this device's hostToken, if it created the
 * room), renders the latest `state`, and draws the `/ink` relay live, in the landscape or portrait
 * layout its window's shape asks for, as a spiral notebook open on the desk (F62). Lazy-loaded, so phones never download it.
 */
export function Screen() {
  const code = (useParams().code ?? '').toUpperCase();
  const [status, setStatus] = useState<Status>('connecting');
  const [state, setState] = useState<{ view: ScreenView; at: number } | null>(null);
  // "All words used, reshuffling", for a few seconds after the deck runs out.
  const [reshuffled, setReshuffled] = useState(false);
  // "Need 2 players", for a few seconds after a rematch countdown ends with too few connected.
  const [needTwo, setNeedTwo] = useState(false);
  // "Jun is back (new phone)" (F42): the pid whose player moved to another phone, for a few seconds.
  const [rejoinedPid, setRejoinedPid] = useState<string | null>(null);
  const layout = useScreenLayout();
  // "Tap to start" (F37): the tap asks for fullscreen and, from then on, a Screen Wake Lock.
  const [started, setStarted] = useState(false);
  const coarse = usePointerCoarse();
  useWakeLock(started && status !== 'ended');
  const socket = useMemo(() => createSocket(), []);
  const ink = useMemo(() => createScreenInk(), []);
  // "Jun got it!", wrong-guess bubbles and reactions (F34), from `fx` events.
  const turnFx = useMemo(() => createScreenFx(), []);
  const inkSocket = useMemo(() => createInkSocket(), []);
  // FINAL's gallery (F49): each drawing's frozen ink, asked for on this Screen's `/ink` socket.
  const gallery = useMemo(
    () =>
      createScreenGallery((turnId) =>
        inkSocket.timeout(INK_GET_TIMEOUT_MS).emitWithAck('ink:get', { turnId }),
      ),
    [inkSocket],
  );
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
    let rejoinedTimer: ReturnType<typeof setTimeout> | undefined;
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
      } else if (fx.kind === 'rejoined') {
        setRejoinedPid(fx.pid);
        clearTimeout(rejoinedTimer);
        rejoinedTimer = setTimeout(() => setRejoinedPid(null), REJOINED_TOAST_MS);
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
    // A gallery drawing asked before the hello was refused (`notJoined`): ask again now.
    const hello = () =>
      inkSocket.emit('ink:hello', { code }, (res) => {
        if (res.ok) gallery.retry();
      });
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
      clearTimeout(needTwoTimer);
      clearTimeout(rejoinedTimer);
      turnFx.clear();
      stopPinging();
      socket.removeAllListeners();
      socket.disconnect();
      inkSocket.removeAllListeners();
      inkSocket.disconnect();
    };
  }, [code, socket, inkSocket, ink, turnFx, debug, gallery]);

  // Howler starts downloading at once, so the tap can unlock audio without waiting for it.
  useEffect(preloadSounds, []);

  const view = state?.view ?? null;
  const t = translator(view?.settings.copy ?? 'en');
  useScreenSounds(view, state?.at ?? 0);

  // The gallery asks for FINAL's drawings once and forgets them when the game moves on.
  const galleryIds = view?.phase === 'FINAL' ? view.gallery.map((g) => g.turnId).join() : '';
  useEffect(() => {
    if (!galleryIds) return;
    gallery.want(galleryIds.split(',').map(Number));
    return () => gallery.clear();
  }, [galleryIds, gallery]);

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
      <main className="paper-dots grid h-dvh place-items-center bg-paper p-6 text-center font-hand text-ink">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-[max(6vmin,28px)] leading-tight font-normal">{t('gameEnded')}</h1>
          <Link to="/" className="text-[max(3.6vmin,20px)] text-pen underline">
            {t('backHome')}
          </Link>
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="paper-dots grid h-dvh place-items-center bg-paper font-hand text-[max(4vmin,20px)] text-ink">
        {t('connecting')}
        {startOverlay}
      </main>
    );
  }

  const inTurn = view.phase === 'CHOOSING' || view.phase === 'DRAWING' || view.phase === 'REVEAL';
  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-desk pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] font-hand text-ink select-none">
      {status === 'connecting' && (
        <p
          role="status"
          className="absolute top-[2vmin] right-[2vmin] z-20 rounded-full border-[length:max(2px,0.28vmin)] border-ink bg-paper px-[2vmin] py-[0.5vmin] text-[max(2.8vmin,16px)] text-ink shadow-[0.28vmin_0.28vmin_0_var(--color-ink)]"
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
        <p role="status" className={`bottom-[10vmin] ${STICKY_TOAST}`}>
          {t('wordsReshuffled')}
        </p>
      )}
      {needTwo && view.phase === 'FINAL' && (
        <p role="status" className={`top-[16vmin] ${STICKY_TOAST}`}>
          {t('needTwoPlayers')}
        </p>
      )}
      <RejoinedToast name={view.players.find((p) => p.pid === rejoinedPid)?.name ?? null} t={t} />
      {view.phase === 'LOBBY' ? (
        <ScreenLobby view={view} socket={socket} t={t} layout={layout} />
      ) : (
        <ScreenDesk
          layout={layout}
          code={codeStripCode(view)}
          // The turn and the standings keep their dark page inside the book until F64–F66
          // restyle them (`legacy-night`, DECISIONS 85).
          singleClassName="legacy-night"
          plain
          single={
            <>
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
                <ScreenStandings view={view} layout={layout} gallery={gallery} t={t} />
              )}
            </>
          }
        />
      )}
      {view.paused && <PausedOverlay view={view} receivedAt={state!.at} variant="screen" t={t} />}
      {view.phase === 'FINAL' && view.rematchInMs !== null && (
        <RematchOverlay view={view} receivedAt={state!.at} variant="screen" t={t} />
      )}
      {/* The token Screen only; the server checks every host event again. */}
      {/* The control bar keeps its dark look until F63 (`legacy-ink`, DECISIONS 85). */}
      {view.host && (
        <div className="legacy-ink">
          <HostControls view={view} socket={socket} t={t} />
        </div>
      )}
      {startOverlay}
    </main>
  );
}

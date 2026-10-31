import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams } from '../lib/router.js';
import type {
  Ack,
  Avatar,
  ChoiceIndex,
  InkBatch,
  InkOp,
  PlayerView,
  Reaction,
} from '../../../shared/types.js';
import { ConnectionDot } from '../components/phone/ConnectionDot.js';
import { DrawerTurn } from '../components/phone/DrawerTurn.js';
import { GuesserTurn } from '../components/phone/GuesserTurn.js';
import { PausedOverlay } from '../components/PausedOverlay.js';
import { RematchOverlay } from '../components/RematchOverlay.js';
import { HostDrawer } from '../components/phone/HostDrawer.js';
import { JoinForm, TakeOverPrompt } from '../components/phone/JoinForm.js';
import { PhoneLobby } from '../components/phone/PhoneLobby.js';
import { PhoneStandings } from '../components/phone/PhoneStandings.js';
import { WordChoice } from '../components/phone/WordChoice.js';
import { createDrawerSync, type DrawerInkLink, type DrawerSync } from '../ink/drawerSync.js';
import { createCloseAlert } from '../lib/closeAlert.js';
import { createConnection } from '../lib/connection.js';
import { translator, type CopyKey } from '../lib/copy.js';
import {
  addOwnGuess,
  fxVibration,
  gainedCrown,
  joinOutcome,
  phoneWakeLock,
  welcomeTurn,
  type OwnGuesses,
} from '../lib/phone.js';
import {
  clearPlayer,
  loadPlayer,
  newPlayerKey,
  randomAvatar,
  savePlayer,
  type PlayerIdentity,
} from '../lib/playerIdentity.js';
import { createClockOffset, isDebug, stampBatch } from '../lib/clock.js';
import { keepPinging } from '../lib/ping.js';
import { createInkSocket, createSocket, type InkSocket } from '../lib/socket.js';
import { watchVisibility } from '../lib/visibility.js';
import { useWakeLock } from '../lib/wakeLock.js';

type Status = 'form' | 'takeOver' | 'joining' | 'live' | 'ended' | 'removed';

const ACK_TIMEOUT_MS = 5000;
const CROWN_TOAST_MS = 4000;
/** Room codes are four letters from the code alphabet; anything else can't be a game. */
const CODE_PATTERN = /^[A-Z]{4}$/;

/**
 * The phone at `/play/:code`: the name step, then whatever the latest `state` says (lobby, the
 * guess box, the draw pad, reveal, scores). The phone keeps `{playerKey, name, avatar}` per room,
 * so every connect (a refresh, a re-scan, a dropped connection) rejoins silently as the same
 * player. The drawer's ink goes out on its own `/ink` socket; nothing on this page ever receives
 * ink.
 */
export function Play() {
  const code = (useParams().code ?? '').toUpperCase();
  const navigate = useNavigate();
  const stored = useMemo(() => loadPlayer(code), [code]);
  const validCode = CODE_PATTERN.test(code);

  const [status, setStatus] = useState<Status>(() =>
    !validCode ? 'ended' : stored ? 'joining' : 'form',
  );
  const [connected, setConnected] = useState(false);
  const [formError, setFormError] = useState<CopyKey | null>(null);
  const [formName, setFormName] = useState(stored?.name ?? '');
  // The join form's pre-picked avatar (F53): the one this phone last used here, else a random one.
  const [formAvatar, setFormAvatar] = useState<Avatar>(() => stored?.avatar ?? randomAvatar());
  // A stored identity rejoins without showing the name step; a typed name keeps the form up.
  const [silent, setSilent] = useState(stored !== null);
  // The name of a disconnected player this phone typed (F42): "Are you Jun?" until answered, and
  // while the takeover join is on its way.
  const [takeOverName, setTakeOverName] = useState<string | null>(null);
  const [state, setState] = useState<{ view: PlayerView; at: number } | null>(null);
  const [misses, setMisses] = useState<OwnGuesses>({ turnId: -1, items: [] });
  // Bumped on every near miss, so the guess box shows "So close!" again for a repeat.
  const [nearMiss, setNearMiss] = useState(0);
  // The drawer's "Bea is close!" for 2 s (F36), cleared when DRAWING ends.
  const closeAlert = useMemo(() => createCloseAlert(), []);
  const closePid = useSyncExternalStore(closeAlert.subscribe, closeAlert.getSnapshot);
  // A new player's first view decides whether they joined mid-turn (F23): that turn gets the
  // "You're in!" line on the guess box. A silent rejoin never sets it.
  const freshJoin = useRef(false);
  const [welcomeTurnId, setWelcomeTurnId] = useState<number | null>(null);
  // "You're the host now 👑" (F25), when a view brings the crown that the one before didn't have.
  const [crownToast, setCrownToast] = useState(0);
  // "Need 2 players" after a rematch countdown ran out with too few connected (F29).
  const [needTwoToast, setNeedTwoToast] = useState(0);
  // The crown phone's Host drawer (F25): while open, the player's view behind it is inert.
  const [hostOpen, setHostOpen] = useState(false);

  const socket = useMemo(() => createSocket(), []);
  // The connection dot (F37): green, amber while Socket.IO reconnects, red after 5 s of that.
  const connection = useMemo(() => createConnection(), []);
  const link = useSyncExternalStore(connection.subscribe, connection.getSnapshot);
  // `?debug=1` (F16): the clock offset to the server, so each ink batch carries its send time.
  const debugClock = useMemo(() => (isDebug() ? createClockOffset() : null), []);
  const identityRef = useRef<PlayerIdentity | null>(stored);
  // The next join asks for the disconnected player's pid, score and crown (F42).
  const takeOverRef = useRef(false);
  const inkRef = useRef<InkSocket | null>(null);
  // The drawer's current turn on `/ink`, while the pad is up.
  const drawerSyncRef = useRef<DrawerSync | null>(null);
  const viewRef = useRef<PlayerView | null>(null);
  // Joined on this connection: page-visibility changes are reported to the server only then (F40).
  const joinedRef = useRef(false);
  // Guesses sent and not yet answered, oldest first: a `wrong` or `nearMiss` fx belongs to the
  // oldest one.
  const pendingGuesses = useRef<string[]>([]);

  const closeInk = useCallback(() => {
    inkRef.current?.disconnect();
    inkRef.current = null;
  }, []);

  const openInk = useCallback(
    (identity: PlayerIdentity) => {
      // The `/ink` handshake names the player, so it connects only once the join went through. A
      // refused join closes it, so a new identity always gets a new socket.
      if (!inkRef.current) {
        const ink = createInkSocket({ code, playerKey: identity.playerKey });
        // Only the drawer's own snapshot and `seq` numbers ever come back on it.
        ink.on('connect', () => drawerSyncRef.current?.connected());
        ink.on('disconnect', () => drawerSyncRef.current?.disconnected());
        ink.on('ink:snapshot', (snapshot) => drawerSyncRef.current?.snapshot(snapshot));
        ink.on('ink:state', (payload) => drawerSyncRef.current?.state(payload));
        ink.on('ink:resend', (payload) => drawerSyncRef.current?.resend(payload));
        inkRef.current = ink;
      }
      if (!inkRef.current.connected) inkRef.current.connect();
    },
    [code],
  );

  // A finished lobby doodle stroke or undo (F27). Not buffered while `/ink` is down: the pad takes
  // it back. No answer in time is null, and the pad keeps it (the server most likely took it).
  const sendDoodle = useCallback(async (ops: InkOp[]): Promise<Ack | null> => {
    const ink = inkRef.current;
    if (!ink?.connected) return { ok: false, error: 'notJoined' };
    return ink
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck('doodle:batch', { ops })
      .catch(() => null);
  }, []);

  const join = useCallback(async (): Promise<void> => {
    const identity = identityRef.current;
    if (!identity) return;
    let res;
    // No answer within the timeout: ask again while connected (a reconnect asks again by itself).
    while (!res) {
      if (!socket.connected || identityRef.current !== identity) return;
      res = await socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck('player:join', {
          code,
          playerKey: identity.playerKey,
          name: identity.name,
          avatar: identity.avatar,
          ...(takeOverRef.current ? { takeOver: true } : {}),
          // A locked phone reconnecting in the background stays away for the server (F40).
          hidden: document.visibilityState === 'hidden',
        })
        .catch(() => undefined);
    }
    if (identityRef.current !== identity) return;
    const outcome = joinOutcome(res);
    takeOverRef.current = false;
    setTakeOverName(outcome.status === 'takeOver' ? identity.name : null);
    if (outcome.status === 'live') {
      savePlayer(code, identity);
      joinedRef.current = true;
      setStatus('live');
      openInk(identity);
      return;
    }
    freshJoin.current = false;
    clearPlayer(code);
    closeInk();
    if (outcome.status === 'form' || outcome.status === 'takeOver') {
      identityRef.current = null;
      setFormName(identity.name);
      setFormAvatar(identity.avatar);
      setFormError(outcome.status === 'form' ? outcome.error : null);
    } else {
      socket.disconnect();
    }
    setStatus(outcome.status);
  }, [code, socket, openInk, closeInk]);

  useEffect(() => {
    if (!validCode) return;
    socket.on('connect', () => {
      setConnected(true);
      void join();
    });
    socket.on('disconnect', () => {
      joinedRef.current = false;
      setConnected(false);
    });
    const stopWatching = connection.watch(socket);
    const stopVisibility = watchVisibility(socket, () => joinedRef.current);
    socket.on('state', (view) => {
      if (view.role !== 'player') return;
      if (gainedCrown(viewRef.current, view)) setCrownToast((n) => n + 1);
      // The drawer never reopens by itself on a crown regained later, or in the next game.
      if (!view.host || view.phase === 'LOBBY') setHostOpen(false);
      if (view.phase !== 'DRAWING') closeAlert.clear();
      viewRef.current = view;
      setState({ view, at: performance.now() });
    });
    socket.on('fx', (fx) => {
      const vibrate = fxVibration(fx);
      if (vibrate !== null) navigator.vibrate?.(vibrate);
      if (fx.kind === 'notEnoughPlayers') setNeedTwoToast((n) => n + 1);
      if (fx.kind === 'closeAlert') closeAlert.push(fx.pid);
      if (fx.kind === 'wrong' || fx.kind === 'nearMiss') {
        const close = fx.kind === 'nearMiss';
        const text = pendingGuesses.current.shift();
        const turnId = viewRef.current?.turn?.id ?? -1;
        if (text !== undefined) setMisses((m) => addOwnGuess(m, turnId, { text, close }));
        if (close) setNearMiss((n) => n + 1);
      }
    });
    socket.on('kicked', () => {
      clearPlayer(code);
      closeInk();
      setStatus('removed');
      socket.disconnect();
    });
    socket.on('room:closed', () => {
      clearPlayer(code);
      closeInk();
      setStatus('ended');
      socket.disconnect();
    });
    // RTT samples for the server's latency correction of guess times.
    const stopPinging = keepPinging(socket, {
      onAck: connection.up,
      ...(debugClock ? { onServerTime: debugClock.add } : {}),
    });
    socket.connect();

    return () => {
      stopPinging();
      stopWatching();
      stopVisibility();
      joinedRef.current = false;
      socket.removeAllListeners();
      socket.disconnect();
      closeInk();
    };
  }, [code, validCode, socket, join, closeInk, debugClock, closeAlert, connection]);

  const startJoin = (name: string, avatar: Avatar) => {
    identityRef.current = { playerKey: newPlayerKey(), name, avatar };
    setFormAvatar(avatar);
    freshJoin.current = true;
    setSilent(false);
    setFormError(null);
    setStatus('joining');
    void join();
  };

  // "Rejoin as Jun": a new key for this phone, and the join takes that player over. A rejoin, not a
  // new player, so no "You're in!" welcome.
  const takeOver = () => {
    if (takeOverName === null) return;
    // The server keeps that player's avatar; the form's pick only fills the form again later.
    identityRef.current = { playerKey: newPlayerKey(), name: takeOverName, avatar: formAvatar };
    takeOverRef.current = true;
    freshJoin.current = false;
    setSilent(false);
    setStatus('joining');
    void join();
  };

  const pickAnotherName = () => {
    takeOverRef.current = false;
    setTakeOverName(null);
    setFormError(null);
    setFormName('');
    setStatus('form');
  };

  const guess = (text: string): Promise<Ack | null> => {
    pendingGuesses.current.push(text);
    return socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck('player:guess', { text })
      .catch(() => null)
      .finally(() => {
        // Answered (or lost): it can no longer be the one a later `wrong` is about.
        const i = pendingGuesses.current.indexOf(text);
        if (i !== -1) pendingGuesses.current.splice(i, 1);
      });
  };

  // Not buffered while offline: a reaction is only worth sending now.
  const react = (emoji: Reaction) => {
    if (socket.connected)
      void socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck('player:react', { emoji })
        .catch(() => null);
  };

  const chooseWord = (index: ChoiceIndex): Promise<Ack | null> =>
    socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck('drawer:choose', { index })
      .catch(() => null);

  // Not buffered while `/ink` is down: the sender holds its ops then, and after the reconnect
  // `ink:sync` resends from its kept batches what the server is missing.
  const drawerInk = useMemo<DrawerInkLink>(
    () => ({
      send(batch: InkBatch) {
        const ink = inkRef.current;
        // The ack tells a rate-limited batch apart, so it is resent rather than left missing.
        if (!ink?.connected) return;
        // `?debug=1`: stamp the send time in server time for the Screen's delay overlay. A resend
        // is stamped afresh; the kept batch itself is never changed.
        const out = stampBatch(batch, debugClock, performance.now());
        ink.emit('ink:batch', out, (res) => drawerSyncRef.current?.batchAck(res));
      },
      bind(turnId, sender, onSnapshot) {
        const sync = createDrawerSync({
          code,
          turnId,
          sender,
          onSnapshot,
          emit: (event, payload, onAck) => {
            const ink = inkRef.current;
            if (!ink?.connected) return;
            // `ink:hello` and `ink:sync` share an ack type; the cast only drops the event union.
            const timed = ink.timeout(ACK_TIMEOUT_MS) as unknown as {
              emit(e: string, p: unknown, cb: (err: Error | null, res: Ack) => void): void;
            };
            timed.emit(event, payload, (err, res) => onAck(err ? null : res));
          },
        });
        drawerSyncRef.current = sync;
        if (inkRef.current?.connected) sync.connected();
        return () => {
          sync.dispose();
          if (drawerSyncRef.current === sync) drawerSyncRef.current = null;
        };
      },
    }),
    [code, debugClock],
  );

  const leave = () => {
    void socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck('player:leave', {})
      .catch(() => null)
      .finally(() => {
        clearPlayer(code);
        closeInk();
        identityRef.current = null;
        navigate('/');
      });
  };

  const view = state?.view ?? null;
  const t = translator(view?.settings.copy ?? 'en');
  // The screen stays on during a game (F37); the lobby may sleep.
  useWakeLock(status === 'live' && phoneWakeLock(view));

  useEffect(() => {
    if (!freshJoin.current || status !== 'live' || !view) return;
    freshJoin.current = false;
    setWelcomeTurnId(welcomeTurn(view));
  }, [status, view]);

  useEffect(() => {
    if (!crownToast) return;
    const timer = setTimeout(() => setCrownToast(0), CROWN_TOAST_MS);
    return () => clearTimeout(timer);
  }, [crownToast]);

  useEffect(() => {
    if (!needTwoToast) return;
    const timer = setTimeout(() => setNeedTwoToast(0), CROWN_TOAST_MS);
    return () => clearTimeout(timer);
  }, [needTwoToast]);

  // Batches sent as the pause began were refused: when it lifts, the drawer catches up.
  const paused = view?.paused != null;
  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current && !paused) drawerSyncRef.current?.resync();
    // The guess box under the overlay lets go of focus, so the keyboard doesn't cover "Paused".
    if (paused && document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    wasPaused.current = paused;
  }, [paused]);

  if (status === 'ended' || status === 'removed') {
    return (
      <main className="grid h-dvh place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-6">
          <h1 className="font-display text-3xl font-bold">
            {t(status === 'removed' ? 'removed' : 'gameEnded')}
          </h1>
          <Link to="/" className="text-xl text-[#FF6B35] underline">
            {t('backHome')}
          </Link>
        </div>
      </main>
    );
  }

  if (takeOverName !== null && (status === 'takeOver' || (status === 'joining' && !silent))) {
    return (
      <main className="flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
        <TakeOverPrompt
          name={takeOverName}
          busy={status === 'joining'}
          onRejoin={takeOver}
          onPickAnother={pickAnotherName}
          t={t}
        />
      </main>
    );
  }

  if (status === 'form' || status === 'takeOver' || (status === 'joining' && !silent)) {
    return (
      <main className="flex h-dvh flex-col overflow-y-auto pt-[env(safe-area-inset-top)]">
        <JoinForm
          code={code}
          initialName={formName}
          initialAvatar={formAvatar}
          busy={status === 'joining'}
          error={formError && t(formError)}
          onJoin={startJoin}
          t={t}
        />
      </main>
    );
  }

  if (!view) {
    return <main className="grid h-dvh place-items-center text-xl">{t('connecting')}</main>;
  }

  const turn = view.turn;
  const isDrawer = turn !== null && turn.drawerPid === view.me.pid;
  const inTurn = view.phase === 'CHOOSING' || view.phase === 'DRAWING';
  // Cards for this phone: the drawer's in CHOOSING, or the next drawer's during REVEAL/SCOREBOARD
  // (F21). One element for both, keyed by the dealt turn, so it stays mounted (and armed) when an
  // unchosen deal is taken up into CHOOSING.
  // SPEC-QUESTION: the cards replace the phone's reveal ("It was…", points); the Screen shows it (DECISIONS 44).
  const choosingNext =
    (view.phase === 'REVEAL' || view.phase === 'SCOREBOARD') && view.secret?.choices != null;
  const cards = view.secret?.choices != null && (choosingNext || view.phase === 'CHOOSING');
  const hostBar = view.host !== null && view.phase !== 'LOBBY';
  // The rematch 3-2-1 covers the final scores; the crown phone's Host button keeps Cancel in reach.
  const counting = view.phase === 'FINAL' && view.rematchInMs !== null;

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden overscroll-none pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      {/* Always mounted, so screen readers announce the toast. */}
      <p
        role="status"
        className={
          crownToast
            ? 'pointer-events-none absolute top-[calc(env(safe-area-inset-top)+3.5rem)] left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#FFD166] px-4 py-2 text-base font-bold whitespace-nowrap text-[#1D1B22] shadow-lg'
            : 'sr-only'
        }
      >
        {crownToast ? t('youreHostNow') : ''}
      </p>
      <p
        role="status"
        className={
          needTwoToast
            ? 'pointer-events-none absolute top-[calc(env(safe-area-inset-top)+6.5rem)] left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#FFD166] px-4 py-2 text-base font-bold whitespace-nowrap text-[#1D1B22] shadow-lg'
            : 'sr-only'
        }
      >
        {needTwoToast ? t('needTwoPlayers') : ''}
      </p>
      <ConnectionDot connection={link} t={t} />
      {hostBar && (
        <HostDrawer view={view} socket={socket} t={t} open={hostOpen} onOpenChange={setHostOpen} />
      )}
      {!connected && (
        <p
          role="status"
          className="absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-[25] -translate-x-1/2 rounded-full bg-[#FF6B35] px-3 py-1 text-sm font-bold text-[#1D1B22]"
        >
          {t('reconnecting')}
        </p>
      )}
      {/* While paused, the covered guess box and pad are out of reach of focus and the keyboard too. */}
      <div
        inert={(hostBar && hostOpen) || view.paused !== null || counting}
        className="min-h-0 flex-1"
      >
        {view.phase === 'LOBBY' && (
          <PhoneLobby view={view} socket={socket} onLeave={leave} sendDoodle={sendDoodle} t={t} />
        )}
        {isDrawer && view.phase === 'DRAWING' && (
          <DrawerTurn
            view={view}
            receivedAt={state!.at}
            ink={drawerInk}
            paused={view.paused !== null}
            closePid={closePid}
            t={t}
          />
        )}
        {cards && (
          <WordChoice
            key={view.secret!.turnId}
            view={view}
            receivedAt={state!.at}
            onChoose={chooseWord}
            next={choosingNext}
            t={t}
          />
        )}
        {isDrawer && view.phase === 'CHOOSING' && !cards && (
          <p className="grid h-full place-items-center px-6 text-center text-2xl font-bold">
            {t('getReady')}
          </p>
        )}
        {inTurn && !isDrawer && (
          <GuesserTurn
            view={view}
            receivedAt={state!.at}
            misses={misses.turnId === turn?.id ? misses.items : []}
            nearMiss={nearMiss}
            onGuess={guess}
            onReact={react}
            welcome={welcomeTurnId !== null && welcomeTurnId === turn?.id}
            t={t}
          />
        )}
        {!inTurn && !choosingNext && view.phase !== 'LOBBY' && (
          <PhoneStandings view={view} onLeave={leave} t={t} />
        )}
      </div>
      {view.paused && <PausedOverlay view={view} receivedAt={state!.at} variant="phone" t={t} />}
      {counting && <RematchOverlay view={view} receivedAt={state!.at} variant="phone" t={t} />}
    </main>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { OWN_GUESSES_SHOWN } from '../../../shared/constants.js';
import type { Ack, InkBatch, PlayerView } from '../../../shared/types.js';
import { DrawerTurn } from '../components/phone/DrawerTurn.js';
import { GuesserTurn } from '../components/phone/GuesserTurn.js';
import { JoinForm } from '../components/phone/JoinForm.js';
import { PhoneLobby } from '../components/phone/PhoneLobby.js';
import { PhoneStandings } from '../components/phone/PhoneStandings.js';
import { createDrawerSync, type DrawerInkLink, type DrawerSync } from '../ink/drawerSync.js';
import { translator, type CopyKey } from '../lib/copy.js';
import { joinOutcome } from '../lib/phone.js';
import {
  clearPlayer,
  loadPlayer,
  newPlayerKey,
  savePlayer,
  type PlayerIdentity,
} from '../lib/playerIdentity.js';
import { keepPinging } from '../lib/ping.js';
import { createInkSocket, createSocket, type InkSocket } from '../lib/socket.js';

type Status = 'form' | 'joining' | 'live' | 'ended' | 'removed';

const ACK_TIMEOUT_MS = 5000;
const YOUR_TURN_VIBRATE_MS = 200;
/** Room codes are four letters from the code alphabet; anything else can't be a game. */
const CODE_PATTERN = /^[A-Z]{4}$/;

/**
 * The phone at `/play/:code`: the name step, then whatever the latest `state` says (lobby, the
 * guess box, the draw pad, reveal, scores). The phone keeps `{playerKey, name}` per room, so every
 * connect (a refresh, a re-scan, a dropped connection) rejoins silently as the same player.
 * The drawer's ink goes out on its own `/ink` socket; nothing on this page ever receives ink.
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
  // A stored identity rejoins without showing the name step; a typed name keeps the form up.
  const [silent, setSilent] = useState(stored !== null);
  const [state, setState] = useState<{ view: PlayerView; at: number } | null>(null);
  const [misses, setMisses] = useState<{ turnId: number; texts: string[] }>({
    turnId: -1,
    texts: [],
  });

  const socket = useMemo(() => createSocket(), []);
  const identityRef = useRef<PlayerIdentity | null>(stored);
  const inkRef = useRef<InkSocket | null>(null);
  // The drawer's current turn on `/ink`, while the pad is up.
  const drawerSyncRef = useRef<DrawerSync | null>(null);
  const viewRef = useRef<PlayerView | null>(null);
  // Guesses sent and not yet answered, oldest first: a `wrong` fx belongs to the oldest one.
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

  const join = useCallback(async (): Promise<void> => {
    const identity = identityRef.current;
    if (!identity) return;
    let res;
    // No answer within the timeout: ask again while connected (a reconnect asks again by itself).
    while (!res) {
      if (!socket.connected || identityRef.current !== identity) return;
      res = await socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck('player:join', { code, playerKey: identity.playerKey, name: identity.name })
        .catch(() => undefined);
    }
    if (identityRef.current !== identity) return;
    const outcome = joinOutcome(res);
    if (outcome.status === 'live') {
      savePlayer(code, identity);
      setStatus('live');
      openInk(identity);
      return;
    }
    clearPlayer(code);
    closeInk();
    if (outcome.status === 'form') {
      identityRef.current = null;
      setFormName(identity.name);
      setFormError(outcome.error);
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
    socket.on('disconnect', () => setConnected(false));
    socket.on('state', (view) => {
      if (view.role !== 'player') return;
      viewRef.current = view;
      setState({ view, at: performance.now() });
    });
    socket.on('fx', (fx) => {
      if (fx.kind === 'yourTurn') navigator.vibrate?.(YOUR_TURN_VIBRATE_MS);
      if (fx.kind === 'wrong') {
        const text = pendingGuesses.current.shift();
        const turnId = viewRef.current?.turn?.id ?? -1;
        if (text !== undefined)
          setMisses((m) => ({
            turnId,
            texts: [...(m.turnId === turnId ? m.texts : []), text].slice(-OWN_GUESSES_SHOWN),
          }));
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
    const stopPinging = keepPinging(socket);
    socket.connect();

    return () => {
      stopPinging();
      socket.removeAllListeners();
      socket.disconnect();
      closeInk();
    };
  }, [code, validCode, socket, join, closeInk]);

  const startJoin = (name: string) => {
    identityRef.current = { playerKey: newPlayerKey(), name };
    setSilent(false);
    setFormError(null);
    setStatus('joining');
    void join();
  };

  const guess = (text: string) => {
    pendingGuesses.current.push(text);
    void socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck('player:guess', { text })
      .catch(() => null)
      .finally(() => {
        // Answered (or lost): it can no longer be the one a later `wrong` is about.
        const i = pendingGuesses.current.indexOf(text);
        if (i !== -1) pendingGuesses.current.splice(i, 1);
      });
  };

  // Not buffered while `/ink` is down: the sender holds its ops then, and after the reconnect
  // `ink:sync` resends from its kept batches what the server is missing.
  const drawerInk = useMemo<DrawerInkLink>(
    () => ({
      send(batch: InkBatch) {
        const ink = inkRef.current;
        // The ack tells a rate-limited batch apart, so it is resent rather than left missing.
        if (ink?.connected)
          ink.emit('ink:batch', batch, (res) => drawerSyncRef.current?.batchAck(res));
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
    [code],
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
        void navigate('/');
      });
  };

  const view = state?.view ?? null;
  const t = translator(view?.settings.copy ?? 'en');

  // Batches sent as the pause began were refused: when it lifts, the drawer catches up.
  const paused = view?.paused != null;
  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current && !paused) drawerSyncRef.current?.resync();
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

  if (status === 'form' || (status === 'joining' && !silent)) {
    return (
      <main className="flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
        <JoinForm
          code={code}
          initialName={formName}
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

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden overscroll-none pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      {!connected && (
        <p
          role="status"
          className="absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#FF6B35] px-3 py-1 text-sm font-bold text-[#1D1B22]"
        >
          {t('reconnecting')}
        </p>
      )}
      <div className="min-h-0 flex-1">
        {view.phase === 'LOBBY' && <PhoneLobby view={view} onLeave={leave} t={t} />}
        {isDrawer && view.phase === 'DRAWING' && (
          <DrawerTurn
            view={view}
            receivedAt={state!.at}
            ink={drawerInk}
            paused={view.paused !== null}
            t={t}
          />
        )}
        {isDrawer && view.phase === 'CHOOSING' && (
          <p className="grid h-full place-items-center px-6 text-center text-2xl font-bold">
            {t('getReady')}
          </p>
        )}
        {inTurn && !isDrawer && (
          <GuesserTurn
            view={view}
            receivedAt={state!.at}
            misses={misses.turnId === turn?.id ? misses.texts : []}
            onGuess={guess}
            t={t}
          />
        )}
        {!inTurn && view.phase !== 'LOBBY' && <PhoneStandings view={view} onLeave={leave} t={t} />}
      </div>
      {view.paused && (
        <div
          role="status"
          className="absolute inset-0 z-20 grid place-items-center bg-[#1D1B22]/95 text-3xl font-bold"
        >
          {t('paused')}
        </div>
      )}
    </main>
  );
}

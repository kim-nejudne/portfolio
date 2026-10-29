import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from 'react';
import { Link, useParams } from 'react-router';
import {
  GAME_ENDED_ERROR,
  PLAYER_KICKED_ERROR,
  PLAYER_NAME_MAX,
  ROOM_CHECK_RATE_LIMITED_ERROR,
  ROOM_NOT_FOUND_ERROR,
} from '../../../shared/constants.js';
import { playerNameSchema } from '../../../shared/schemas.js';
import type { Ack, LobbyPlayer, PlayerView } from '../../../shared/types.js';
import { BulbRail } from '../components/BulbRail.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { ConnectionDot } from '../components/ConnectionDot.js';
import { Icon } from '../components/Icon.js';
import { Toast, useToast } from '../components/Toast.js';
import { roomExists } from '../lib/api.js';
import { buzzerState, type BuzzerKind, type BuzzerState } from '../lib/buzzerState.js';
import {
  clearPlayer,
  loadPlayer,
  newPlayerId,
  renamePlayer,
  savePlayer,
  type PlayerIdentity,
} from '../lib/playerIdentity.js';
import { ordinal } from '../lib/results.js';
import { isCompleteRoomCode } from '../lib/roomCode.js';
import { useRoomStore } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
import { useRoomSocket, type JoinRoom } from '../lib/useRoomSocket.js';
import { useAnswerCountdown, useBuzzCountdown } from '../lib/useAnswerCountdown.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LABEL, PILL } from '../lib/ui.js';
import { useWakeLock } from '../lib/useWakeLock.js';

interface PlayProps {
  /** Tests pass a fake socket. */
  makeSocket?: () => GameSocket;
}

/** The phone view at `/play/:code`: the join form, then the buzzer screen. Mobile-first. */
export function Play({ makeSocket = createSocket }: PlayProps) {
  const code = (useParams().code ?? '').toUpperCase();
  if (!isCompleteRoomCode(code)) return <PlayMessage title="Room not found" />;
  return <PlayRoom key={code} code={code} makeSocket={makeSocket} />;
}

type Step =
  | { kind: 'checking' }
  | { kind: 'missing'; ended: boolean }
  | { kind: 'unreachable'; error: string }
  | { kind: 'form' }
  | { kind: 'joining'; identity: PlayerIdentity; saved: boolean };

function PlayRoom({ code, makeSocket }: { code: string; makeSocket: () => GameSocket }) {
  const [step, setStep] = useState<Step>({ kind: 'checking' });
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  // One id per visit, reused if the first name is rejected; saved only once a join succeeds. A
  // player who leaves draws a new one, so they come back as a new player (DECISIONS F61).
  const [playerId, setPlayerId] = useState(newPlayerId);

  useEffect(() => {
    let cancelled = false;
    roomExists(code).then(
      (exists) => {
        if (cancelled) return;
        if (!exists) {
          // A stored identity means this device played here, so the game ended (expiry or restart).
          const ended = loadPlayer(code) !== null;
          // The room is gone, so any identity for it is stale (a later room may reuse the code).
          clearPlayer(code);
          return setStep({ kind: 'missing', ended });
        }
        // A stored identity means this device already joined: rejoin without the form.
        const stored = loadPlayer(code);
        setStep(stored ? { kind: 'joining', identity: stored, saved: true } : { kind: 'form' });
      },
      (error: Error) => {
        if (!cancelled) setStep({ kind: 'unreachable', error: error.message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = playerNameSchema.safeParse(name);
    if (!parsed.success) {
      return setFormError(
        name.trim() === ''
          ? 'Enter your name'
          : (parsed.error.issues[0]?.message ?? 'That name won’t work'),
      );
    }
    setFormError(null);
    setStep({ kind: 'joining', identity: { playerId, name: parsed.data }, saved: false });
  }

  const onJoined = useCallback(
    (identity: PlayerIdentity) => {
      savePlayer(code, identity);
      setStep({ kind: 'joining', identity, saved: true });
    },
    [code],
  );

  const onRejected = useCallback(
    (error: string) => {
      clearPlayer(code);
      setFormError(error);
      setStep({ kind: 'form' });
    },
    [code],
  );

  const onRenamed = useCallback(
    (newName: string) => {
      renamePlayer(code, newName);
      setStep((s) =>
        s.kind === 'joining' ? { ...s, identity: { ...s.identity, name: newName } } : s,
      );
    },
    [code],
  );

  // Back to the join form, with the name filled in to make coming back one tap.
  const onLeft = useCallback(
    (lastName: string) => {
      clearPlayer(code);
      setPlayerId(newPlayerId());
      setName(lastName);
      setFormError(null);
      setStep({ kind: 'form' });
    },
    [code],
  );

  switch (step.kind) {
    case 'checking':
      return <PlayMessage title="Checking the room…" link={false} />;
    case 'missing':
      return step.ended ? (
        <PlayMessage title={GAME_ENDED_ERROR} />
      ) : (
        <PlayMessage title="Room not found" detail={`There is no game with code ${code}.`} />
      );
    case 'unreachable':
      // Past the room-check limit (F42) the server answered, so "can't reach" would mislead.
      return (
        <PlayMessage
          title={
            step.error === ROOM_CHECK_RATE_LIMITED_ERROR ? 'Slow down' : 'Can’t reach the game'
          }
          detail={step.error}
        />
      );
    case 'form':
      return (
        <NameForm code={code} name={name} error={formError} onName={setName} onSubmit={submit} />
      );
    case 'joining':
      return (
        <PlayerRoom
          code={code}
          identity={step.identity}
          saved={step.saved}
          makeSocket={makeSocket}
          onJoined={onJoined}
          onRejected={onRejected}
          onRenamed={onRenamed}
          onLeft={onLeft}
        />
      );
  }
}

interface NameFormProps {
  code: string;
  name: string;
  error: string | null;
  onName: (name: string) => void;
  onSubmit: (event: FormEvent) => void;
}

function NameForm({ code, name, error, onName, onSubmit }: NameFormProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-4 py-10">
      <form
        onSubmit={onSubmit}
        aria-labelledby="name-heading"
        className={`flex flex-col gap-4 ${CARD}`}
      >
        <h1 id="name-heading" className="font-display text-3xl">
          Join room <span className="tracking-[0.15em] text-accent">{code}</span>
        </h1>
        <label htmlFor="player-name" className={LABEL}>
          Your name
        </label>
        <input
          id="player-name"
          value={name}
          onChange={(event) => onName(event.target.value)}
          autoComplete="nickname"
          autoCapitalize="words"
          enterKeyHint="go"
          maxLength={PLAYER_NAME_MAX}
          aria-invalid={error !== null}
          aria-describedby={error ? 'name-error' : undefined}
          className={`${INPUT} text-3xl`}
        />
        {error && (
          <p id="name-error" role="alert" className="text-lg text-buzz">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={name.trim() === ''}
          className={`${BUTTON_PRIMARY} text-2xl`}
        >
          Join
        </button>
      </form>
      <Link
        to="/"
        className="self-center py-2 text-center text-lg text-muted underline underline-offset-4"
      >
        Back to start
      </Link>
    </main>
  );
}

interface PlayerRoomProps {
  code: string;
  identity: PlayerIdentity;
  /** True once the server has accepted this identity and it is stored. */
  saved: boolean;
  makeSocket: () => GameSocket;
  onJoined: (identity: PlayerIdentity) => void;
  onRejected: (error: string) => void;
  /** The server took the new name. */
  onRenamed: (name: string) => void;
  /** The server removed this player; `name` is the one they had. */
  onLeft: (name: string) => void;
}

function PlayerRoom({
  code,
  identity,
  saved,
  makeSocket,
  onJoined,
  onRejected,
  onRenamed,
  onLeft,
}: PlayerRoomProps) {
  const join = useCallback<JoinRoom>(
    (socket, ack) => {
      socket.emit('player:join', { code, ...identity }, (res) => {
        if (res.ok) {
          if (!saved) onJoined(identity);
          return ack(res);
        }
        // A kicked id stays stored, so every refresh is refused again (Edge cases: kicked player).
        if (saved && res.error === PLAYER_KICKED_ERROR) return ack(res);
        if (res.error === ROOM_NOT_FOUND_ERROR) {
          // The room went away after the page checked it. Joined before: the game ended (restart).
          if (!saved) return ack(res);
          clearPlayer(code);
          return ack({ ok: false, error: GAME_ENDED_ERROR });
        }
        // Any other refusal means the room does not know this identity: a first join with a taken
        // name, or a stored id from an expired room whose code was reused. Back to the form.
        onRejected(res.error);
      });
    },
    [code, identity, saved, onJoined, onRejected],
  );
  const socketRef = useRoomSocket(code, join, makeSocket);
  const press = useCallback<SendPress>(
    (event, ack) => {
      const socket = socketRef.current;
      if (!socket) return ack({ ok: false, error: 'Not connected' });
      socket.emit(event, {}, ack);
    },
    [socketRef],
  );
  const rename = useCallback<SendRename>(
    (name, ack) => {
      const socket = socketRef.current;
      if (!socket) return ack({ ok: false, error: 'Not connected' });
      socket.emit('player:rename', { name }, (res) => {
        if (res.ok) onRenamed(name);
        ack(res);
      });
    },
    [socketRef, onRenamed],
  );
  const leave = useCallback<SendLeave>(
    (ack) => {
      const socket = socketRef.current;
      if (!socket) return ack({ ok: false, error: 'Not connected' });
      socket.emit('player:leave', {}, (res) => {
        // On success this page unmounts the room, and its socket with it.
        if (res.ok) onLeft(identity.name);
        ack(res);
      });
    },
    [socketRef, onLeft, identity.name],
  );

  const view = useRoomStore((state) => state.view);
  const error = useRoomStore((state) => state.error);

  // Kicked now, or refused on a rejoin after a kick: the same page either way (UI spec, Player view).
  if (error === PLAYER_KICKED_ERROR) {
    return <PlayMessage title="Removed by host" detail={PLAYER_KICKED_ERROR} />;
  }
  if (error) return <PlayMessage title={error} />;
  if (view?.role !== 'player') return <PlayMessage title="Joining…" link={false} />;
  return <Buzzer view={view} send={press} rename={rename} leave={leave} />;
}

/** Sends a press: a buzz, or a lobby test buzz. */
type SendPress = (event: 'player:buzz' | 'player:practice', ack: (res: Ack) => void) => void;
/** Sends `player:rename` with a name already checked against the join's rules. */
type SendRename = (name: string, ack: (res: Ack) => void) => void;
type SendLeave = (ack: (res: Ack) => void) => void;

/** Two short pulses for a correct answer, one long one for a wrong answer and its lockout. */
const CORRECT_VIBRATION = [60, 80, 60];
const WRONG_VIBRATION = 400;

/**
 * Vibrates on this player's own `fx correct` and `fx wrong` (UI spec, Player view). A wrong answer
 * is what locks a player out, so its one pulse covers the lockout too (DECISIONS F61). Only events
 * after mount count, as on the Host remote, so a reconnect never replays one.
 */
// SPEC-QUESTION: "vibrate on wrong and lockout" gets one pulse, as a lockout follows a wrong answer (DECISIONS, F61).
function useOutcomeHaptics(meId: string): void {
  const event = useRoomStore((state) => state.fx);
  const handledSeq = useRef(event?.seq ?? 0);
  useEffect(() => {
    if (!event || event.seq <= handledSeq.current) return;
    handledSeq.current = event.seq;
    const { fx } = event;
    if (!('vibrate' in navigator) || !('playerId' in fx) || fx.playerId !== meId) return;
    if (fx.kind === 'correct') navigator.vibrate(CORRECT_VIBRATION);
    else if (fx.kind === 'wrong') navigator.vibrate(WRONG_VIBRATION);
  }, [event, meId]);
}

/*
 * The BUZZ button: a 10px gold rim, then 10px of base and 6px of border colour as rings, and an
 * 18px bottom bevel that shrinks to 8px when pressed. Full class strings, so Tailwind sees them.
 */
const RED_BUTTON = 'border-accent bg-buzz text-ink [text-shadow:4px_4px_0_var(--color-buzz-ink)]';
/** Desaturated, not just faded: surface fill, border-colour rim, muted label. */
const DEAD_BUTTON =
  'border-edge bg-surface text-muted shadow-[0_0_0_10px_var(--color-bg),0_0_0_16px_var(--color-edge),inset_0_-18px_0_var(--color-bg-deep)]';

const BUZZER_LOOK: Record<BuzzerKind, string> = {
  idle: DEAD_BUTTON,
  // Live but muted: no pulse, a darker red, the same press-in.
  practice:
    'border-accent/60 bg-buzz-muted text-ink [text-shadow:4px_4px_0_var(--color-buzz-ink)] shadow-[0_0_0_10px_var(--color-bg),0_0_0_16px_var(--color-edge),inset_0_-18px_0_var(--color-buzz-muted-pressed)] active:translate-y-1 active:shadow-[0_0_0_10px_var(--color-bg),0_0_0_16px_var(--color-edge),inset_0_-8px_0_var(--color-buzz-muted-pressed)]',
  live: `${RED_BUTTON} shadow-[0_0_0_10px_var(--color-bg),0_0_0_16px_var(--color-edge),inset_0_-18px_0_var(--color-buzz-pressed)] active:translate-y-1 active:shadow-[0_0_0_10px_var(--color-bg),0_0_0_16px_var(--color-edge),inset_0_-8px_0_var(--color-buzz-pressed)] motion-safe:animate-buzz-pulse`,
  pressed: `${RED_BUTTON} translate-y-1 shadow-[0_0_0_10px_var(--color-bg),0_0_0_16px_var(--color-edge),inset_0_-8px_0_var(--color-buzz-pressed)]`,
  won: DEAD_BUTTON,
  lost: DEAD_BUTTON,
  out: DEAD_BUTTON,
  revealed: DEAD_BUTTON,
  final: '',
};

/** The status line's colour above the button. */
const STATUS_LOOK: Record<BuzzerKind, string> = {
  idle: 'text-accent',
  practice: 'text-accent',
  live: 'text-accent',
  pressed: 'text-accent',
  won: 'text-ink [text-shadow:3px_3px_0_var(--color-buzz-ink)]',
  lost: 'text-muted',
  out: 'text-muted',
  revealed: 'text-accent',
  final: '',
};

interface BuzzerProps {
  view: PlayerView;
  /** Sends `player:buzz`, or `player:practice` in the lobby. */
  send: SendPress;
  rename: SendRename;
  leave: SendLeave;
}

/** What covers the buzzer: nothing, the top bar's menu, or the Change name form. */
type Panel = 'menu' | 'rename' | null;

/**
 * The buzzer screen (UI spec, Player view): the player's avatar, name, room and score on top, a
 * row of marquee bulbs, the state as a status line, the round BUZZ button, and their rank.
 */
function Buzzer({ view, send, rename, leave }: BuzzerProps) {
  // The local press belongs to one opening; a new question or reopening clears it.
  const opening = `${view.questionIndex}:${view.openingCounter}`;
  const [pressedAt, setPressedAt] = useState<string | null>(null);
  const countdown = useAnswerCountdown(view);
  const buzzCountdown = useBuzzCountdown(view);
  const state = buzzerState(view, pressedAt === opening, countdown);
  // Counts test buzzes, so each one restarts the ring animation.
  const [practices, setPractices] = useState(0);
  const { toast, show } = useToast();
  const [panel, setPanel] = useState<Panel>(null);
  const [leaving, setLeaving] = useState(false);
  useWakeLock();
  useOutcomeHaptics(view.me.id);
  const inLobby = view.phase === 'LOBBY';
  const enabled = state.live || state.kind === 'practice';

  function press() {
    if (state.kind === 'practice') return practice();
    if (!state.live) return;
    // Feedback first, before the server replies (Buzzer fairness and timing, Client-side speed).
    setPressedAt(opening);
    if ('vibrate' in navigator) navigator.vibrate(30);
    send('player:buzz', (res) => {
      // A refused buzz (rate limit, not joined, offline) frees the button to try again.
      if (res.ok) return;
      setPressedAt((at) => (at === opening ? null : at));
      show(res.error);
    });
  }

  /** A lobby test buzz: the same feedback as a buzz, but the button stays live. */
  function practice() {
    setPractices((count) => count + 1);
    if ('vibrate' in navigator) navigator.vibrate(30);
    send('player:practice', (res) => {
      if (!res.ok) show(res.error);
    });
  }
  function leaveGame() {
    setLeaving(true);
    leave((res) => {
      if (res.ok) return;
      setLeaving(false);
      show(res.error);
    });
  }

  // Space buzzes, except while the menu or the name form is open: there it types and taps.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (panel !== null) {
      if (event.key === 'Escape') setPanel(null);
      return;
    }
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (!event.repeat) press();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    press();
  }

  const inGame = view.questionIndex >= 0;
  const progress = inGame
    ? `Question ${view.questionIndex + 1} of ${view.questionCount}${state.live ? ' · tap to buzz in' : ''}`
    : view.phase === 'LOBBY'
      ? 'You’re in! Waiting for the host'
      : null;

  return (
    <main className="relative flex h-dvh touch-none flex-col overflow-hidden bg-bg select-none [-webkit-touch-callout:none]">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-2">
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-accent font-display text-xl text-accent-ink">
            <span aria-hidden="true">{[...view.me.name][0]?.toUpperCase()}</span>
            {/* Their palette colour, as on the Screen's chips and banner (DECISIONS, Prime Time). */}
            <span
              aria-hidden="true"
              data-player-color
              style={{ backgroundColor: view.me.color }}
              className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-2 ring-bg"
            />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-lg leading-tight font-bold">{view.me.name}</span>
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              <ConnectionDot />
              Room {view.code}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            aria-label="Score"
            className={`${PILL} px-4 py-1.5 font-display text-xl tabular-nums`}
          >
            {view.me.score}
          </span>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={panel === 'menu'}
            aria-controls="player-menu"
            onClick={() => setPanel((open) => (open === 'menu' ? null : 'menu'))}
            className={`${PILL} grid size-11 place-items-center text-muted`}
          >
            <Icon name="more" />
          </button>
        </span>
      </header>
      {panel === 'menu' && (
        <>
          {/* Any tap outside closes the menu, and never reaches the buzzer underneath. */}
          <div
            aria-hidden="true"
            data-menu-backdrop
            onPointerDown={(event) => {
              event.preventDefault();
              setPanel(null);
            }}
            className="fixed inset-0 z-10"
          />
          <div
            id="player-menu"
            className={`absolute top-16 right-4 z-20 flex w-60 flex-col gap-2 ${CARD} p-3 shadow-[0_8px_24px_var(--color-bg-deep)]`}
          >
            {inLobby && (
              <button
                type="button"
                onClick={() => setPanel('rename')}
                className={`${BUTTON_SECONDARY} text-left font-bold`}
              >
                Change name
              </button>
            )}
            <ConfirmButton
              label="Leave game"
              confirmLabel="Confirm leave"
              onConfirm={leaveGame}
              disabled={leaving}
              className={`${BUTTON_SECONDARY} flex-1 text-left font-bold`}
            />
          </div>
        </>
      )}
      {panel === 'rename' && inLobby && (
        <RenameForm current={view.me.name} rename={rename} onDone={() => setPanel(null)} />
      )}
      {state.kind === 'final' ? (
        <section
          aria-label="Final result"
          className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <BulbRail count={9} variant="row" />
          <p className={LABEL}>Game over</p>
          <p className="font-display text-6xl text-accent">{state.label}</p>
          <p className="font-display text-3xl">{state.detail}</p>
        </section>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-evenly gap-4 px-4 py-2">
            {/* Room for the winner's panel's 10px ring under the bulbs. */}
            <div className="flex w-full flex-col items-center gap-5">
              <BulbRail count={9} variant="row" />
              <BuzzerStatus state={state} progress={progress} />
            </div>
            <button
              type="button"
              disabled={!enabled}
              data-look={state.kind}
              data-practices={state.kind === 'practice' ? practices : undefined}
              aria-describedby="buzzer-status"
              onPointerDown={onPointerDown}
              onContextMenu={(event) => event.preventDefault()}
              className={`relative grid size-[min(290px,78vw,40dvh)] shrink-0 touch-none place-items-center rounded-full border-[10px] font-display text-[min(60px,20vw,8dvh)] transition-transform duration-75 select-none [-webkit-touch-callout:none] ${BUZZER_LOOK[state.kind]}`}
            >
              {state.kind === 'practice' && practices > 0 && (
                // Keyed by the count, so every test buzz replays the ring.
                <span
                  key={practices}
                  aria-hidden="true"
                  data-practice-ring
                  className="pointer-events-none absolute -inset-[10px] rounded-full border-[6px] border-accent opacity-0 motion-safe:animate-practice-ring"
                />
              )}
              BUZZ
            </button>
            {/* The buzz time left, while the buzzers are open (DECISIONS, F64). */}
            {buzzCountdown && (
              <p
                role="timer"
                aria-label="Buzz time"
                className="flex shrink-0 items-baseline gap-2 font-bold text-muted"
              >
                <span className="font-display text-4xl leading-none text-ink tabular-nums">
                  {buzzCountdown.secondsLeft}
                </span>
                {buzzCountdown.secondsLeft === 1 ? 'second' : 'seconds'} to buzz
              </p>
            )}
          </div>
          {view.lobby && <WhosHere players={view.lobby} meId={view.me.id} />}
          {inGame && (
            <footer className="mx-4 mb-4 flex shrink-0 items-center justify-between rounded-[20px] border-2 border-edge bg-surface px-5 py-3">
              <span className="font-bold text-muted">Your rank</span>
              <span className="font-display text-2xl text-accent">
                {ordinal(view.me.rank)}
                <span className="ml-1.5 font-sans text-base font-bold text-muted">
                  of {view.playerCount}
                </span>
              </span>
            </footer>
          )}
        </>
      )}
      <Toast toast={toast} />
    </main>
  );
}

interface RenameFormProps {
  current: string;
  rename: SendRename;
  onDone: () => void;
}

/**
 * Change name, from the top bar's menu in the lobby: the join form's field and rules over the
 * buzzer. A refusal ("That name is taken") stays on the form, as on the join form.
 */
function RenameForm({ current, rename, onDone }: RenameFormProps) {
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = playerNameSchema.safeParse(name);
    if (!parsed.success) {
      return setError(
        name.trim() === ''
          ? 'Enter your name'
          : (parsed.error.issues[0]?.message ?? 'That name won’t work'),
      );
    }
    if (parsed.data === current) return onDone();
    setError(null);
    setSending(true);
    rename(parsed.data, (res) => {
      setSending(false);
      if (res.ok) return onDone();
      setError(res.error);
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex touch-auto items-center justify-center bg-bg/95 px-4">
      <form
        onSubmit={submit}
        aria-labelledby="rename-heading"
        className={`flex w-full max-w-md flex-col gap-4 ${CARD}`}
      >
        <h2 id="rename-heading" className="font-display text-3xl">
          Change name
        </h2>
        <label htmlFor="new-name" className={LABEL}>
          Your name
        </label>
        <input
          id="new-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          autoComplete="nickname"
          autoCapitalize="words"
          enterKeyHint="done"
          maxLength={PLAYER_NAME_MAX}
          aria-invalid={error !== null}
          aria-describedby={error ? 'rename-error' : undefined}
          className={`${INPUT} text-3xl select-text`}
        />
        {error && (
          <p id="rename-error" role="alert" className="text-lg text-buzz">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onDone} className={`${BUTTON_SECONDARY} flex-1 font-bold`}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={name.trim() === '' || sending}
            className={`${BUTTON_PRIMARY} flex-1 text-xl`}
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * The lobby's "Who's here" list (UI spec, Player view): this phone's own name first, then the
 * others in join order, each in their colour. It scrolls by itself once a big room overflows it.
 */
function WhosHere({ players, meId }: { players: LobbyPlayer[]; meId: string }) {
  const ordered = [
    ...players.filter((player) => player.id === meId),
    ...players.filter((player) => player.id !== meId),
  ];
  return (
    <section
      aria-labelledby="whos-here"
      className="mx-4 mb-4 flex max-h-[24dvh] min-h-0 shrink-0 flex-col gap-2 rounded-[20px] border-2 border-edge bg-surface px-5 py-3"
    >
      <h2 id="whos-here" className={LABEL}>
        Who’s here · {players.length}
      </h2>
      <ul className="flex touch-pan-y flex-wrap gap-2 overflow-y-auto">
        {ordered.map((player) => (
          <li
            key={player.id}
            data-connected={player.connected}
            className={`flex max-w-full items-center gap-2 rounded-full bg-bg py-1 pr-3 pl-1.5 font-bold ${player.connected ? '' : 'opacity-40'}`}
          >
            <span
              aria-hidden="true"
              data-player-color
              style={{ backgroundColor: player.color }}
              className="size-4 shrink-0 rounded-full"
            />
            <span className="truncate">{player.name}</span>
            {player.id === meId && <span className="text-sm text-muted">(you)</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The state above the button: a gold line, a muted one with a red X when locked out, the winner's
 * red panel in the stage ring, or the revealed answer in a card.
 */
function BuzzerStatus({ state, progress }: { state: BuzzerState; progress: string | null }) {
  const heading = (
    <h1
      id="buzzer-status"
      className={`flex items-center justify-center gap-2 text-center font-display break-words ${
        state.label.length > 40 ? 'text-xl' : 'text-[30px] leading-tight'
      } ${STATUS_LOOK[state.kind]}`}
    >
      {state.kind === 'out' && <Icon name="x" className="size-8 text-buzz" />}
      <span className="min-w-0">{state.label}</span>
    </h1>
  );
  if (state.kind === 'won') {
    return (
      <section
        aria-label="Your turn"
        className="flex w-full max-w-sm flex-col items-center gap-1 rounded-[20px] bg-buzz px-5 py-4 shadow-[0_0_0_6px_var(--color-bg),0_0_0_10px_var(--color-accent)]"
      >
        {heading}
        {state.secondsLeft !== undefined && (
          <span
            aria-label="Seconds left"
            className="font-display text-6xl leading-none text-buzz-ink tabular-nums"
          >
            {state.secondsLeft}
          </span>
        )}
      </section>
    );
  }
  if (state.kind === 'revealed') {
    return (
      <section
        aria-label="Answer"
        className={`flex w-full max-w-sm flex-col items-center gap-1 ${CARD} py-4`}
      >
        <p className={LABEL}>Answer</p>
        {heading}
        {state.detail && (
          <span
            className={`font-display text-3xl ${state.detail.startsWith('+') ? 'text-win' : 'text-buzz'}`}
          >
            {state.detail}
          </span>
        )}
      </section>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      {heading}
      {progress && <p className="text-center text-muted">{progress}</p>}
    </div>
  );
}

function PlayMessage({
  title,
  detail,
  link = true,
}: {
  title: string;
  detail?: string;
  link?: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <BulbRail count={9} variant="row" />
      <h1 className="font-display text-4xl">{title}</h1>
      {detail && <p className="text-lg text-muted">{detail}</p>}
      {link && (
        <Link to="/" className="py-2 text-lg text-muted underline underline-offset-4">
          Back to start
        </Link>
      )}
    </main>
  );
}

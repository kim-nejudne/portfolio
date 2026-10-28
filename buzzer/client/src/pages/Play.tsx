import {
  useCallback,
  useEffect,
  useEffectEvent,
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
import type { Ack, PlayerView } from '../../../shared/types.js';
import { BulbRail } from '../components/BulbRail.js';
import { ConnectionDot } from '../components/ConnectionDot.js';
import { Icon } from '../components/Icon.js';
import { Toast, useToast } from '../components/Toast.js';
import { roomExists } from '../lib/api.js';
import { buzzerState, type BuzzerKind, type BuzzerState } from '../lib/buzzerState.js';
import {
  clearPlayer,
  loadPlayer,
  newPlayerId,
  savePlayer,
  type PlayerIdentity,
} from '../lib/playerIdentity.js';
import { ordinal } from '../lib/results.js';
import { isCompleteRoomCode } from '../lib/roomCode.js';
import { useRoomStore } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
import { useRoomSocket, type JoinRoom } from '../lib/useRoomSocket.js';
import { useAnswerCountdown } from '../lib/useAnswerCountdown.js';
import { BUTTON_PRIMARY, CARD, INPUT, LABEL, PILL } from '../lib/ui.js';
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
  // One id per visit, reused if the first name is rejected; saved only once a join succeeds.
  const [playerId] = useState(newPlayerId);

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
}

function PlayerRoom({ code, identity, saved, makeSocket, onJoined, onRejected }: PlayerRoomProps) {
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
  const buzz = useCallback(
    (ack: (res: Ack) => void) => {
      const socket = socketRef.current;
      if (!socket) return ack({ ok: false, error: 'Not connected' });
      socket.emit('player:buzz', {}, ack);
    },
    [socketRef],
  );

  const view = useRoomStore((state) => state.view);
  const error = useRoomStore((state) => state.error);

  // Kicked now, or refused on a rejoin after a kick: the same page either way (UI spec, Player view).
  if (error === PLAYER_KICKED_ERROR) {
    return <PlayMessage title="Removed by host" detail={PLAYER_KICKED_ERROR} />;
  }
  if (error) return <PlayMessage title={error} />;
  if (view?.role !== 'player') return <PlayMessage title="Joining…" link={false} />;
  return <Buzzer view={view} buzz={buzz} />;
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
  /** Sends `player:buzz`. */
  buzz: (ack: (res: Ack) => void) => void;
}

/**
 * The buzzer screen (UI spec, Player view): the player's avatar, name, room and score on top, a
 * row of marquee bulbs, the state as a status line, the round BUZZ button, and their rank.
 */
function Buzzer({ view, buzz }: BuzzerProps) {
  // The local press belongs to one opening; a new question or reopening clears it.
  const opening = `${view.questionIndex}:${view.openingCounter}`;
  const [pressedAt, setPressedAt] = useState<string | null>(null);
  const countdown = useAnswerCountdown(view);
  const state = buzzerState(view, pressedAt === opening, countdown);
  const { toast, show } = useToast();
  useWakeLock();

  function press() {
    if (!state.live) return;
    // Feedback first, before the server replies (Buzzer fairness and timing, Client-side speed).
    setPressedAt(opening);
    if ('vibrate' in navigator) navigator.vibrate(30);
    buzz((res) => {
      // A refused buzz (rate limit, not joined, offline) frees the button to try again.
      if (res.ok) return;
      setPressedAt((at) => (at === opening ? null : at));
      show(res.error);
    });
  }
  const pressFromKey = useEffectEvent(press);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (!event.repeat) pressFromKey();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    press();
  }

  const inGame = view.questionIndex >= 0;
  const progress = inGame
    ? `Question ${view.questionIndex + 1} of ${view.questionCount}${state.live ? ' · tap to buzz in' : ''}`
    : null;

  return (
    <main className="flex h-dvh touch-none flex-col overflow-hidden bg-bg select-none [-webkit-touch-callout:none]">
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
        <span
          aria-label="Score"
          className={`${PILL} shrink-0 px-4 py-1.5 font-display text-xl tabular-nums`}
        >
          {view.me.score}
        </span>
      </header>
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
            <div className="flex w-full flex-col items-center gap-3">
              <BulbRail count={9} variant="row" />
              <BuzzerStatus state={state} progress={progress} />
            </div>
            <button
              type="button"
              disabled={!state.live}
              data-look={state.kind}
              aria-describedby="buzzer-status"
              onPointerDown={onPointerDown}
              onContextMenu={(event) => event.preventDefault()}
              className={`grid size-[min(290px,78vw,40dvh)] shrink-0 touch-none place-items-center rounded-full border-[10px] font-display text-[min(60px,20vw,8dvh)] transition-transform duration-75 select-none [-webkit-touch-callout:none] ${BUZZER_LOOK[state.kind]}`}
            >
              BUZZ
            </button>
          </div>
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

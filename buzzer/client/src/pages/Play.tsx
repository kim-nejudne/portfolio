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
  ROOM_NOT_FOUND_ERROR,
} from '../../../shared/constants.js';
import { playerNameSchema } from '../../../shared/schemas.js';
import type { Ack, PlayerView } from '../../../shared/types.js';
import { ConnectionDot } from '../components/ConnectionDot.js';
import { Toast, useToast } from '../components/Toast.js';
import { roomExists } from '../lib/api.js';
import { buzzerState, type BuzzerKind } from '../lib/buzzerState.js';
import {
  clearPlayer,
  loadPlayer,
  newPlayerId,
  savePlayer,
  type PlayerIdentity,
} from '../lib/playerIdentity.js';
import { isCompleteRoomCode } from '../lib/roomCode.js';
import { useRoomStore } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
import { useRoomSocket, type JoinRoom } from '../lib/useRoomSocket.js';
import { useAnswerCountdown } from '../lib/useAnswerCountdown.js';
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
      return <PlayMessage title="Can’t reach the game" detail={step.error} />;
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
        className="flex flex-col gap-4 rounded-3xl border-2 border-edge bg-surface p-6"
      >
        <h1 id="name-heading" className="font-display text-3xl">
          Join room <span className="tracking-[0.15em] text-accent">{code}</span>
        </h1>
        <label htmlFor="player-name" className="text-lg text-muted">
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
          className="w-full rounded-2xl border-2 border-edge bg-bg px-4 py-3 font-display text-3xl focus:border-accent focus:outline-none"
        />
        {error && (
          <p id="name-error" role="alert" className="text-lg text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={name.trim() === ''}
          className="rounded-2xl bg-accent px-6 py-4 font-display text-2xl text-accent-ink transition not-disabled:active:scale-95 disabled:opacity-40"
        >
          Join
        </button>
      </form>
      <Link to="/" className="text-center text-lg text-muted underline underline-offset-4">
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

const BUZZER_LOOK: Record<BuzzerKind, string> = {
  idle: 'border-edge bg-surface text-muted',
  live: 'motion-safe:animate-buzz-pulse border-buzz-edge bg-buzz text-white',
  pressed: 'scale-90 border-buzz-edge bg-buzz text-white brightness-75',
  won: 'border-win-edge bg-win text-bg',
  lost: 'border-edge bg-surface text-muted opacity-50',
  out: 'border-buzz/60 bg-bg text-muted',
  revealed: 'border-edge bg-surface text-ink',
  final: '',
};

interface BuzzerProps {
  view: PlayerView;
  /** Sends `player:buzz`. */
  buzz: (ack: (res: Ack) => void) => void;
}

/** The whole-viewport buzzer with the player's colour bar on top (UI spec, Player view). */
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

  return (
    <main className="flex h-dvh touch-none flex-col overflow-hidden bg-bg select-none [-webkit-touch-callout:none]">
      <header
        style={{ backgroundColor: view.me.color }}
        className="flex shrink-0 items-center justify-between gap-4 px-4 py-2 font-display text-xl text-bg"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ConnectionDot />
          <span className="truncate">{view.me.name}</span>
        </span>
        <span aria-label="Score">{view.me.score}</span>
      </header>
      {state.kind === 'final' ? (
        <section
          aria-label="Final result"
          className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <p className="text-2xl text-muted">Game over</p>
          <p className="font-display text-6xl">{state.label}</p>
          <p className="font-display text-3xl text-accent">{state.detail}</p>
        </section>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <button
            type="button"
            disabled={!state.live}
            data-look={state.kind}
            onPointerDown={onPointerDown}
            onContextMenu={(event) => event.preventDefault()}
            className={`flex aspect-square w-[min(85vw,70dvh)] touch-none flex-col items-center justify-center gap-2 rounded-full border-8 p-[12%] text-center font-display break-words transition-transform duration-75 select-none [-webkit-touch-callout:none] ${state.label.length > 40 ? 'text-xl' : 'text-3xl'} ${BUZZER_LOOK[state.kind]}`}
          >
            {state.kind === 'out' && (
              <span aria-hidden className="text-7xl leading-none text-buzz">
                ✕
              </span>
            )}
            <span className="max-w-full">{state.label}</span>
            {state.secondsLeft !== undefined && (
              <span aria-label="Seconds left" className="text-7xl leading-none tabular-nums">
                {state.secondsLeft}
              </span>
            )}
            {state.detail && (
              <span
                className={`text-4xl ${state.detail.startsWith('+') ? 'text-win' : 'text-buzz'}`}
              >
                {state.detail}
              </span>
            )}
          </button>
        </div>
      )}
      <Toast toast={toast} />
    </main>
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
      <h1 className="font-display text-4xl">{title}</h1>
      {detail && <p className="text-lg text-muted">{detail}</p>}
      {link && (
        <Link to="/" className="text-lg underline underline-offset-4">
          Back to start
        </Link>
      )}
    </main>
  );
}

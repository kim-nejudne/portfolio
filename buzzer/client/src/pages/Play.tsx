import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from 'react';
import { Link, useParams } from 'react-router';
import {
  AVATARS,
  CHOICE_COLORS,
  CHOICE_LETTERS,
  GAME_ENDED_ERROR,
  PLAYER_KICKED_ERROR,
  PLAYER_NAME_MAX,
  ROOM_CHECK_RATE_LIMITED_ERROR,
  ROOM_NOT_FOUND_ERROR,
  TYPED_ANSWER_MAX,
} from '../../../shared/constants.js';
import { playerNameSchema } from '../../../shared/schemas.js';
import type {
  Ack,
  ClientPayloads,
  LobbyPlayer,
  PlayerChoiceView,
  PlayerTypedView,
  PlayerView,
} from '../../../shared/types.js';
import { BulbRail } from '../components/BulbRail.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { ConnectionDot } from '../components/ConnectionDot.js';
import { Icon } from '../components/Icon.js';
import { PlayerAvatar } from '../components/PlayerAvatar.js';
import { ShareResults } from '../components/ShareResults.js';
import { Toast, useToast } from '../components/Toast.js';
import { roomExists } from '../lib/api.js';
import { buzzerState, gotItRight, type BuzzerKind, type BuzzerState } from '../lib/buzzerState.js';
import {
  clearPlayer,
  loadPlayer,
  newPlayerId,
  renamePlayer,
  savePlayer,
  type PlayerIdentity,
} from '../lib/playerIdentity.js';
import { pointsText, rankText, useCopy, type Translate } from '../lib/copy.js';
import { HOVER } from '../lib/hover.js';
import { ordinal } from '../lib/results.js';
import { teamOf } from '../lib/teams.js';
import { cardFromPlayer } from '../lib/resultsCard.js';
import { isCompleteRoomCode } from '../lib/roomCode.js';
import { useRoomStore } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
import { useRoomSocket, type JoinRoom } from '../lib/useRoomSocket.js';
import {
  useAnswerCountdown,
  useBuzzCountdown,
  useAnsweringCountdown,
} from '../lib/useAnswerCountdown.js';
import { useFalseStartWait } from '../lib/useFalseStartWait.js';
import { usePointerFine } from '../lib/usePointerFine.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LABEL, LINK, PILL } from '../lib/ui.js';
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

type Avatar = NonNullable<PlayerIdentity['avatar']>;

function PlayRoom({ code, makeSocket }: { code: string; makeSocket: () => GameSocket }) {
  const [step, setStep] = useState<Step>({ kind: 'checking' });
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<Avatar | null>(null);
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
    // No `avatar` key without one: the join is then exactly as before avatars.
    const identity = avatar
      ? { playerId, name: parsed.data, avatar }
      : { playerId, name: parsed.data };
    setStep({ kind: 'joining', identity, saved: false });
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

  // Back to the join form, with the name and avatar filled in to make coming back one tap.
  const onLeft = useCallback(
    (last: PlayerIdentity) => {
      clearPlayer(code);
      setPlayerId(newPlayerId());
      setName(last.name);
      setAvatar(last.avatar ?? null);
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
        <NameForm
          code={code}
          name={name}
          avatar={avatar}
          error={formError}
          onName={setName}
          onAvatar={setAvatar}
          onSubmit={submit}
        />
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
  avatar: Avatar | null;
  error: string | null;
  onName: (name: string) => void;
  onAvatar: (avatar: Avatar | null) => void;
  onSubmit: (event: FormEvent) => void;
}

function NameForm({ code, name, avatar, error, onName, onAvatar, onSubmit }: NameFormProps) {
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
        <AvatarPicker avatar={avatar} onAvatar={onAvatar} />
        <button
          type="submit"
          disabled={name.trim() === ''}
          className={`${BUTTON_PRIMARY} text-2xl`}
        >
          Join
        </button>
      </form>
      <Link to="/" className={`${LINK} self-center text-lg`}>
        Back to start
      </Link>
    </main>
  );
}

/**
 * The optional avatar on the join form (F75): a grid of the 24 emoji. Tapping the chosen one again
 * clears it, so a player can still join with only their name.
 */
function AvatarPicker({
  avatar,
  onAvatar,
}: {
  avatar: Avatar | null;
  onAvatar: (avatar: Avatar | null) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${LABEL} mb-2`}>Avatar (optional)</legend>
      {/* At least 44px a cell inside the card: 4 across at 320px, 5 from 360px, 6 from 400px (PLY-06). */}
      <div className="grid grid-cols-4 gap-2 min-[360px]:grid-cols-5 min-[400px]:grid-cols-6">
        {AVATARS.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={`Avatar ${option}`}
            aria-pressed={avatar === option}
            onClick={() => onAvatar(avatar === option ? null : option)}
            className={`grid aspect-square place-items-center rounded-[14px] border-2 text-[26px] leading-none ${HOVER} ${
              avatar === option ? 'border-accent bg-accent/20' : 'border-edge bg-bg'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
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
  /** The server removed this player; `identity` is the one they had. */
  onLeft: (identity: PlayerIdentity) => void;
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
  const answer = useCallback<SendAnswer>(
    (payload, ack) => {
      const socket = socketRef.current;
      if (!socket) return ack({ ok: false, error: 'Not connected' });
      socket.emit('player:answer', payload, ack);
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
        if (res.ok) onLeft(identity);
        ack(res);
      });
    },
    [socketRef, onLeft, identity],
  );

  const view = useRoomStore((state) => state.view);
  const error = useRoomStore((state) => state.error);

  // Kicked now, or refused on a rejoin after a kick: the same page either way (UI spec, Player view).
  if (error === PLAYER_KICKED_ERROR) {
    return <PlayMessage title="Removed by host" detail={PLAYER_KICKED_ERROR} />;
  }
  if (error) return <PlayMessage title={error} />;
  if (view?.role !== 'player') return <PlayMessage title="Joining…" link={false} />;
  return <Buzzer view={view} send={press} answer={answer} rename={rename} leave={leave} />;
}

/** Sends a press: a buzz, or a lobby test buzz. */
type SendPress = (event: 'player:buzz' | 'player:practice', ack: (res: Ack) => void) => void;
/** Sends `player:answer`: a choice index, or a typed answer's text. */
type SendAnswer = (answer: ClientPayloads['player:answer'], ack: (res: Ack) => void) => void;
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

/**
 * Vibrates when a choice or typed question this player answered is revealed (UI spec, Player view:
 * vibrate on correct and wrong). The server sends no `fx` at its close (DECISIONS, F85, F87), so
 * this follows the change from ANSWERING to REVEAL; a reconnect straight into REVEAL never replays it.
 */
function useAnswerHaptics(view: PlayerView): void {
  const lastPhase = useRef(view.phase);
  useEffect(() => {
    const was = lastPhase.current;
    lastPhase.current = view.phase;
    if (was !== 'ANSWERING' || view.phase !== 'REVEAL' || !('vibrate' in navigator)) return;
    const mine = view.choice?.mine ?? view.typed?.mine ?? null;
    if (mine === null) return;
    navigator.vibrate(gotItRight(view) ? CORRECT_VIBRATION : WRONG_VIBRATION);
  }, [view]);
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
  // The choice buttons or the text box replace the buzzer then; these looks are never drawn.
  choice: DEAD_BUTTON,
  typed: DEAD_BUTTON,
  // Live but muted: no pulse, a darker red, the same press-in.
  // Amber and pressed in: the press before the opening was noted, and the wait is on (F72).
  early:
    'translate-y-1 border-warn bg-warn text-bg shadow-[0_0_0_10px_var(--color-bg),0_0_0_16px_var(--color-edge),inset_0_-8px_0_rgb(0_0_0/0.25)]',
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
  choice: 'text-accent',
  typed: 'text-accent',
  practice: 'text-accent',
  early: 'text-warn',
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
  answer: SendAnswer;
  rename: SendRename;
  leave: SendLeave;
}

/**
 * What covers the buzzer: nothing, the top bar's menu, the Change name form, or (on a landscape
 * phone) the lobby list opened from its pill.
 */
type Panel = 'menu' | 'rename' | 'whosHere' | null;

/**
 * The buzzer screen (UI spec, Player view): the player's avatar, name, room and score on top, a
 * row of marquee bulbs, the state as a status line, the round BUZZ button, and their rank.
 */
function Buzzer({ view, send, answer, rename, leave }: BuzzerProps) {
  // The local press belongs to one opening; a new question or reopening clears it.
  const opening = `${view.questionIndex}:${view.openingCounter}`;
  const [pressedAt, setPressedAt] = useState<string | null>(null);
  // The local pick on a choice question, shown before the server's `mine` arrives; per opening.
  const [pick, setPick] = useState<{ opening: string; choice: number } | null>(null);
  const picked = (pick?.opening === opening ? pick.choice : null) ?? view.choice?.mine ?? null;
  const countdown = useAnswerCountdown(view);
  const buzzCountdown = useBuzzCountdown(view);
  const answeringCountdown = useAnsweringCountdown(view);
  const held = useFalseStartWait(view, view.falseStartMs, view.falseStart);
  const pointerFine = usePointerFine();
  const state = buzzerState(view, pressedAt === opening, countdown, held, picked, pointerFine);
  // Counts test buzzes, so each one restarts the ring animation.
  const [practices, setPractices] = useState(0);
  const { toast, show } = useToast();
  const [panel, setPanel] = useState<Panel>(null);
  const [leaving, setLeaving] = useState(false);
  // The opening whose typed answer box has focus: on a short screen the stage then makes room for
  // the box (PLY-03). Per opening, so a box that unmounts while focused leaves no trace.
  const [typingAt, setTypingAt] = useState<string | null>(null);
  const typing = typingAt === opening && view.typed !== null;
  useWakeLock();
  useOutcomeHaptics(view.me.id);
  useAnswerHaptics(view);
  const inLobby = view.phase === 'LOBBY';
  const enabled = state.live || state.kind === 'practice';
  const team = teamOf(view.teams, view.me.id);
  const t = useCopy();

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

  /** A tap on a choice: marked at once, and a different tap changes it until the answering closes. */
  function choose(choice: number) {
    if (state.kind !== 'choice' || choice === picked) return;
    setPick({ opening, choice });
    if ('vibrate' in navigator) navigator.vibrate(30);
    answer({ choice }, (res) => {
      if (res.ok) return;
      // Refused (closed, rate limit, offline): back to what the server has.
      setPick((current) =>
        current?.opening === opening && current.choice === choice ? null : current,
      );
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

  // Space buzzes, except while the menu or the name form is open, or in the typed answer's box:
  // there it types and taps.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (panel !== null) {
      if (event.key === 'Escape') setPanel(null);
      return;
    }
    if (event.target instanceof HTMLInputElement) return;
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
    ? `${t('questionOf', { n: view.questionIndex + 1, count: view.questionCount })}${state.live ? t(pointerFine ? 'clickToBuzzIn' : 'tapToBuzzIn') : ''}`
    : view.phase === 'LOBBY'
      ? t('youreIn')
      : null;

  return (
    <main className="relative flex h-dvh touch-none flex-col overflow-hidden bg-bg select-none [-webkit-touch-callout:none]">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-2 short:pt-2 short:pb-1">
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-accent font-display text-xl text-accent-ink">
            {/* The avatar replaces the initial when the player picked one (F75). */}
            {view.me.avatar ? (
              <PlayerAvatar avatar={view.me.avatar} className="text-2xl" />
            ) : (
              <span aria-hidden="true">{[...view.me.name][0]?.toUpperCase()}</span>
            )}
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
            {/* With teams on, their team's name and colour (UI spec, Player view: top bar; F82). */}
            {team && (
              <span data-team className="flex items-center gap-1.5 text-sm font-bold">
                <span
                  aria-hidden="true"
                  data-team-color
                  style={{ backgroundColor: team.color }}
                  className="size-2.5 shrink-0 rounded-sm"
                />
                <span className="truncate">{t('teamName', { team: team.name })}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <ConnectionDot />
              {t('room', { code: view.code })}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {/* From the first question: "3rd of 8", equal scores sharing a rank (server/ranking.ts). */}
          {inGame && (
            <span
              data-rank
              className="flex flex-col items-end text-sm leading-tight font-bold whitespace-nowrap text-muted"
            >
              <span className="font-display text-lg text-accent">{ordinal(view.me.rank)}</span>{' '}
              {t('of')} {view.playerCount}
            </span>
          )}
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
            className={`${PILL} grid size-11 place-items-center text-muted ${HOVER}`}
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
                {t('changeName')}
              </button>
            )}
            <ConfirmButton
              label={t('leaveGame')}
              confirmLabel={t('confirmLeave')}
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
      {panel === 'whosHere' && view.lobby && (
        <>
          <div
            aria-hidden="true"
            data-menu-backdrop
            onPointerDown={(event) => {
              event.preventDefault();
              setPanel(null);
            }}
            className="fixed inset-0 z-10"
          />
          <WhosHere
            players={view.lobby}
            meId={view.me.id}
            id="whos-here-popover"
            className="absolute top-2 left-4 z-20 max-h-[calc(100dvh-1rem)] w-[min(24rem,calc(100%-2rem))] touch-auto shadow-[0_8px_24px_var(--color-bg-deep)]"
          />
        </>
      )}
      {state.kind === 'final' ? (
        // Scrolls when it runs taller than the window, as on a landscape phone, so Share stays
        // reachable (PLY-02).
        <section
          aria-label="Final result"
          data-final
          className="flex min-h-0 flex-1 touch-pan-y flex-col items-center justify-center-safe gap-4 overflow-y-auto p-6 text-center short:gap-2 short:py-3"
        >
          <BulbRail count={9} variant="row" />
          <p className={LABEL}>{t('gameOver')}</p>
          {/* Side by side on a short screen. */}
          <div className="flex flex-col items-center gap-4 short:flex-row short:items-baseline short:gap-6">
            <p className="font-display text-6xl text-accent short:text-5xl">{state.label}</p>
            <p className="font-display text-3xl">{state.detail}</p>
          </div>
          {/* With teams on, how their team finished (F82). */}
          {team && view.teams && (
            <p aria-label="Team" className="mt-2 flex flex-col gap-1 text-lg text-muted">
              <span className={LABEL}>{t('teamName', { team: team.name })}</span>
              <span className="flex items-center justify-center gap-2 font-display text-2xl text-ink">
                <span
                  aria-hidden="true"
                  data-team-color
                  style={{ backgroundColor: team.color }}
                  className="size-3.5 shrink-0 rounded-sm"
                />
                {t('teamRank', {
                  rank: ordinal(team.rank),
                  count: view.teams.length,
                  points: pointsText(t, team.score),
                })}
              </span>
            </p>
          )}
          {/* From game 2, the night so far (F77). */}
          {view.tonight && (
            <p aria-label="Tonight" className="mt-2 flex flex-col gap-1 text-lg text-muted">
              <span className={LABEL}>{t('tonight')}</span>
              <span className="font-display text-2xl text-ink">
                {rankText(t, view.tonight.rank, view.tonight.count)} ·{' '}
                {pointsText(t, view.tonight.total)}
              </span>
            </p>
          )}
          {view.results && (
            <ShareResults
              card={() => cardFromPlayer(view, new Date())}
              mode="share"
              className={`${BUTTON_SECONDARY} mt-2 w-full max-w-xs font-bold`}
            />
          )}
        </section>
      ) : (
        <>
          {/*
            On a short screen (a landscape phone) the stage is two columns (PLY-01): the bulbs,
            status and countdowns on the left, the buzzer or the answers on the right. The spacer
            rows centre the left column; while the typed answer has focus they give way, so the
            box sits at the top. The stage scrolls there rather than clip.
          */}
          <div
            data-stage
            className={`flex min-h-0 flex-1 flex-col items-center justify-evenly gap-4 px-4 py-2 short:grid short:touch-pan-y short:gap-x-6 short:gap-y-3 short:overflow-y-auto ${
              view.choice || view.typed
                ? 'short:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'
                : 'short:grid-cols-[minmax(0,1fr)_auto]'
            } ${typing ? 'short:grid-rows-[0_auto_auto_1fr]' : 'short:grid-rows-[1fr_auto_auto_1fr]'}`}
          >
            {/* Room for the winner's panel's 10px ring under the bulbs. */}
            <div
              data-status-column
              className="flex w-full flex-col items-center gap-5 short:col-start-1 short:row-start-2 short:gap-3 short:px-3"
            >
              <BulbRail count={9} variant="row" className={typing ? 'short:hidden' : ''} />
              <BuzzerStatus state={state} progress={progress} compact={typing} />
              {view.lobby && (
                <button
                  type="button"
                  aria-expanded={panel === 'whosHere'}
                  aria-controls="whos-here-popover"
                  onClick={() => setPanel((open) => (open === 'whosHere' ? null : 'whosHere'))}
                  className={`${PILL} hidden min-h-11 items-center gap-2 px-4 font-bold short:inline-flex ${HOVER}`}
                >
                  {t('hereCount', { n: view.lobby.length })}
                  <Icon name="chevron-down" className="size-5 text-muted" />
                </button>
              )}
            </div>
            {view.choice ? (
              <ChoiceButtons
                className={ANSWER_CELL}
                choice={view.choice}
                picked={picked}
                enabled={state.kind === 'choice'}
                onPick={choose}
              />
            ) : view.typed ? (
              // Keyed by the opening, so a new question starts with an empty box.
              <TypedAnswer
                key={opening}
                className={`${ANSWER_CELL} ${typing ? 'short:row-start-2 short:row-end-4 short:self-start' : ''}`}
                typed={view.typed}
                enabled={state.kind === 'typed' && !view.typed.closed}
                answer={answer}
                onRefused={show}
                onTyping={(focused) => setTypingAt(focused ? opening : null)}
              />
            ) : (
              <button
                type="button"
                disabled={!enabled}
                data-look={state.kind}
                data-practices={state.kind === 'practice' ? practices : undefined}
                aria-describedby="buzzer-status"
                onPointerDown={onPointerDown}
                onContextMenu={(event) => event.preventDefault()}
                className={`relative grid size-[min(290px,78vw,40dvh)] shrink-0 touch-none place-items-center rounded-full border-[10px] font-display text-[min(60px,20vw,8dvh)] transition-transform ${ANSWER_CELL} short:size-[min(70dvh,42vw)] short:text-[min(60px,16dvh)] duration-75 select-none [-webkit-touch-callout:none] ${BUZZER_LOOK[state.kind]}`}
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
            )}
            {(buzzCountdown || answeringCountdown) && (
              <div className="flex flex-col items-center gap-4 short:col-start-1 short:row-start-3">
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
                    {t(buzzCountdown.secondsLeft === 1 ? 'secondToBuzz' : 'secondsToBuzz')}
                  </p>
                )}
                {/* The time left to answer a choice or typed question (F86, F88). */}
                {answeringCountdown && (
                  <p
                    role="timer"
                    aria-label="Time to answer"
                    className="flex shrink-0 items-baseline gap-2 font-bold text-muted"
                  >
                    <span className="font-display text-4xl leading-none text-ink tabular-nums">
                      {answeringCountdown.secondsLeft}
                    </span>
                    {t(answeringCountdown.secondsLeft === 1 ? 'secondToAnswer' : 'secondsToAnswer')}
                  </p>
                )}
              </div>
            )}
          </div>
          {/* On a short screen it folds into the pill above. */}
          {view.lobby && (
            <WhosHere
              players={view.lobby}
              meId={view.me.id}
              className="mx-4 mb-4 max-h-[24dvh] shrink-0 short:hidden"
            />
          )}
        </>
      )}
      <Toast toast={toast} />
    </main>
  );
}

/** The right-hand cell of the short-screen stage: the buzzer, the choices or the typed answer. */
const ANSWER_CELL = 'short:col-start-2 short:row-span-4 short:row-start-1 short:self-center';

interface ChoiceButtonsProps {
  className: string;
  choice: PlayerChoiceView;
  /** This player's pick: the local tap, else the server's `mine`. */
  picked: number | null;
  /** Answers are being taken (ANSWERING). Before that the buttons preview the choices. */
  enabled: boolean;
  onPick: (choice: number) => void;
}

/**
 * A choice question on the phone (UI spec, Player view): one big lettered button per choice, in
 * its tile colour, with the choice text. The pick stays marked "Your pick". At REVEAL the correct
 * one gets a check and the others dim; the view has no correct choice before then.
 */
function ChoiceButtons({ className, choice, picked, enabled, onPick }: ChoiceButtonsProps) {
  const revealed = choice.correctChoice !== undefined;
  const t = useCopy();
  return (
    <ol
      aria-label="Choices"
      // A 2×2 grid on a short screen, so four choices fit without the inner scroll (PLY-04).
      className={`flex min-h-0 w-full max-w-sm shrink touch-auto flex-col gap-3 overflow-y-auto p-1 short:grid short:max-w-none short:grid-cols-2 short:gap-2 short:overflow-visible ${className}`}
    >
      {choice.choices.map((text, index) => {
        const mine = picked === index;
        const correct = revealed && index === choice.correctChoice;
        return (
          <li key={index}>
            <button
              type="button"
              aria-pressed={mine}
              disabled={!enabled}
              data-correct={correct || undefined}
              onClick={() => onPick(index)}
              style={{ backgroundColor: CHOICE_COLORS[index] }}
              className={`relative flex min-h-16 w-full items-center gap-3 rounded-2xl border-4 px-3 py-2.5 text-left text-lg leading-snug short:h-full short:min-h-14 short:gap-2 short:px-2 short:py-1.5 short:text-base font-bold text-bg transition not-disabled:active:scale-[0.98] not-disabled:hover:hover-tint ${
                mine ? 'border-ink shadow-[0_0_0_3px_var(--color-bg)]' : 'border-transparent'
              } ${correct ? 'ring-4 ring-accent ring-offset-2 ring-offset-bg' : ''} ${
                (revealed && !correct) || (!revealed && !enabled) ? 'opacity-50' : ''
              }`}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-bg font-display text-2xl text-ink short:size-9 short:text-xl">
                {CHOICE_LETTERS[index]}
              </span>
              <span className="min-w-0 flex-1 break-words">{text}</span>
              {correct && (
                <>
                  <span className="sr-only">, correct</span>
                  <Icon name="check" className="size-7 shrink-0" />
                </>
              )}
              {mine && (
                // On a short screen's narrow tile, the badge sits on the top edge.
                <span className="shrink-0 rounded-full bg-bg px-2.5 py-1 text-sm whitespace-nowrap text-ink short:absolute short:-top-3 short:right-2 short:py-0">
                  {t('yourPick')}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

interface TypedAnswerProps {
  className: string;
  typed: PlayerTypedView;
  /** Answers are being taken and not yet locked. Before and after, the box shows but is disabled. */
  enabled: boolean;
  answer: SendAnswer;
  onRefused: (error: string) => void;
  /** The box took or lost focus. */
  onTyping: (focused: boolean) => void;
}

/**
 * A typed question on the phone (UI spec, Player view): a text box and **Send**. The answer can be
 * edited and sent again until the answers lock; the server's `mine` is what counts as sent, so
 * Send is off while the box holds it. Enter sends too.
 */
function TypedAnswer({ className, typed, enabled, answer, onRefused, onTyping }: TypedAnswerProps) {
  const [draft, setDraft] = useState(typed.mine ?? '');
  const [sending, setSending] = useState(false);
  const text = draft.trim();
  const canSend = enabled && !sending && text !== '' && text !== typed.mine;
  const t = useCopy();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    // Drops the keyboard, so the status line above shows "Answer sent".
    const input = event.currentTarget.elements.namedItem('typed-answer');
    if (input instanceof HTMLInputElement) input.blur();
    answer({ text }, (res) => {
      setSending(false);
      if (!res.ok) onRefused(res.error);
    });
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Your answer"
      // One row on a short screen, so the box and Send fit above the keyboard (PLY-03).
      className={`flex w-full max-w-sm shrink-0 touch-auto flex-col gap-3 short:max-w-none short:flex-row ${className}`}
    >
      <label htmlFor="typed-answer" className="sr-only">
        {t('yourAnswer')}
      </label>
      <input
        id="typed-answer"
        name="typed-answer"
        // Once locked, the box shows what the server has, not an edit that was never sent.
        value={enabled ? draft : (typed.mine ?? '')}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => {
          onTyping(true);
          event.currentTarget.scrollIntoView({ block: 'nearest' });
        }}
        onBlur={() => onTyping(false)}
        disabled={!enabled}
        placeholder={enabled ? t('typeYourAnswer') : ''}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        maxLength={TYPED_ANSWER_MAX}
        className={`${INPUT} min-w-0 text-2xl select-text disabled:opacity-60 short:flex-1 short:text-xl`}
      />
      {/* At REVEAL the box stays as a record of the answer; there is nothing left to send. */}
      {typed.groups === undefined && (
        <button
          type="submit"
          disabled={!canSend}
          className={`${BUTTON_PRIMARY} text-2xl short:shrink-0 short:py-3 short:text-xl`}
        >
          {t('send')}
        </button>
      )}
    </form>
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
  const t = useCopy();

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = playerNameSchema.safeParse(name);
    if (!parsed.success) {
      return setError(nameError(t, name, parsed.error.issues[0]?.message));
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
    // Scrolls, so Save stays reachable with the keyboard open (PLY-05).
    <div
      data-rename-overlay
      className="fixed inset-0 z-20 flex touch-auto items-center-safe justify-center overflow-y-auto bg-bg/95 px-4 py-4 short:items-start"
    >
      <form
        onSubmit={submit}
        aria-labelledby="rename-heading"
        className={`flex w-full max-w-md flex-col gap-4 ${CARD}`}
      >
        <h2 id="rename-heading" className="font-display text-3xl">
          {t('changeName')}
        </h2>
        <label htmlFor="new-name" className={LABEL}>
          {t('yourName')}
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
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={name.trim() === '' || sending}
            className={`${BUTTON_PRIMARY} flex-1 text-xl`}
          >
            {t('save')}
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
function WhosHere({
  players,
  meId,
  id,
  className,
}: {
  players: LobbyPlayer[];
  meId: string;
  id?: string;
  className: string;
}) {
  const headingId = useId();
  const ordered = [
    ...players.filter((player) => player.id === meId),
    ...players.filter((player) => player.id !== meId),
  ];
  const t = useCopy();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`flex min-h-0 flex-col gap-2 rounded-[20px] border-2 border-edge bg-surface px-5 py-3 ${className}`}
    >
      <h2 id={headingId} className={LABEL}>
        {t('whosHere', { n: players.length })}
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
            <PlayerAvatar avatar={player.avatar} />
            <span className="truncate">{player.name}</span>
            {player.id === meId && <span className="text-sm text-muted">{t('you')}</span>}
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
function BuzzerStatus({
  state,
  progress,
  compact,
}: {
  state: BuzzerState;
  progress: string | null;
  /** The typed answer has focus: on a short screen, one smaller line (PLY-03). */
  compact: boolean;
}) {
  const t = useCopy();
  const heading = (
    <h1
      id="buzzer-status"
      className={`flex items-center justify-center gap-2 text-center font-display break-words ${
        state.label.length > 40 ? 'text-xl' : 'text-[30px] leading-tight'
      } ${compact ? 'short:text-xl' : ''} ${STATUS_LOOK[state.kind]}`}
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
        <p className={LABEL}>{state.caption ?? t('answer')}</p>
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
      {progress && (
        <p className={`text-center text-muted ${compact ? 'short:hidden' : ''}`}>{progress}</p>
      )}
    </div>
  );
}

/**
 * Change name's refusal: an empty name, else the name rule's message. The rule's messages come
 * from the shared schema and stay English, like the server's errors (DECISIONS, F91).
 */
function nameError(t: Translate, name: string, ruleMessage: string | undefined): string {
  return name.trim() === '' ? t('enterYourName') : (ruleMessage ?? t('nameWontWork'));
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
        <Link to="/" className={`${LINK} text-lg`}>
          Back to start
        </Link>
      )}
    </main>
  );
}

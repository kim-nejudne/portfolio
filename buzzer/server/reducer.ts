// The game logic: a pure `reduce(room, action, now) → {room, effects}`. See "Game flow and state
// machine" in docs/SPEC.md. No I/O, timers, clocks or randomness: the gateway supplies `now` and
// runs the returned effects.

import {
  COLLECTION_WINDOW_MS,
  GAME_ENDED_ERROR,
  MAX_PLAYERS_PER_ROOM,
  NAME_TAKEN_ERROR,
  PLAYER_KICKED_ERROR,
  PLAYER_PALETTE,
  REOPEN_DELAY_MS,
} from '../shared/constants.js';
import type {
  Buzz,
  Fx,
  JudgeResult,
  Phase,
  Player,
  QuestionSet,
  Room,
  RoomSettings,
} from '../shared/types.js';
import { buzzGaps, inWindow, makeBuzz, rankOpening } from './fairness.js';

/** The error for an action the transitions table does not list for the current phase. */
export const WRONG_PHASE_ERROR = 'Not allowed in this phase';

/** Phases before the answer is shown. `host:reveal` accepts these; `host:prev` also accepts REVEAL. */
const QUESTION_PHASES: readonly Phase[] = ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED'];

/** Phases where a buzz counts towards the winner. */
const OPEN_PHASES: readonly Phase[] = ['OPEN', 'COLLECTING'];

/** Phases that take a buzz: OPEN and COLLECTING count, BUZZED records a late one (DECISIONS #4). */
const BUZZ_PHASES: readonly Phase[] = [...OPEN_PHASES, 'BUZZED'];

/** Phases a judged question can be in, so `host:undo` accepts them (DECISIONS #6). */
const UNDO_PHASES: readonly Phase[] = ['OPEN', 'COLLECTING', 'BUZZED', 'REVEAL'];

/**
 * A scheduled action. The gateway dispatches it when its timer fires; it carries the question
 * index and opening counter so the reducer can ignore it once the room has moved on. `reopen`
 * and `answerTimeUp` also carry their `at`, which must still equal `room.reopenAt` or
 * `room.answerTimer.endsAt`: an undo and a second judgement reuse the index and counter
 * (DECISIONS F20).
 */
export type TimerAction =
  | { type: 'windowClosed'; questionIndex: number; openingCounter: number }
  | { type: 'reopen'; questionIndex: number; openingCounter: number; at: number }
  | { type: 'answerTimeUp'; questionIndex: number; openingCounter: number; at: number };

/**
 * Everything the reducer accepts. Client events arrive here after the gateway has checked auth
 * and parsed the payload with zod, and `host:newGame` the same way from the HTTP route;
 * `player:disconnect` and timer actions come from the gateway itself. `receivedAt` is the
 * gateway's monotonic `performance.now()` at arrival (DECISIONS F05).
 */
export type Action =
  | { type: 'player:join'; playerId: string; name: string }
  | { type: 'player:disconnect'; playerId: string }
  | { type: 'player:buzz'; playerId: string; receivedAt: number }
  | { type: 'player:practice'; playerId: string }
  | { type: 'player:rename'; playerId: string; name: string }
  | { type: 'player:leave'; playerId: string }
  | TimerAction
  | { type: 'host:start' }
  | { type: 'host:open' }
  | { type: 'host:judge'; result: JudgeResult }
  | { type: 'host:reveal' }
  | { type: 'host:next' }
  | { type: 'host:prev' }
  | { type: 'host:end' }
  | { type: 'host:scoreboard'; show: boolean }
  | { type: 'host:undo' }
  | { type: 'host:adjustScore'; playerId: string; delta: number }
  | { type: 'host:kick'; playerId: string }
  | { type: 'host:settings'; settings: Partial<RoomSettings> }
  | { type: 'host:newGame'; set: QuestionSet; keepScores: boolean };

/**
 * Work for the gateway: `fx` is broadcast to the room's sockets; `schedule` dispatches `action`
 * at wall-clock `at` ms; `log` writes a counted buzz to the server log (fairness rules).
 */
export type Effect =
  | { type: 'fx'; fx: Fx }
  | { type: 'schedule'; at: number; action: TimerAction }
  | { type: 'log'; questionIndex: number; openingCounter: number; buzz: Buzz };

export type ReduceResult =
  { ok: true; room: Room; effects: Effect[] } | { ok: false; error: string };

/**
 * Applies `action` to `room` at `now` (wall-clock ms, as `Date.now` gives; DECISIONS F05).
 * Never mutates `room`. A rejected action returns an error and no room. An ignored action (a
 * buzz that does not count, a stale timer) returns the same `room` object, unstamped.
 */
export function reduce(room: Room, action: Action, now: number): ReduceResult {
  const result = apply(room, action, now);
  if (!result.ok || result.room === room) return result;
  return { ...result, room: { ...result.room, lastActivityAt: now } };
}

function apply(room: Room, action: Action, now: number): ReduceResult {
  switch (action.type) {
    case 'player:join':
      return playerJoin(room, action, now);
    case 'player:disconnect':
      return playerDisconnect(room, action);
    case 'player:buzz':
      return playerBuzz(room, action, now);
    case 'player:practice':
      return playerPractice(room, action);
    case 'player:rename':
      return playerRename(room, action);
    case 'player:leave':
      return playerLeave(room, action);
    case 'windowClosed':
      return windowClosed(room, action, now);
    case 'answerTimeUp':
      return answerTimeUp(room, action);
    case 'reopen':
      return reopen(room, action);
    case 'host:start':
      return hostStart(room);
    case 'host:open':
      return hostOpen(room);
    case 'host:judge':
      return hostJudge(room, action, now);
    case 'host:reveal':
      return hostReveal(room);
    case 'host:next':
      return hostNext(room);
    case 'host:prev':
      return hostPrev(room);
    case 'host:end':
      return done({ ...room, phase: 'FINAL', answerTimer: null });
    case 'host:scoreboard':
      return done({ ...room, showScoreboard: action.show });
    case 'host:undo':
      return hostUndo(room);
    case 'host:adjustScore':
      return hostAdjustScore(room, action);
    case 'host:kick':
      return hostKick(room, action);
    case 'host:settings':
      return hostSettings(room, action);
    case 'host:newGame':
      return hostNewGame(room, action);
    default:
      return fail('Unknown action');
  }
}

function playerJoin(
  room: Room,
  { playerId, name }: Extract<Action, { type: 'player:join' }>,
  now: number,
): ReduceResult {
  if (room.kickedIds.includes(playerId)) return fail(PLAYER_KICKED_ERROR);

  const existing = room.players[playerId];
  if (existing) {
    // A reconnect keeps the stored name, score and colour (DECISIONS F05). Lockout lives on the room.
    return done(withPlayer(room, { ...existing, connected: true }));
  }

  // SPEC-QUESTION: the spec allows mid-game joins but says nothing about FINAL; see DECISIONS (F05).
  if (room.phase === 'FINAL') return fail(GAME_ENDED_ERROR);

  const players = Object.values(room.players);
  if (players.length >= MAX_PLAYERS_PER_ROOM) return fail('This game is full');

  if (nameTaken(players, name)) return fail(NAME_TAKEN_ERROR);

  const player: Player = {
    id: playerId,
    name,
    color: nextColor(players),
    score: 0,
    connected: true,
    rttMs: 0,
    joinedAt: now,
    // SPEC-QUESTION: "can buzz from the next opening"; see DECISIONS (F14).
    joinedAtOpening: room.openingCounter,
  };
  return done(withPlayer(room, player), [{ type: 'fx', fx: { kind: 'join', playerId } }]);
}

function playerDisconnect(
  room: Room,
  { playerId }: Extract<Action, { type: 'player:disconnect' }>,
): ReduceResult {
  const player = room.players[playerId];
  if (!player) return fail('Unknown player');
  return done(withPlayer(room, { ...player, connected: false }));
}

function playerBuzz(
  room: Room,
  { playerId, receivedAt }: Extract<Action, { type: 'player:buzz' }>,
  now: number,
): ReduceResult {
  const player = room.players[playerId];
  if (!player) return fail('Unknown player');
  // Anything that does not count is ignored silently: no error, no penalty (fairness rules).
  if (!BUZZ_PHASES.includes(room.phase) || !eligible(room, player)) return done(room);

  const buzz = makeBuzz(playerId, receivedAt, player.rttMs);
  const { questionIndex, openingCounter } = room;
  const log: Effect = { type: 'log', questionIndex, openingCounter, buzz };
  const buzzes = [...room.buzzes, buzz];

  if (room.phase === 'OPEN') {
    const action: TimerAction = { type: 'windowClosed', questionIndex, openingCounter };
    // The window is measured from this buzz's monotonic arrival (DECISIONS F39).
    return done({ ...room, phase: 'COLLECTING', buzzes, windowStartedAt: receivedAt }, [
      { type: 'schedule', at: now + COLLECTION_WINDOW_MS, action },
      log,
    ]);
  }
  // COLLECTING joins the window, unless a late timer let it arrive after 150 ms. BUZZED records a
  // late buzz for the also-buzzed list only; it can never win, because the winner is fixed
  // (DECISIONS #4).
  return done({ ...room, buzzes }, [log]);
}

/**
 * A test buzz in the lobby. It changes nothing, so the same room object comes back: no broadcast
 * and no activity stamp, only `fx practice` (DECISIONS F59).
 */
function playerPractice(
  room: Room,
  { playerId }: Extract<Action, { type: 'player:practice' }>,
): ReduceResult {
  if (!room.players[playerId]) return fail('Unknown player');
  if (room.phase !== 'LOBBY') return fail(WRONG_PHASE_ERROR);
  return done(room, [{ type: 'fx', fx: { kind: 'practice', playerId } }]);
}

/**
 * LOBBY only, so the Screen's history of who buzzed never changes names mid-game. The name is
 * already trimmed and length-checked by zod; the duplicate check is the join's, ignoring the
 * player's own name, so a change of case goes through (DECISIONS F61).
 */
function playerRename(
  room: Room,
  { playerId, name }: Extract<Action, { type: 'player:rename' }>,
): ReduceResult {
  const player = room.players[playerId];
  if (!player) return fail('Unknown player');
  if (room.phase !== 'LOBBY') return fail(WRONG_PHASE_ERROR);
  const others = Object.values(room.players).filter((p) => p.id !== playerId);
  if (nameTaken(others, name)) return fail(NAME_TAKEN_ERROR);
  return done(withPlayer(room, { ...player, name }));
}

/**
 * Any phase. The player goes as after a kick, buzz winner included, but the id is not added to
 * `kickedIds`: the device may come back as a new player (DECISIONS F61).
 */
function playerLeave(
  room: Room,
  { playerId }: Extract<Action, { type: 'player:leave' }>,
): ReduceResult {
  if (!room.players[playerId]) return fail('Unknown player');
  return done(withoutPlayer(room, playerId));
}

/** Names are unique in a room, ignoring case. */
function nameTaken(players: Player[], name: string): boolean {
  const key = name.toLowerCase();
  return players.some((p) => p.name.toLowerCase() === key);
}

/**
 * Whether a press from `playerId` now would count towards the winner: buzzers open and the player
 * eligible. Drives the Player's buzzer (`PlayerView.canBuzz`).
 */
export function canBuzz(room: Room, playerId: string): boolean {
  const player = room.players[playerId];
  return OPEN_PHASES.includes(room.phase) && player !== undefined && eligible(room, player);
}

/** The player is not locked out, has not buzzed this opening, and joined before it. */
function eligible(room: Room, player: Player): boolean {
  return (
    !room.lockedOut.includes(player.id) &&
    !room.buzzes.some((b) => b.playerId === player.id) &&
    player.joinedAtOpening !== room.openingCounter
  );
}

function windowClosed(
  room: Room,
  { questionIndex, openingCounter }: TimerAction,
  now: number,
): ReduceResult {
  // Phase + index + counter rejects every stale timer (DECISIONS F13).
  const fresh =
    room.phase === 'COLLECTING' &&
    room.questionIndex === questionIndex &&
    room.openingCounter === openingCounter;
  if (!fresh) return done(room);
  // Only a buzz inside the window can win; a later one is ranked after it (DECISIONS F39).
  const ranked = rankOpening(room.buzzes, room.players, room.windowStartedAt);
  const winner = ranked[0];
  // A kick can leave only late buzzes: the window is empty, so it reopens, as after an emptying kick.
  if (!winner || !inWindow(winner, room.windowStartedAt)) {
    return done(openBuzzers({ ...room, winnerId: null }));
  }

  const fx: Fx = { kind: 'buzz', playerId: winner.playerId, gaps: buzzGaps(ranked) };
  const buzzed: Room = { ...room, phase: 'BUZZED', winnerId: winner.playerId };
  const seconds = room.settings.answerSeconds;
  if (seconds === 0) return done(buzzed, [{ type: 'fx', fx }]);

  // The winner's answer time starts now; the setting is read here, so a change mid-countdown
  // waits for the next buzz.
  const at = now + seconds * 1000;
  return done({ ...buzzed, answerTimer: { seconds, endsAt: at, up: false } }, [
    { type: 'fx', fx },
    { type: 'schedule', at, action: { type: 'answerTimeUp', questionIndex, openingCounter, at } },
  ]);
}

/**
 * The winner's answer time ran out: mark it up and tell the devices. Nothing is judged; the host
 * still decides. Stale unless the room is still waiting on that same timer (DECISIONS F35).
 */
function answerTimeUp(
  room: Room,
  { questionIndex, openingCounter, at }: Extract<TimerAction, { type: 'answerTimeUp' }>,
): ReduceResult {
  const { winnerId, answerTimer: timer } = room;
  const fresh =
    room.phase === 'BUZZED' &&
    room.reopenAt === null &&
    winnerId !== null &&
    timer !== null &&
    !timer.up &&
    timer.endsAt === at &&
    room.questionIndex === questionIndex &&
    room.openingCounter === openingCounter;
  if (!fresh) return done(room);
  return done({ ...room, answerTimer: { ...timer, up: true } }, [
    { type: 'fx', fx: { kind: 'timeUp', playerId: winnerId } },
  ]);
}

function hostJudge(
  room: Room,
  { result }: Extract<Action, { type: 'host:judge' }>,
  now: number,
): ReduceResult {
  if (room.phase !== 'BUZZED' || !room.winnerId) return fail(WRONG_PHASE_ERROR);
  // SPEC-QUESTION: the wait before a reopen is BUZZED with reopenAt set; see DECISIONS #5.
  if (!canJudge(room)) return fail('Already judged');

  const playerId = room.winnerId;
  const points = room.set.questions[room.questionIndex]?.points ?? 0;
  // SPEC-QUESTION: undo after a reopen restores this snapshot; see DECISIONS #6.
  const marked: Room = {
    ...room,
    undo: { buzzes: room.buzzes, windowStartedAt: room.windowStartedAt, winnerId: playerId },
    answerTimer: null,
  };
  if (result === 'correct') {
    const judged = applyJudgement(marked, playerId, 'correct', points);
    // The judged buzz stays, so the reveal can show who answered (DECISIONS F19).
    return done({ ...judged, phase: 'REVEAL' }, [
      { type: 'fx', fx: { kind: 'correct', playerId, points } },
    ]);
  }

  const judged = applyJudgement(
    marked,
    playerId,
    'wrong',
    room.settings.wrongPenalty && points ? -points : 0,
  );
  const fx: Effect = { type: 'fx', fx: { kind: 'wrong', playerId } };
  if (!anyoneEligible(judged)) return done({ ...judged, phase: 'REVEAL' }, [fx]);

  const at = now + REOPEN_DELAY_MS;
  const { questionIndex, openingCounter } = room;
  return done({ ...judged, reopenAt: at }, [
    fx,
    { type: 'schedule', at, action: { type: 'reopen', questionIndex, openingCounter, at } },
  ]);
}

/**
 * How a score changes: a judgement of the buzz winner, or the host's manual `'adjust'`, which
 * records no judgement and locks nobody out.
 */
export type ScoreChange = JudgeResult | 'adjust';

/**
 * Adds `pointsDelta` to `playerId`'s score. A judgement (`correct` or `wrong`) is also recorded
 * on the current question, and a wrong one locks the player out. Every score change goes through
 * here, judging, adjusting and undoing alike, so teams can later redirect the points in one place
 * (spec, "Out of scope").
 */
export function applyJudgement(
  room: Room,
  playerId: string,
  result: ScoreChange,
  pointsDelta: number,
): Room {
  const player = room.players[playerId];
  const players = player
    ? { ...room.players, [playerId]: { ...player, score: player.score + pointsDelta } }
    : room.players;
  if (result === 'adjust') return { ...room, players };

  const lockedOut =
    result === 'wrong' && !room.lockedOut.includes(playerId)
      ? [...room.lockedOut, playerId]
      : room.lockedOut;
  const judgement = { questionIndex: room.questionIndex, playerId, result, pointsDelta };
  return { ...room, players, lockedOut, judgements: [...room.judgements, judgement] };
}

/**
 * Someone can still buzz on this question: connected and not locked out (DECISIONS #9, F19). A player
 * who joined during this opening counts, because the reopen is a new opening.
 */
function anyoneEligible(room: Room): boolean {
  return Object.values(room.players).some((p) => p.connected && !room.lockedOut.includes(p.id));
}

function reopen(
  room: Room,
  { questionIndex, openingCounter, at }: Extract<TimerAction, { type: 'reopen' }>,
): ReduceResult {
  // Phase + index + counter + the pending reopen's own time rejects every stale timer, including
  // one from a wrong judgement that was undone and made again (DECISIONS F13, F20).
  const fresh =
    room.phase === 'BUZZED' &&
    room.reopenAt === at &&
    room.questionIndex === questionIndex &&
    room.openingCounter === openingCounter;
  if (!fresh) return done(room);
  return done(openBuzzers({ ...room, winnerId: null }));
}

/** Whether `host:judge` would be accepted: a winner in BUZZED, not already judged (DECISIONS #5). */
export function canJudge(room: Room): boolean {
  return room.phase === 'BUZZED' && room.winnerId !== null && room.reopenAt === null;
}

/** Whether `host:undo` would be accepted: this question's last judgement, with its undo point. */
export function canUndo(room: Room): boolean {
  const last = room.judgements.at(-1);
  const { undo } = room;
  return (
    UNDO_PHASES.includes(room.phase) &&
    undo !== null &&
    last?.questionIndex === room.questionIndex &&
    last.playerId === undo.winnerId
  );
}

/**
 * Reverses the last judgement of this question and returns to BUZZED with that buzz, as it was
 * when judged. Newer buzzes of the question are discarded. `openingCounter` keeps its value, so
 * the timers of a discarded opening stay stale (DECISIONS #6, F20).
 */
function hostUndo(room: Room): ReduceResult {
  if (!UNDO_PHASES.includes(room.phase)) return fail(WRONG_PHASE_ERROR);
  const last = room.judgements.at(-1);
  const { undo } = room;
  if (!canUndo(room) || !undo || !last) return fail('Nothing to undo');

  const reversed = applyJudgement(room, last.playerId, 'adjust', -last.pointsDelta);
  return done({
    ...reversed,
    phase: 'BUZZED',
    buzzes: undo.buzzes,
    windowStartedAt: undo.windowStartedAt,
    winnerId: undo.winnerId,
    lockedOut: room.lockedOut.filter((id) => id !== last.playerId),
    judgements: room.judgements.slice(0, -1),
    reopenAt: null,
    undo: null,
    answerTimer: null,
  });
}

/** Any phase: the Players tab's ± buttons. The delta is already range-checked by zod. */
function hostAdjustScore(
  room: Room,
  { playerId, delta }: Extract<Action, { type: 'host:adjustScore' }>,
): ReduceResult {
  if (!room.players[playerId]) return fail('Unknown player');
  return done(applyJudgement(room, playerId, 'adjust', delta));
}

/** Any phase. Removes the player for good: the id joins `kickedIds`, so it cannot rejoin. */
function hostKick(room: Room, { playerId }: Extract<Action, { type: 'host:kick' }>): ReduceResult {
  if (!room.players[playerId]) return fail('Unknown player');
  return done(withoutPlayer({ ...room, kickedIds: [...room.kickedIds, playerId] }, playerId));
}

/**
 * Removes the player and drops every live reference to them; their past judgements stay in the
 * history. An unjudged winning buzz is discarded and the buzzers reopen at once, or the room
 * moves to REVEAL if nobody else is eligible, as after a last wrong answer. A window the removal
 * leaves empty reopens too (DECISIONS #10, F20). Kick and leave share it (F61).
 */
function withoutPlayer(room: Room, playerId: string): Room {
  const players = Object.fromEntries(
    Object.entries(room.players).filter(([id]) => id !== playerId),
  );
  const keep = (b: Buzz) => b.playerId !== playerId;
  const undo =
    room.undo && room.undo.winnerId !== playerId
      ? { ...room.undo, buzzes: room.undo.buzzes.filter(keep) }
      : null;
  const kicked: Room = {
    ...room,
    players,
    buzzes: room.buzzes.filter(keep),
    lockedOut: room.lockedOut.filter((id) => id !== playerId),
    undo,
  };

  const wasWinner = room.winnerId === playerId;
  const unjudged = room.phase === 'BUZZED' && wasWinner && room.reopenAt === null;
  if (unjudged && !anyoneEligible(kicked)) {
    return {
      ...kicked,
      phase: 'REVEAL',
      buzzes: [],
      windowStartedAt: null,
      winnerId: null,
      answerTimer: null,
    };
  }
  if (
    (room.phase === 'BUZZED' && wasWinner) ||
    (room.phase === 'COLLECTING' && room.buzzes.length > 0 && !kicked.buzzes.length)
  ) {
    return openBuzzers({ ...kicked, winnerId: null });
  }
  return wasWinner ? { ...kicked, winnerId: null, answerTimer: null } : kicked;
}

/**
 * Any phase. Merges the keys that are set; each takes effect the next time it is consulted (the
 * next judgement, question entry or `host:next`), never on the current question (DECISIONS F20).
 */
function hostSettings(
  room: Room,
  { settings }: Extract<Action, { type: 'host:settings' }>,
): ReduceResult {
  const { wrongPenalty, autoOpenBuzzers, scoreboardEvery, answerSeconds } = room.settings;
  return done({
    ...room,
    settings: {
      wrongPenalty: settings.wrongPenalty ?? wrongPenalty,
      autoOpenBuzzers: settings.autoOpenBuzzers ?? autoOpenBuzzers,
      scoreboardEvery: settings.scoreboardEvery ?? scoreboardEvery,
      answerSeconds: settings.answerSeconds ?? answerSeconds,
    },
  });
}

/**
 * FINAL → LOBBY with another set: the same code, players (disconnected ones too), kicks and
 * settings. Every per-game field starts again, so undo never reaches across games, and
 * `openingCounter` keeps counting up, so no timer of the last game can fire (DECISIONS F49).
 */
function hostNewGame(
  room: Room,
  { set, keepScores }: Extract<Action, { type: 'host:newGame' }>,
): ReduceResult {
  if (room.phase !== 'FINAL') return fail(WRONG_PHASE_ERROR);
  // Zeroed through applyJudgement, as every score change is.
  const scored = keepScores
    ? room
    : Object.values(room.players).reduce(
        (r, p) => applyJudgement(r, p.id, 'adjust', -p.score),
        room,
      );
  return done({
    ...scored,
    ...clearedQuestion,
    set,
    phase: 'LOBBY',
    questionIndex: -1,
    judgements: [],
    showScoreboard: false,
  });
}

function hostStart(room: Room): ReduceResult {
  if (room.phase !== 'LOBBY') return fail(WRONG_PHASE_ERROR);
  // SPEC-QUESTION: "at least 1 player" counts disconnected players too; see DECISIONS (F13).
  if (Object.keys(room.players).length === 0) return fail('Wait for at least one player to join');
  return done(enterQuestion(room, 0));
}

function hostOpen(room: Room): ReduceResult {
  if (room.phase !== 'QUESTION') return fail(WRONG_PHASE_ERROR);
  // The overlay hides when play moves on (DECISIONS #7).
  return done(openBuzzers({ ...room, showScoreboard: false }));
}

function hostReveal(room: Room): ReduceResult {
  if (!QUESTION_PHASES.includes(room.phase)) return fail(WRONG_PHASE_ERROR);
  // No points; an unjudged buzz is discarded. Lockouts stay until the question changes.
  return done({
    ...room,
    phase: 'REVEAL',
    buzzes: [],
    windowStartedAt: null,
    winnerId: null,
    reopenAt: null,
    answerTimer: null,
    showScoreboard: false,
  });
}

function hostNext(room: Room): ReduceResult {
  if (room.phase !== 'REVEAL') return fail(WRONG_PHASE_ERROR);
  const finished = room.questionIndex + 1;
  const every = room.settings.scoreboardEvery;
  const showScoreboard = every > 0 && finished % every === 0;
  if (finished >= room.set.questions.length) {
    return done({ ...room, ...clearedQuestion, phase: 'FINAL', showScoreboard });
  }
  return done(enterQuestion({ ...room, showScoreboard }, finished));
}

function hostPrev(room: Room): ReduceResult {
  if (room.phase !== 'REVEAL' && !QUESTION_PHASES.includes(room.phase)) {
    return fail(WRONG_PHASE_ERROR);
  }
  // SPEC-QUESTION: going back onto an answered question; see DECISIONS #8 and (F13).
  if (room.questionIndex <= 0) return fail('Already on the first question');
  return done(enterQuestion(room, room.questionIndex - 1));
}

/** Per-question state that starts empty on every question. */
const clearedQuestion = {
  buzzes: [],
  windowStartedAt: null,
  winnerId: null,
  lockedOut: [],
  reopenAt: null,
  undo: null,
  answerTimer: null,
} satisfies Partial<Room>;

/**
 * Shows question `index` with a clean slate. With `autoOpenBuzzers` on, the buzzers open at once,
 * however the question was reached (start, next or prev).
 */
function enterQuestion(room: Room, index: number): Room {
  const shown: Room = { ...room, ...clearedQuestion, phase: 'QUESTION', questionIndex: index };
  return room.settings.autoOpenBuzzers ? openBuzzers(shown) : shown;
}

/** QUESTION (or BUZZED after a wrong answer) → OPEN: a new opening with no buzzes yet. */
function openBuzzers(room: Room): Room {
  return {
    ...room,
    phase: 'OPEN',
    buzzes: [],
    windowStartedAt: null,
    reopenAt: null,
    answerTimer: null,
    openingCounter: room.openingCounter + 1,
  };
}

/**
 * The least-used palette colour, earliest in the palette on a tie. Players join in palette
 * order, and a colour freed by a player who left is reused before any colour repeats.
 */
function nextColor(players: Player[]): string {
  const uses = PLAYER_PALETTE.map((color) => players.filter((p) => p.color === color).length);
  return PLAYER_PALETTE[uses.indexOf(Math.min(...uses))] ?? PLAYER_PALETTE[0];
}

function withPlayer(room: Room, player: Player): Room {
  return { ...room, players: { ...room.players, [player.id]: player } };
}

function done(room: Room, effects: Effect[] = []): ReduceResult {
  return { ok: true, room, effects };
}

function fail(error: string): ReduceResult {
  return { ok: false, error };
}

// The game logic: a pure `reduce(room, action, now) → {room, effects}`. See "Game flow and state
// machine" in docs/SPEC.md. No I/O, timers, clocks or randomness: the gateway supplies `now` and
// runs the returned effects.

import {
  COLLECTION_WINDOW_MS,
  MAX_PLAYERS_PER_ROOM,
  PLAYER_KICKED_ERROR,
  PLAYER_PALETTE,
  REOPEN_DELAY_MS,
} from '../shared/constants.js';
import type { Buzz, Fx, JudgeResult, Phase, Player, Room } from '../shared/types.js';
import { buzzGaps, makeBuzz, rankBuzzes } from './fairness.js';

/** The error for an action the transitions table does not list for the current phase. */
export const WRONG_PHASE_ERROR = 'Not allowed in this phase';

/** Phases before the answer is shown. `host:reveal` accepts these; `host:prev` also accepts REVEAL. */
const QUESTION_PHASES: readonly Phase[] = ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED'];

/** Phases that take a buzz: OPEN and COLLECTING count, BUZZED records a late one (DECISIONS #4). */
const BUZZ_PHASES: readonly Phase[] = ['OPEN', 'COLLECTING', 'BUZZED'];

/**
 * A scheduled action. The gateway dispatches it when its timer fires; it carries the question
 * index and opening counter so the reducer can ignore it once the room has moved on.
 */
export type TimerAction = {
  type: 'windowClosed' | 'reopen';
  questionIndex: number;
  openingCounter: number;
};

/**
 * Everything the reducer accepts. Client events arrive here after the gateway has checked auth
 * and parsed the payload with zod; `player:disconnect` and timer actions come from the gateway
 * itself. `receivedAt` is the gateway's monotonic `performance.now()` at arrival (DECISIONS F05).
 */
export type Action =
  | { type: 'player:join'; playerId: string; name: string }
  | { type: 'player:disconnect'; playerId: string }
  | { type: 'player:buzz'; playerId: string; receivedAt: number }
  | TimerAction
  | { type: 'host:start' }
  | { type: 'host:open' }
  | { type: 'host:judge'; result: JudgeResult }
  | { type: 'host:reveal' }
  | { type: 'host:next' }
  | { type: 'host:prev' }
  | { type: 'host:end' }
  | { type: 'host:scoreboard'; show: boolean };

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
    case 'windowClosed':
      return windowClosed(room, action);
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
      return done({ ...room, phase: 'FINAL' });
    case 'host:scoreboard':
      return done({ ...room, showScoreboard: action.show });
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
  if (room.phase === 'FINAL') return fail('This game has ended');

  const players = Object.values(room.players);
  if (players.length >= MAX_PLAYERS_PER_ROOM) return fail('This game is full');

  const key = name.toLowerCase();
  if (players.some((p) => p.name.toLowerCase() === key)) return fail('That name is taken');

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
  if (!canBuzz(room, player)) return done(room);

  const buzz = makeBuzz(playerId, receivedAt, player.rttMs);
  const { questionIndex, openingCounter } = room;
  const log: Effect = { type: 'log', questionIndex, openingCounter, buzz };
  const buzzes = [...room.buzzes, buzz];

  if (room.phase === 'OPEN') {
    const action: TimerAction = { type: 'windowClosed', questionIndex, openingCounter };
    return done({ ...room, phase: 'COLLECTING', buzzes }, [
      { type: 'schedule', at: now + COLLECTION_WINDOW_MS, action },
      log,
    ]);
  }
  // COLLECTING joins the window. BUZZED records a late buzz for the also-buzzed list only; it can
  // never win, because the winner is fixed (DECISIONS #4).
  return done({ ...room, buzzes }, [log]);
}

/**
 * Buzzers are open (or the window just closed, for a late buzz), the player is not locked out,
 * has not buzzed this opening, and joined before it.
 */
function canBuzz(room: Room, player: Player): boolean {
  return (
    BUZZ_PHASES.includes(room.phase) &&
    !room.lockedOut.includes(player.id) &&
    !room.buzzes.some((b) => b.playerId === player.id) &&
    player.joinedAtOpening !== room.openingCounter
  );
}

function windowClosed(room: Room, { questionIndex, openingCounter }: TimerAction): ReduceResult {
  // Phase + index + counter rejects every stale timer (DECISIONS F13).
  const fresh =
    room.phase === 'COLLECTING' &&
    room.questionIndex === questionIndex &&
    room.openingCounter === openingCounter;
  const ranked = rankBuzzes(room.buzzes, room.players);
  const winner = ranked[0];
  if (!fresh || !winner) return done(room);

  const fx: Fx = { kind: 'buzz', playerId: winner.playerId, gaps: buzzGaps(ranked) };
  return done({ ...room, phase: 'BUZZED', winnerId: winner.playerId }, [{ type: 'fx', fx }]);
}

function hostJudge(
  room: Room,
  { result }: Extract<Action, { type: 'host:judge' }>,
  now: number,
): ReduceResult {
  if (room.phase !== 'BUZZED' || !room.winnerId) return fail(WRONG_PHASE_ERROR);
  // SPEC-QUESTION: the wait before a reopen is BUZZED with reopenAt set; see DECISIONS #5.
  if (room.reopenAt !== null) return fail('Already judged');

  const playerId = room.winnerId;
  const points = room.set.questions[room.questionIndex]?.points ?? 0;
  if (result === 'correct') {
    const judged = applyJudgement(room, playerId, 'correct', points);
    // The judged buzz stays, so the reveal can show who answered (DECISIONS F19).
    return done({ ...judged, phase: 'REVEAL' }, [
      { type: 'fx', fx: { kind: 'correct', playerId, points } },
    ]);
  }

  const judged = applyJudgement(
    room,
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
    { type: 'schedule', at, action: { type: 'reopen', questionIndex, openingCounter } },
  ]);
}

/**
 * Records a judgement of `playerId` on the current question: adds `pointsDelta` to their score
 * and, on a wrong answer, locks them out. Every score change goes through here, so teams can
 * later redirect the points in one place (spec, "Out of scope").
 */
export function applyJudgement(
  room: Room,
  playerId: string,
  result: JudgeResult,
  pointsDelta: number,
): Room {
  const player = room.players[playerId];
  const players = player
    ? { ...room.players, [playerId]: { ...player, score: player.score + pointsDelta } }
    : room.players;
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

function reopen(room: Room, { questionIndex, openingCounter }: TimerAction): ReduceResult {
  // Phase + index + counter + a pending reopen rejects every stale timer (DECISIONS F13).
  const fresh =
    room.phase === 'BUZZED' &&
    room.reopenAt !== null &&
    room.questionIndex === questionIndex &&
    room.openingCounter === openingCounter;
  if (!fresh) return done(room);
  return done(openBuzzers({ ...room, winnerId: null }));
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
    winnerId: null,
    reopenAt: null,
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
  winnerId: null,
  lockedOut: [],
  reopenAt: null,
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
    reopenAt: null,
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

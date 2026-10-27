// The game logic: a pure `reduce(room, action, now) → {room, effects}`. See "Game flow and state
// machine" in docs/SPEC.md. No I/O, timers, clocks or randomness: the gateway supplies `now` and
// runs the returned effects.

import { MAX_PLAYERS_PER_ROOM, PLAYER_KICKED_ERROR, PLAYER_PALETTE } from '../shared/constants.js';
import type { Fx, Phase, Player, Room } from '../shared/types.js';

/** The error for an action the transitions table does not list for the current phase. */
export const WRONG_PHASE_ERROR = 'Not allowed in this phase';

/** Phases before the answer is shown. `host:reveal` accepts these; `host:prev` also accepts REVEAL. */
const QUESTION_PHASES: readonly Phase[] = ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED'];

/**
 * Everything the reducer accepts. Client events arrive here after the gateway has checked auth
 * and parsed the payload with zod; `player:disconnect` comes from the gateway itself.
 */
export type Action =
  | { type: 'player:join'; playerId: string; name: string }
  | { type: 'player:disconnect'; playerId: string }
  | { type: 'host:start' }
  | { type: 'host:open' }
  | { type: 'host:reveal' }
  | { type: 'host:next' }
  | { type: 'host:prev' }
  | { type: 'host:end' }
  | { type: 'host:scoreboard'; show: boolean };

/** Work for the gateway: `fx` is broadcast to the room's sockets. */
export type Effect = { type: 'fx'; fx: Fx };

export type ReduceResult =
  { ok: true; room: Room; effects: Effect[] } | { ok: false; error: string };

/**
 * Applies `action` to `room` at `now` (wall-clock ms, as `Date.now` gives; DECISIONS F05).
 * Never mutates `room`. A rejected action returns an error and no room.
 */
export function reduce(room: Room, action: Action, now: number): ReduceResult {
  const result = apply(room, action, now);
  if (!result.ok) return result;
  return { ...result, room: { ...result.room, lastActivityAt: now } };
}

function apply(room: Room, action: Action, now: number): ReduceResult {
  switch (action.type) {
    case 'player:join':
      return playerJoin(room, action, now);
    case 'player:disconnect':
      return playerDisconnect(room, action);
    case 'host:start':
      return hostStart(room);
    case 'host:open':
      return hostOpen(room);
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
  return done({ ...room, phase: 'REVEAL', buzzes: [], winnerId: null, showScoreboard: false });
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
const clearedQuestion = { buzzes: [], winnerId: null, lockedOut: [] } satisfies Partial<Room>;

/**
 * Shows question `index` with a clean slate. With `autoOpenBuzzers` on, the buzzers open at once,
 * however the question was reached (start, next or prev).
 */
function enterQuestion(room: Room, index: number): Room {
  const shown: Room = { ...room, ...clearedQuestion, phase: 'QUESTION', questionIndex: index };
  return room.settings.autoOpenBuzzers ? openBuzzers(shown) : shown;
}

/** QUESTION → OPEN: a new opening with no buzzes yet. */
function openBuzzers(room: Room): Room {
  return { ...room, phase: 'OPEN', buzzes: [], openingCounter: room.openingCounter + 1 };
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

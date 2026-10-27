// The game logic: a pure `reduce(room, action, now) → {room, effects}`. See "Game flow and state
// machine" in docs/SPEC.md. No I/O, timers, clocks or randomness: the gateway supplies `now` and
// runs the returned effects.

import { MAX_PLAYERS_PER_ROOM, PLAYER_KICKED_ERROR, PLAYER_PALETTE } from '../shared/constants.js';
import type { Fx, Player, Room } from '../shared/types.js';

/**
 * Everything the reducer accepts. Client events arrive here after the gateway has checked auth
 * and parsed the payload with zod; `player:disconnect` comes from the gateway itself.
 */
export type Action =
  | { type: 'player:join'; playerId: string; name: string }
  | { type: 'player:disconnect'; playerId: string };

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

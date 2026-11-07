// The game logic: a pure `reduce(room, action, now) → {room, effects}` (spec: Transitions). No I/O,
// no timers, no clocks, no `Math.random`: `now` is the gateway's monotonic ms, randomness is the
// seeded `room.rngState`, and timers go out as `schedule` effects that come back as `timer` actions.
// A rejected action returns the room it was given, no effects and the spec's error text.

import { createHash } from 'node:crypto';
import {
  KICKED_ERROR,
  MAX_PLAYERS,
  MAX_SCREENS,
  PALETTE,
  PRACTICE_TARGET,
  VIP_AWAY_MS,
} from '#shared/constants.js';
import { haversineKm } from '#shared/geo.js';
import type { Phase, Player, PlayerFx, Room, ScreenFx } from '#shared/types.js';

export type TimerName =
  | 'introDone'
  | 'guessUp'
  | 'allLocked'
  | 'revealTarget'
  | 'revealStep'
  | 'revealDone'
  | 'scoreboardDone'
  | 'screenGone'
  | 'vipGone'
  | 'resumeGo'
  | 'rematchGo';

interface TimerFields {
  at: number;
  timer: TimerName;
  round: number;
  game: number;
  epoch: number;
}

/** `by` is the sender's player id, which the gateway knows from the socket's join. */
export type Action =
  | { type: 'player:join'; playerKey: string; name: string; emoji: string }
  | { type: 'player:rename'; by: string; name: string; emoji?: string }
  | { type: 'player:leave'; by: string }
  | { type: 'player:practice'; by: string; lat: number; lng: number }
  | { type: 'player:connection'; playerId: string; connected: boolean }
  | { type: 'vip:kick'; by: string; playerId: string }
  | { type: 'screen:join' }
  | { type: 'screen:leave' }
  /** The gateway sends back the fields of the `schedule` effect it set the timeout for. */
  | ({ type: 'timer' } & TimerFields);

export type Effect =
  | ({ type: 'schedule' } & TimerFields)
  | { type: 'fx'; to: 'screens'; fx: ScreenFx }
  | { type: 'fx'; to: { playerId: string }; fx: PlayerFx }
  | { type: 'kicked'; playerId: string };

export interface ReduceResult {
  room: Room;
  effects: Effect[];
  error?: string;
}

// SPEC-QUESTION: DECISIONS 14 (texts the spec leaves open: lobbyOnly, notInGame, kickSelf, noSuchPlayer, screensFull, emojiTaken)
export const ERRORS = {
  full: `This game is full (${MAX_PLAYERS} players)`,
  kicked: KICKED_ERROR,
  notVip: 'Only the VIP can do that',
  nameTaken: 'That name is taken',
  emojiTaken: 'That emoji is taken',
  lobbyOnly: 'You can only do that in the lobby',
  notInGame: 'You are not in this game',
  kickSelf: "You can't kick yourself",
  noSuchPlayer: 'That player is not in this game',
  screensFull: `This game already has ${MAX_SCREENS} Screens`,
} as const;

/** The public id (first 16 chars of base64url SHA-256 of code + key) and the stored key hash. */
export function playerIdentity(code: string, playerKey: string): { id: string; keyHash: string } {
  return {
    id: createHash('sha256')
      .update(code + playerKey)
      .digest('base64url')
      .slice(0, 16),
    keyHash: createHash('sha256').update(playerKey).digest('hex'),
  };
}

/** Late joiners wait for the next INTRO (spec: Reconnects). */
// SPEC-QUESTION: DECISIONS 14 (FINAL joiners wait for the rematch)
const WAITING_PHASES: readonly Phase[] = ['GUESSING', 'REVEAL', 'SCOREBOARD', 'FINAL'];

export function reduce(room: Room, action: Action, now: number): ReduceResult {
  const d = structuredClone(room);
  const effects: Effect[] = [];
  const error = apply(d, action, now, effects);
  if (error) return { room, effects: [], error };
  // A timer is not activity: a stale one must not keep an idle room alive.
  if (action.type !== 'timer') d.lastActivityAt = now;
  return { room: d, effects };
}

/** Handlers mutate `d`, a private copy, and push effects; or return an error before changing it. */
function apply(d: Room, a: Action, now: number, fx: Effect[]): string | undefined {
  switch (a.type) {
    case 'player:join':
      return join(d, a, now, fx);
    case 'player:rename':
      return rename(d, a);
    case 'player:leave': {
      if (!d.players[a.by]) return ERRORS.notInGame;
      removePlayer(d, a.by, fx);
      return undefined;
    }
    case 'player:practice': {
      if (!d.players[a.by]) return ERRORS.notInGame;
      if (d.phase !== 'LOBBY') return ERRORS.lobbyOnly;
      // Nothing is stored or scored.
      // SPEC-QUESTION: DECISIONS 20 (the 2 s per-player limit is the gateway's)
      const distanceKm = haversineKm(a, PRACTICE_TARGET);
      fx.push({ type: 'fx', to: 'screens', fx: { kind: 'practice', playerId: a.by } });
      fx.push({ type: 'fx', to: { playerId: a.by }, fx: { kind: 'practiceResult', distanceKm } });
      return undefined;
    }
    case 'player:connection':
      return connection(d, a, now, fx);
    case 'vip:kick': {
      if (a.by !== d.vipId) return ERRORS.notVip;
      if (a.playerId === a.by) return ERRORS.kickSelf;
      if (!d.players[a.playerId]) return ERRORS.noSuchPlayer;
      d.kickedIds.push(a.playerId);
      removePlayer(d, a.playerId, fx);
      fx.push({ type: 'kicked', playerId: a.playerId });
      return undefined;
    }
    case 'screen:join':
      if (d.screenCount >= MAX_SCREENS) return ERRORS.screensFull;
      d.screenCount += 1;
      return undefined;
    case 'screen:leave':
      d.screenCount = Math.max(0, d.screenCount - 1);
      return undefined;
    case 'timer':
      if (isStale(d, a)) return undefined;
      // Only the deadline it was set for counts: a VIP who came back (or dropped again) moved it.
      // An epoch bump (pause, F20; rematch, F24) must re-schedule vipGone while vipAwayUntil is set.
      if (a.timer === 'vipGone' && a.at === d.vipAwayUntil) succeed(d, fx);
      return undefined;
    default:
      a satisfies never;
      return undefined;
  }
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Name and emoji are unique in the room, ignoring case for names; `self` is skipped. */
function identityTaken(d: Room, name: string, emoji: string, self?: string): string | undefined {
  const others = Object.values(d.players).filter((p) => p.id !== self);
  if (others.some((p) => sameName(p.name, name))) return ERRORS.nameTaken;
  if (others.some((p) => p.emoji === emoji)) return ERRORS.emojiTaken;
  return undefined;
}

function join(
  d: Room,
  a: Extract<Action, { type: 'player:join' }>,
  now: number,
  fx: Effect[],
): string | undefined {
  const { id, keyHash } = playerIdentity(d.code, a.playerKey);
  if (d.kickedIds.includes(id)) return ERRORS.kicked;

  const known = d.players[id];
  if (known) {
    // A reconnect keeps the stored name and emoji; the form's are ignored.
    connect(d, known, now, fx);
    return undefined;
  }

  const players = Object.values(d.players);
  if (players.length >= MAX_PLAYERS) return ERRORS.full;
  const taken = identityTaken(d, a.name, a.emoji);
  if (taken) return taken;

  const used = new Set(players.map((p) => p.color));
  d.players[id] = {
    id,
    keyHash,
    name: a.name,
    emoji: a.emoji,
    color: PALETTE.find((c) => !used.has(c)) ?? PALETTE[0],
    connected: false,
    connectedSince: null,
    joinedAt: now,
    waiting: WAITING_PHASES.includes(d.phase),
  };
  fx.push({ type: 'fx', to: 'screens', fx: { kind: 'join', playerId: id } });
  connect(d, d.players[id], now, fx, true);
  return undefined;
}

function rename(d: Room, a: Extract<Action, { type: 'player:rename' }>): string | undefined {
  const player = d.players[a.by];
  if (!player) return ERRORS.notInGame;
  if (d.phase !== 'LOBBY') return ERRORS.lobbyOnly;
  const emoji = a.emoji ?? player.emoji;
  const taken = identityTaken(d, a.name, emoji, player.id);
  if (taken) return taken;
  player.name = a.name;
  player.emoji = emoji;
  return undefined;
}

function connection(
  d: Room,
  a: Extract<Action, { type: 'player:connection' }>,
  now: number,
  fx: Effect[],
): string | undefined {
  const player = d.players[a.playerId];
  if (!player) return ERRORS.notInGame;
  if (a.connected) {
    connect(d, player, now, fx);
    return undefined;
  }
  if (!player.connected) return undefined;
  player.connected = false;
  player.connectedSince = null;
  if (player.id === d.vipId) {
    d.vipAwayUntil = now + VIP_AWAY_MS;
    schedule(d, 'vipGone', d.vipAwayUntil, fx);
  }
  return undefined;
}

/** Marks the player connected and settles the VIP. `isNew`: a fresh join gets no vipNow toast. */
function connect(d: Room, player: Player, now: number, fx: Effect[], isNew = false): void {
  // `vipAwayUntil` is set only while the VIP is disconnected; past it the VIP has left, even if
  // `vipGone` has not fired yet, so a late VIP returns as an ordinary player.
  const vipGone =
    d.vipId === null || !d.players[d.vipId] || (d.vipAwayUntil !== null && now >= d.vipAwayUntil);
  if (!player.connected) {
    player.connected = true;
    player.connectedSince = now;
  }
  if (vipGone) succeed(d, fx, isNew ? player.id : undefined);
  else if (player.id === d.vipId) d.vipAwayUntil = null;
}

/**
 * VIP passes to the connected player with the earliest `connectedSince` (ties: earliest joiner).
 * With nobody connected, `vipId` stays (null if that player is gone) until someone connects.
 */
function succeed(d: Room, fx: Effect[], quietId?: string): void {
  const heir = Object.values(d.players)
    .filter((p) => p.connected)
    .sort((x, y) => x.connectedSince! - y.connectedSince! || x.joinedAt - y.joinedAt)[0];
  if (!heir) {
    // SPEC-QUESTION: DECISIONS 14 (the spec keeps vipId on the last VIP; a VIP who left has no row)
    if (d.vipId !== null && !d.players[d.vipId]) {
      d.vipId = null;
      d.vipAwayUntil = null;
    }
    return;
  }
  d.vipAwayUntil = null;
  if (heir.id === d.vipId) return;
  d.vipId = heir.id;
  // SPEC-QUESTION: DECISIONS 14 (a brand-new joiner who becomes VIP gets no toast; only a move does)
  if (heir.id !== quietId)
    fx.push({ type: 'fx', to: { playerId: heir.id }, fx: { kind: 'vipNow' } });
}

// shortcut: removes only the player; their round rows and the allLocked re-check come with the game (F15, F22).
function removePlayer(d: Room, playerId: string, fx: Effect[]): void {
  delete d.players[playerId];
  if (playerId === d.vipId) succeed(d, fx);
}

const timerRound = (d: Room) => d.game?.current?.number ?? 0;

/** A timer set for another round, game or `timerEpoch` is ignored (spec: Scheduled timers). */
function isStale(d: Room, a: TimerFields): boolean {
  return a.round !== timerRound(d) || a.game !== (d.game?.number ?? 0) || a.epoch !== d.timerEpoch;
}

function schedule(d: Room, timer: TimerName, at: number, fx: Effect[]): void {
  fx.push({
    type: 'schedule',
    at,
    timer,
    round: timerRound(d),
    game: d.game?.number ?? 0,
    epoch: d.timerEpoch,
  });
}

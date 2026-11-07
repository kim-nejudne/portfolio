// The game logic: a pure `reduce(room, action, now) → {room, effects}` (spec: Transitions). No I/O,
// no timers, no clocks, no `Math.random`: `now` is the gateway's monotonic ms, randomness is the
// seeded `room.rngState`, and timers go out as `schedule` effects that come back as `timer` actions.
// A rejected action returns the room it was given, no effects and the spec's error text.

import { createHash } from 'node:crypto';
import {
  ALL_LOCKED_MS,
  GRACE_MS,
  INTRO_MS,
  KICKED_ERROR,
  MAX_PLAYERS,
  MAX_SCREENS,
  PALETTE,
  PRACTICE_TARGET,
  RESUME_COUNTDOWN_MS,
  REVEAL_DONE_AFTER_MS,
  REVEAL_FIRST_STEP_MS,
  REVEAL_TARGET_MS,
  SCOREBOARD_MS,
  SCREEN_AWAY_MS,
  VIP_AWAY_MS,
} from '#shared/constants.js';
import { bullseyeRadius, haversineKm, mercatorCentre, regionScale } from '#shared/geo.js';
import {
  basePoints,
  escalation,
  levelPlan,
  points as withMultiplier,
  replan,
  revealStepMs,
} from '#shared/scoring.js';
import type {
  Category,
  GameSettings,
  LatLng,
  PauseReason,
  Phase,
  Player,
  PlayerFx,
  Room,
  RoundResult,
  ScreenFx,
} from '#shared/types.js';
import { pickPlace, poolShortfall, restShortfall, snapshotPool } from './placePicker.js';

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
  /** `revealStep` only: the index of the result row it reveals. */
  k?: number | undefined;
}

/** `by` is the sender's player id, which the gateway knows from the socket's join. */
export type Action =
  | { type: 'player:join'; playerKey: string; name: string; emoji: string }
  | { type: 'player:rename'; by: string; name: string; emoji?: string }
  | { type: 'player:leave'; by: string }
  | { type: 'player:practice'; by: string; lat: number; lng: number }
  | { type: 'player:connection'; playerId: string; connected: boolean }
  | { type: 'vip:kick'; by: string; playerId: string }
  /** `liveIds`: the live, visible category ids the gateway read from the store just now. */
  | { type: 'vip:settings'; by: string; settings: Partial<GameSettings>; liveIds: string[] }
  /** `category`: the live, visible category of `settings.categoryId` the gateway read just now. */
  | { type: 'vip:start'; by: string; category: Category | undefined }
  | { type: 'vip:pause'; by: string }
  | { type: 'vip:resume'; by: string }
  | { type: 'vip:next'; by: string }
  | { type: 'vip:skipRound'; by: string }
  | { type: 'vip:end'; by: string }
  | {
      type: 'vip:roundSettings';
      by: string;
      settings: Partial<Pick<GameSettings, 'timerSeconds' | 'rounds'>>;
    }
  | { type: 'player:aim'; by: string; lat: number; lng: number }
  | { type: 'player:lockIn'; by: string; lat: number; lng: number }
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
// SPEC-QUESTION: DECISIONS 21 (noSuchCategory)
// SPEC-QUESTION: DECISIONS 23 (noScreen, noPlayers, noCategory, notGuessing, notPlaying, alreadyLocked, paused)
// SPEC-QUESTION: DECISIONS 28 (notTimed, notPaused)
// SPEC-QUESTION: DECISIONS 29 (notNow)
// SPEC-QUESTION: DECISIONS 31 (roundsPlayed)
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
  noSuchCategory: 'That category is not available',
  noScreen: 'Open the Screen first',
  noPlayers: 'No players are connected',
  noCategory: 'Pick a category',
  notGuessing: 'Guessing is closed',
  notPlaying: 'You join at the next round',
  alreadyLocked: 'You already locked in',
  paused: 'The game is paused',
  notTimed: 'There is nothing to pause now',
  notPaused: 'The game is not paused',
  notNow: "You can't do that now",
  roundsPlayed: 'That many rounds are already played',
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

/** The phases with a running clock: the ones a pause can hold (spec: Pausing). */
// SPEC-QUESTION: DECISIONS 28 (Transitions says "any but LOBBY"; FINAL has nothing to hold)
const TIMED_PHASES: readonly Phase[] = ['INTRO', 'GUESSING', 'REVEAL', 'SCOREBOARD'];

/** Timers that drive the phase: a pause stops them and the resume restarts them. */
const PHASE_TIMERS: readonly TimerName[] = [
  'introDone',
  'guessUp',
  'allLocked',
  'revealTarget',
  'revealStep',
  'revealDone',
  'scoreboardDone',
];

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
      removePlayer(d, a.by, now, fx);
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
      removePlayer(d, a.playerId, now, fx);
      fx.push({ type: 'kicked', playerId: a.playerId });
      return undefined;
    }
    case 'vip:settings': {
      if (a.by !== d.vipId) return ERRORS.notVip;
      if (d.phase !== 'LOBBY') return ERRORS.lobbyOnly;
      // SPEC-QUESTION: DECISIONS 21 (only the category is checked; place counts are Start's check)
      if (a.settings.categoryId !== undefined && !a.liveIds.includes(a.settings.categoryId))
        return ERRORS.noSuchCategory;
      // zod's `.partial()` omits absent keys, so the spread never writes an undefined.
      d.settings = { ...d.settings, ...a.settings };
      return undefined;
    }
    case 'vip:start':
      return start(d, a, now, fx);
    case 'vip:pause':
      if (a.by !== d.vipId) return ERRORS.notVip;
      if (!TIMED_PHASES.includes(d.phase)) return ERRORS.notTimed;
      if (d.paused?.reasons.includes('vip')) return ERRORS.paused;
      addReason(d, 'vip', now, fx);
      return undefined;
    case 'vip:resume':
      if (a.by !== d.vipId) return ERRORS.notVip;
      if (!d.paused?.reasons.includes('vip')) return ERRORS.notPaused;
      clearReason(d, 'vip', now, fx);
      return undefined;
    case 'vip:next':
      if (a.by !== d.vipId) return ERRORS.notVip;
      if (d.phase !== 'REVEAL' && d.phase !== 'SCOREBOARD') return ERRORS.notNow;
      if (d.paused) return ERRORS.paused;
      if (d.phase === 'REVEAL') endReveal(d, now, fx);
      else return openRound(d, d.game!.played.at(-1)!.number + 1, now, fx);
      return undefined;
    case 'vip:skipRound': {
      if (a.by !== d.vipId) return ERRORS.notVip;
      if (!['INTRO', 'GUESSING', 'REVEAL'].includes(d.phase)) return ERRORS.notNow;
      // The voided round is dropped; its place stays in usedPlaceIds. The new epoch makes the old
      // round's timers stale, since they carry the same round number. A pause stays on.
      // SPEC-QUESTION: DECISIONS 29 (skip keeps the pause; end lifts it)
      bumpEpoch(d, now, fx); // undone with everything else if openRound refuses (d is a clone)
      return openRound(d, d.game!.current!.number, now, fx);
    }
    case 'vip:end':
      if (a.by !== d.vipId) return ERRORS.notVip;
      if (!TIMED_PHASES.includes(d.phase)) return ERRORS.notNow;
      d.paused = null; // FINAL has no clock to hold
      d.screenAwayUntil = null;
      if (d.phase === 'REVEAL') endReveal(d, now, fx, true);
      else {
        d.game!.current = null; // an unrevealed round is voided
        enterPhase(d, 'FINAL');
      }
      return undefined;
    case 'vip:roundSettings':
      return roundSettings(d, a);
    case 'player:aim':
    case 'player:lockIn': {
      const round = d.game?.current;
      if (!d.players[a.by]) return ERRORS.notInGame;
      if (d.phase !== 'GUESSING' || !round) return ERRORS.notGuessing;
      if (d.paused) return ERRORS.paused;
      if (!round.participants.includes(a.by)) return ERRORS.notPlaying;
      if (round.locks[a.by]) return ERRORS.alreadyLocked;
      const at: LatLng = { lat: a.lat, lng: a.lng };
      if (a.type === 'player:aim') {
        round.aims[a.by] = at;
        return undefined;
      }
      round.locks[a.by] = { ...at, at: now };
      fx.push({ type: 'fx', to: 'screens', fx: { kind: 'lockedIn', playerId: a.by } });
      // The sender is connected and was not locked, so all were not locked before this.
      if (allLocked(d)) schedule(d, 'allLocked', now + ALL_LOCKED_MS, now, fx);
      return undefined;
    }
    case 'screen:join':
      if (d.screenCount >= MAX_SCREENS) return ERRORS.screensFull;
      d.screenCount += 1;
      d.screenAwayUntil = null;
      if (d.paused?.reasons.includes('screenAway')) clearReason(d, 'screenAway', now, fx);
      return undefined;
    case 'screen:leave':
      if (d.screenCount === 0) return undefined; // a stray leave must not move the deadline
      d.screenCount -= 1;
      if (d.screenCount === 0 && TIMED_PHASES.includes(d.phase)) {
        d.screenAwayUntil = now + SCREEN_AWAY_MS;
        schedule(d, 'screenGone', d.screenAwayUntil, now, fx);
      }
      return undefined;
    case 'timer':
      return timer(d, a, now, fx);
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
  const wasAllLocked = allLocked(d);
  player.connected = false;
  player.connectedSince = null;
  if (!wasAllLocked && allLocked(d)) schedule(d, 'allLocked', now + ALL_LOCKED_MS, now, fx);
  if (player.id === d.vipId) {
    d.vipAwayUntil = now + VIP_AWAY_MS;
    schedule(d, 'vipGone', d.vipAwayUntil, now, fx);
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
  const round = d.game?.current;
  if (
    d.phase === 'GUESSING' &&
    round?.participants.includes(player.id) &&
    !round.everConnected.includes(player.id)
  )
    round.everConnected.push(player.id);
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

/** Kick and leave: the player and every round row of theirs go (spec: Kick, Edge cases). */
function removePlayer(d: Room, playerId: string, now: number, fx: Effect[]): void {
  const wasAllLocked = allLocked(d);
  delete d.players[playerId];
  if (d.game) {
    for (const round of [...d.game.played, ...(d.game.current ? [d.game.current] : [])]) {
      round.participants = round.participants.filter((id) => id !== playerId);
      round.everConnected = round.everConnected.filter((id) => id !== playerId);
      delete round.aims[playerId];
      delete round.locks[playerId];
      if (round.results) round.results = round.results.filter((r) => r.playerId !== playerId);
    }
  }
  if (!wasAllLocked && allLocked(d)) schedule(d, 'allLocked', now + ALL_LOCKED_MS, now, fx);
  if (playerId === d.vipId) succeed(d, fx);
}

/**
 * GUESSING with at least one connected participant, and every connected participant locked in.
 */
// SPEC-QUESTION: DECISIONS 23 (with no connected participant the round runs to time-up)
function allLocked(d: Room): boolean {
  const round = d.game?.current;
  if (d.phase !== 'GUESSING' || !round) return false;
  const connected = round.participants.filter((id) => d.players[id]?.connected);
  return connected.length > 0 && connected.every((id) => round.locks[id]);
}

function start(
  d: Room,
  a: Extract<Action, { type: 'vip:start' }>,
  now: number,
  fx: Effect[],
): string | undefined {
  if (a.by !== d.vipId) return ERRORS.notVip;
  if (d.phase !== 'LOBBY') return ERRORS.lobbyOnly;
  if (!Object.values(d.players).some((p) => p.connected)) return ERRORS.noPlayers;
  if (d.screenCount === 0) return ERRORS.noScreen;
  if (!a.category) return ERRORS.noCategory;
  const { mode, difficulty, rounds } = d.settings;
  const plan = levelPlan(difficulty, rounds);
  // shortcut: Picture mode's missing-photo drop is the gateway's, with photo tokens (F48).
  const pool = snapshotPool(a.category, mode, plan);
  const short = poolShortfall(a.category.name, pool, mode, difficulty, rounds);
  if (short) return short;
  newGame(d, a.category, pool, plan);
  return openRound(d, 1, now, fx);
}

/**
 * Between-round settings (spec: VIP controls, Mixed difficulty): timer and total rounds, at
 * SCOREBOARD only. Unplayed rounds take their level from the new total's plan; their multiplier
 * comes from `escalation(settings.rounds)` when they open. Played rounds keep theirs.
 */
function roundSettings(
  d: Room,
  a: Extract<Action, { type: 'vip:roundSettings' }>,
): string | undefined {
  if (a.by !== d.vipId) return ERRORS.notVip;
  if (d.phase !== 'SCOREBOARD') return ERRORS.notNow;
  if (d.paused) return ERRORS.paused;
  const game = d.game!;
  const played = game.played.length;
  // The same total changes nothing, so it needs neither check.
  if (a.settings.rounds !== undefined && a.settings.rounds !== d.settings.rounds) {
    if (a.settings.rounds <= played) return ERRORS.roundsPlayed;
    const fresh = levelPlan(d.settings.difficulty, a.settings.rounds);
    const plan = replan(game.levelPlan, played, fresh);
    const rest = plan.slice(played);
    const short = restShortfall(
      game.categoryName,
      game.pool,
      game.usedPlaceIds,
      d.settings.mode,
      rest,
    );
    if (short) return short;
    game.levelPlan = plan;
  }
  // zod's `.partial()` omits absent keys, so the spread never writes an undefined.
  d.settings = { ...d.settings, ...a.settings };
  return undefined;
}

/** New game (spec: Transitions): scores, used places and the plan start over; players are kept. */
function newGame(
  d: Room,
  category: Category,
  pool: ReturnType<typeof snapshotPool>,
  plan: ReturnType<typeof levelPlan>,
): void {
  // SPEC-QUESTION: DECISIONS 23 (game numbers keep rising across Back to lobby, for placeUsage)
  const number = Math.max(0, d.game?.number ?? 0, ...Object.values(d.placeUsage)) + 1;
  d.game = {
    number,
    categoryName: category.name,
    categoryEmoji: category.emoji,
    box: { ...category.box },
    scale: regionScale(category.box),
    labelStyle: category.labelStyle,
    pool,
    levelPlan: plan,
    usedPlaceIds: [],
    played: [],
    current: null,
    photoTokens: {},
  };
}

/** Open round `n` (spec: Transitions): draw its place, let waiting players in, enter INTRO. */
function openRound(d: Room, n: number, now: number, fx: Effect[]): string | undefined {
  const game = d.game!;
  const level = game.levelPlan[n - 1]!;
  const pick = pickPlace(game.pool[level] ?? [], game.usedPlaceIds, d.placeUsage, d.rngState);
  if (!pick) return `No spare places left at ${level[0]!.toUpperCase()}${level.slice(1)}`;
  d.rngState = pick.rngState;
  game.usedPlaceIds.push(pick.place.id);
  d.placeUsage[pick.place.id] = game.number;
  game.current = {
    number: n,
    placeId: pick.place.id,
    level,
    multiplier: escalation(d.settings.rounds)[n - 1]!,
    photoToken: null, // shortcut: Picture mode's token comes with photo serving (F48).
    startedAt: null,
    endsAt: null,
    participants: [],
    everConnected: [],
    aims: {},
    locks: {},
    results: null,
    revealStage: 'pins',
    revealedCount: 0,
  };
  for (const p of Object.values(d.players)) p.waiting = false;
  enterPhase(d, 'INTRO');
  schedule(d, 'introDone', now + INTRO_MS, now, fx);
  return undefined;
}

/** INTRO → GUESSING: everyone in the game (not waiting) plays; the clock starts now. */
function startGuessing(d: Room, now: number, fx: Effect[]): void {
  const round = d.game!.current!;
  const players = Object.values(d.players)
    .filter((p) => !p.waiting)
    .sort((x, y) => x.joinedAt - y.joinedAt);
  enterPhase(d, 'GUESSING');
  round.startedAt = now;
  round.endsAt = now + d.settings.timerSeconds * 1000;
  round.participants = players.map((p) => p.id);
  round.everConnected = players.filter((p) => p.connected).map((p) => p.id);
  schedule(d, 'guessUp', round.endsAt + GRACE_MS, now, fx);
}

/** Timers drive every transition after Start (spec: Transitions, Scheduled timers). */
function timer(
  d: Room,
  a: Extract<Action, { type: 'timer' }>,
  now: number,
  fx: Effect[],
): string | undefined {
  if (a.timer === 'vipGone') {
    // Only the deadline it was set for counts: a VIP who came back (or dropped again) moved it.
    // That match is its guard, so it outlives round changes; an epoch bump (`addReason`; rematch,
    // F24) must re-schedule it while vipAwayUntil is set.
    // SPEC-QUESTION: DECISIONS 24 (vipGone ignores the round number)
    const sameGame = a.game === (d.game?.number ?? 0) && a.epoch === d.timerEpoch;
    if (sameGame && a.at === d.vipAwayUntil) succeed(d, fx);
    return undefined;
  }
  // These two outlive rounds and pauses too: their exact `at` match is their guard (DECISIONS 28).
  if (a.timer === 'screenGone') {
    if (a.at !== d.screenAwayUntil) return undefined;
    d.screenAwayUntil = null;
    if (d.screenCount === 0 && TIMED_PHASES.includes(d.phase)) addReason(d, 'screenAway', now, fx);
    return undefined;
  }
  if (a.timer === 'resumeGo') {
    if (d.paused && a.at === d.paused.resumeAt) resume(d, now, fx);
    return undefined;
  }
  if (isStale(d, a)) return undefined;
  const round = d.game?.current;
  switch (`${d.phase} ${a.timer}`) {
    case 'INTRO introDone':
      startGuessing(d, now, fx);
      return undefined;
    case 'GUESSING allLocked':
      // A reconnect since it was scheduled may have reopened the round.
      if (!allLocked(d)) return undefined;
      startReveal(d, now, fx);
      return undefined;
    case 'GUESSING guessUp':
      startReveal(d, now, fx);
      return undefined;
    case 'REVEAL revealTarget':
      if (round!.revealStage === 'pins') round!.revealStage = 'target';
      return undefined;
    case 'REVEAL revealStep': {
      const scored = round!.results!.filter((r) => r.position).length;
      round!.revealStage = 'lines';
      round!.revealedCount = Math.max(round!.revealedCount, Math.min((a.k ?? 0) + 1, scored));
      return undefined;
    }
    case 'REVEAL revealDone':
      endReveal(d, now, fx);
      return undefined;
    case 'SCOREBOARD scoreboardDone':
      return openRound(d, d.game!.played.at(-1)!.number + 1, now, fx);
    default:
      return undefined;
  }
}

/** Score the round (spec: Scoring rules) in reveal order, enter REVEAL, schedule its timeline. */
function startReveal(d: Room, now: number, fx: Effect[]): void {
  const game = d.game!;
  const round = game.current!;
  const place = game.pool[round.level]!.find((p) => p.id === round.placeId)!;
  const centre = mercatorCentre(game.box);
  const rows = round.participants.map((playerId): RoundResult => {
    const missed = { position: null, lockedIn: false, distanceKm: null, basePoints: 0 };
    if (!round.everConnected.includes(playerId))
      return { playerId, ...missed, bullseye: false, multiplier: round.multiplier, points: 0 };
    const lock = round.locks[playerId];
    // An unlocked participant is scored at their crosshair: the last aim, else the opening centre.
    const position = lock ? { lat: lock.lat, lng: lock.lng } : (round.aims[playerId] ?? centre);
    const distanceKm = haversineKm(position, place);
    const base = basePoints(distanceKm, game.scale);
    return {
      playerId,
      position,
      lockedIn: Boolean(lock),
      distanceKm,
      basePoints: base,
      bullseye: distanceKm <= bullseyeRadius(game.scale),
      multiplier: round.multiplier,
      points: withMultiplier(base, round.multiplier),
    };
  });
  const joinedAt = (id: string) => d.players[id]!.joinedAt;
  // Distance descending, so the closest is revealed last; missed rows (no distance) come after.
  // SPEC-QUESTION: DECISIONS 24 (missed rows sit after the scored ones, outside the steps)
  round.results = rows.sort(
    (x, y) =>
      (y.distanceKm ?? -1) - (x.distanceKm ?? -1) || joinedAt(x.playerId) - joinedAt(y.playerId),
  );
  enterPhase(d, 'REVEAL');
  const n = rows.filter((r) => r.position).length;
  const step = revealStepMs(n);
  schedule(d, 'revealTarget', now + REVEAL_TARGET_MS, now, fx);
  for (let k = 0; k < n; k++)
    schedule(d, 'revealStep', now + REVEAL_FIRST_STEP_MS + k * step, now, fx, k);
  const doneAt = now + REVEAL_FIRST_STEP_MS + n * step + REVEAL_DONE_AFTER_MS;
  schedule(d, 'revealDone', doneAt, now, fx);
}

/**
 * REVEAL ends (its timer, `vip:next`, or `vip:end` with `final`): the round is played (totals
 * count it) with every row revealed, then SCOREBOARD, or FINAL after the last.
 */
function endReveal(d: Room, now: number, fx: Effect[], final = false): void {
  const game = d.game!;
  const round = game.current!;
  round.revealStage = 'done';
  round.revealedCount = round.results!.length;
  game.played.push(round);
  game.current = null;
  if (final || round.number >= d.settings.rounds) {
    enterPhase(d, 'FINAL');
    return;
  }
  enterPhase(d, 'SCOREBOARD');
  schedule(d, 'scoreboardDone', now + SCOREBOARD_MS, now, fx);
}

/** A new phase starts with none of the old phase's timers pending (nor held by a pause). */
function enterPhase(d: Room, phase: Phase): void {
  d.phase = phase;
  d.phaseTimers = {};
  if (d.paused) d.paused.remainingMs = {};
}

/**
 * Pausing (spec): the first reason stores every pending phase timer's remaining time and bumps
 * `timerEpoch`, so the timers in flight go stale. A reason added during the 3-2-1 cancels it.
 */
function addReason(d: Room, reason: PauseReason, now: number, fx: Effect[]): void {
  if (d.paused) {
    if (!d.paused.reasons.includes(reason)) d.paused.reasons.push(reason);
    d.paused.resumeAt = null;
    return;
  }
  // Fired timers stay in `phaseTimers` and come back with 0 left, so every phase timer must be
  // safe to fire twice (the reveal steps take the max, allLocked re-checks, the rest change phase).
  const remainingMs = Object.fromEntries(
    Object.entries(d.phaseTimers).map(([key, at]) => [key, Math.max(0, at - now)]),
  );
  d.paused = { reasons: [reason], since: now, remainingMs, resumeAt: null };
  bumpEpoch(d, now, fx);
}

/** Every timer in flight goes stale; a pending `vipGone` is re-scheduled with the new epoch. */
function bumpEpoch(d: Room, now: number, fx: Effect[]): void {
  d.timerEpoch += 1;
  if (d.vipAwayUntil !== null) schedule(d, 'vipGone', d.vipAwayUntil, now, fx);
}

/** The last reason cleared starts the 3-2-1; `resumeGo` then restarts the clock. */
function clearReason(d: Room, reason: PauseReason, now: number, fx: Effect[]): void {
  const paused = d.paused!;
  paused.reasons = paused.reasons.filter((r) => r !== reason);
  if (paused.reasons.length > 0) return;
  paused.resumeAt = now + RESUME_COUNTDOWN_MS;
  schedule(d, 'resumeGo', paused.resumeAt, now, fx);
}

/** `resumeGo`: the held timers restart with their remaining time; `endsAt` moves by the pause. */
function resume(d: Room, now: number, fx: Effect[]): void {
  const { since, remainingMs } = d.paused!;
  d.paused = null;
  const round = d.game?.current;
  if (round?.endsAt != null) round.endsAt += now - since;
  for (const [key, ms] of Object.entries(remainingMs)) {
    const [timer, k] = key.split(':');
    schedule(d, timer as TimerName, now + ms, now, fx, k === undefined ? undefined : Number(k));
  }
}

/** The round a timer belongs to: the current one, else (SCOREBOARD, FINAL) the last played. */
const timerRound = (d: Room) => d.game?.current?.number ?? d.game?.played.at(-1)?.number ?? 0;

/** A timer set for another round, game or `timerEpoch` is ignored (spec: Scheduled timers). */
function isStale(d: Room, a: TimerFields): boolean {
  return a.round !== timerRound(d) || a.game !== (d.game?.number ?? 0) || a.epoch !== d.timerEpoch;
}

/**
 * A phase timer is remembered by key (`revealStep:2`) for a pause; while paused it is only stored
 * with its full delay, and goes out on the resume.
 */
function schedule(
  d: Room,
  timer: TimerName,
  at: number,
  now: number,
  fx: Effect[],
  k?: number,
): void {
  if (PHASE_TIMERS.includes(timer)) {
    const key = k === undefined ? timer : `${timer}:${k}`;
    if (d.paused) {
      d.paused.remainingMs[key] = at - now;
      return;
    }
    d.phaseTimers[key] = at;
  }
  fx.push({
    type: 'schedule',
    at,
    timer,
    round: timerRound(d),
    game: d.game?.number ?? 0,
    epoch: d.timerEpoch,
    ...(k !== undefined && { k }),
  });
}

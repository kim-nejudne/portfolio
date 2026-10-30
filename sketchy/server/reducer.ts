// The game logic: a pure `reduce(room, action, now) → {room, effects}`. See "Game flow and state
// machine" in docs/spec.md. No I/O, timers, clocks or `Math.random`: `now` is the gateway's
// monotonic ms, randomness comes from the seeded RNG in `room.rngState`, and timers go out as
// `schedule` effects carrying `turnId` and `timerEpoch`.
//
// v0 (F04): LOBBY → DRAWING → REVEAL → … → FINAL after one cycle. CHOOSING and the deck (F18),
// cycles and SCOREBOARD (F20), overlapped choosing (F21), corrected timing (F13), matching (F14)
// and the rest arrive with their features; their actions are rejected as `notAvailable` until then.

import {
  ALL_GUESSED_MS,
  CLOSE_GUESSES_MAX,
  FEED_MAX,
  GRACE_MS,
  GUESS_INTERVAL_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NAME_OF_DISCONNECTED_ERROR,
  PLAYER_COLORS,
  REVEAL_MS,
} from '../shared/constants.js';
import type {
  Action,
  Effect,
  Phase,
  Player,
  ReduceError,
  Room,
  Sender,
  Turn,
  TurnEndReason,
  WordEntry,
} from '../shared/types.js';
import { correctedAt } from './fairness.js';
import { guessRejection, matchGuess } from './match.js';
import { createRng } from './rng.js';
import { drawerPoints, guesserPoints } from './scoring.js';
import { V0_WORDS } from './words.v0.js';

export type ReduceResult =
  { ok: true; room: Room; effects: Effect[] } | { ok: false; error: ReduceError };

type ActionOf<T extends Action['type']> = Extract<Action, { type: T }>;

/** A handler mutates `d`, a private copy of the room, and pushes effects; or returns an error. */
type Handled = ReduceError | undefined;

const PID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const PID_LENGTH = 8;

export function reduce(room: Room, action: Action, now: number): ReduceResult {
  const d = structuredClone(room);
  const effects: Effect[] = [];
  const error = apply(d, action, now, effects);
  return error ? { ok: false, error } : { ok: true, room: d, effects };
}

function apply(d: Room, action: Action, now: number, fx: Effect[]): Handled {
  switch (action.type) {
    case 'player:join':
      return join(d, action, now, fx);
    case 'player:leave':
      return leave(d, action, now, fx);
    case 'player:guess':
      return guess(d, action, now, fx);
    case 'host:start':
      return start(d, action, now, fx);
    case 'host:skip':
      return skip(d, action, now, fx);
    case 'host:next':
      return next(d, action, now, fx);
    case 'timer':
      return timer(d, action, now, fx);
    case 'sys:connected':
    case 'sys:disconnected':
      return connection(d, action);
    case 'sys:screens':
      d.screens = action.count;
      return undefined;
    case 'player:rename':
    case 'player:react':
    case 'player:visibility':
    case 'drawer:choose':
    case 'host:pause':
    case 'host:resume':
    case 'host:kick':
    case 'host:crown':
    case 'host:settings':
    case 'host:customWords':
    case 'host:end':
    case 'host:rematch':
    case 'host:rematchCancel':
    case 'host:backToLobby':
    case 'sys:doodle':
      return 'notAvailable';
    default: {
      action satisfies never;
      return 'unknownAction';
    }
  }
}

// ---------- Senders ----------

/** Host actions need `isHost`, and a player sender must also hold the crown. */
function isHost(d: Room, by: Sender): boolean {
  if (!by.isHost) return false;
  return by.kind === 'screen' || (by.pid !== undefined && by.pid === d.crownPid);
}

/** The sending player, or why there isn't one. */
function senderPlayer(d: Room, by: Sender): Player | 'notPlayer' | 'unknownPlayer' {
  if (by.kind !== 'player' || by.pid === undefined) return 'notPlayer';
  return d.players[by.pid] ?? 'unknownPlayer';
}

// ---------- Players ----------

function join(d: Room, a: ActionOf<'player:join'>, now: number, fx: Effect[]): Handled {
  if (d.kickedKeyHashes.includes(a.keyHash)) return 'kicked';

  const players = Object.values(d.players);
  const same = players.find((p) => p.keyHash === a.keyHash);
  if (same) {
    same.connected = true;
    return undefined;
  }

  const key = a.name.toLocaleLowerCase();
  const holder = players.find((p) => p.name.toLocaleLowerCase() === key);
  if (holder) {
    if (holder.connected) return 'nameTaken';
    if (!a.takeOver) return NAME_OF_DISCONNECTED_ERROR;
    // A new phone takes over a disconnected player: their pid, score and crown.
    holder.keyHash = a.keyHash;
    holder.connected = true;
    holder.hidden = false;
    fx.push({ type: 'fx', to: 'screen', fx: { kind: 'rejoined', pid: holder.pid } });
    return undefined;
  }

  if (players.length >= MAX_PLAYERS) return 'roomFull';

  const pid = newPid(d);
  const used = new Set(players.map((p) => p.color));
  d.players[pid] = {
    pid,
    keyHash: a.keyHash,
    name: a.name,
    color: PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0],
    score: 0,
    connected: true,
    hidden: false,
    hasDoodle: false,
    joinedAt: now,
  };
  fx.push({ type: 'fx', to: 'screen', fx: { kind: 'join', pid } });
  // SPEC-QUESTION: a mid-game joiner is not added to this cycle's turn order until F23 (DECISIONS 18).
  if (d.crownPid === null) crown(d, pid, fx);
  return undefined;
}

/** A pid from the room's seeded RNG (DECISIONS 17), unique in the room. */
function newPid(d: Room): string {
  const rng = createRng(d.rngState);
  let pid: string;
  do {
    pid = 'p';
    for (let i = 0; i < PID_LENGTH; i++) pid += PID_ALPHABET[rng.int(PID_ALPHABET.length)];
  } while (d.players[pid]);
  d.rngState = rng.state;
  return pid;
}

function crown(d: Room, pid: string | null, fx: Effect[]): void {
  d.crownPid = pid;
  if (pid) fx.push({ type: 'fx', to: { pid }, fx: { kind: 'crowned' } });
}

function leave(d: Room, a: ActionOf<'player:leave'>, now: number, fx: Effect[]): Handled {
  const player = senderPlayer(d, a.by);
  if (typeof player === 'string') return player;
  const { pid } = player;
  delete d.players[pid];

  // Keep `turnIndex` on the turn just played, so the next turn is still `turnIndex + 1`.
  const index = d.turnOrder.indexOf(pid);
  if (index !== -1) {
    d.turnOrder.splice(index, 1);
    if (index <= d.turnIndex) d.turnIndex -= 1;
  }

  if (d.crownPid === pid) {
    // The longest-connected remaining player: the earliest joiner who is connected, else the
    // earliest joiner.
    const heir = Object.values(d.players).sort(
      (x, y) => Number(y.connected) - Number(x.connected) || x.joinedAt - y.joinedAt,
    )[0];
    crown(d, heir?.pid ?? null, fx);
  }

  if (d.phase === 'DRAWING') {
    if (d.turn?.drawerPid === pid) endTurn(d, 'skip', now, fx);
    // The leaver may have been the last guesser still drawing a blank.
    else if (!d.turn?.correct.some((c) => c.pid === pid)) checkAllGuessed(d, now, fx);
  }
  return undefined;
}

function connection(d: Room, a: ActionOf<'sys:connected' | 'sys:disconnected'>): Handled {
  const player = d.players[a.pid];
  if (!player) return 'unknownPlayer';
  // The crown stays on disconnect; it passes only on leave or kick.
  player.connected = a.type === 'sys:connected';
  return undefined;
}

// ---------- Game flow ----------

function setPhase(d: Room, phase: Phase): void {
  d.phase = phase;
  d.timerEpoch += 1;
}

function start(d: Room, a: ActionOf<'host:start'>, now: number, fx: Effect[]): Handled {
  if (d.phase !== 'LOBBY') return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  const players = Object.values(d.players).sort((x, y) => x.joinedAt - y.joinedAt);
  if (players.filter((p) => p.connected).length < MIN_PLAYERS) return 'notEnoughPlayers';

  d.turnOrder = players.map((p) => p.pid);
  d.turnIndex = -1;
  d.cycle = 1;
  advance(d, now, fx);
  d.session.firstDrawerJoinedAt = d.players[d.turn!.drawerPid]!.joinedAt;
  return undefined;
}

/**
 * The next connected drawer in `turnOrder` draws, or the game ends. A disconnected player is
 * skipped for this cycle.
 */
// SPEC-QUESTION: v0 plays one cycle whatever `settings.cycles` says; F20 adds cycles and SCOREBOARD (DECISIONS 18).
function advance(d: Room, now: number, fx: Effect[]): void {
  for (let i = d.turnIndex + 1; i < d.turnOrder.length; i++) {
    const pid = d.turnOrder[i]!;
    if (d.players[pid]?.connected) {
      startDrawing(d, i, now, fx);
      return;
    }
  }
  d.turnIndex = d.turnOrder.length;
  setPhase(d, 'FINAL');
}

/** v0 deal and start in one: three random words, the first one chosen, the clock running. */
function startDrawing(d: Room, index: number, now: number, fx: Effect[]): void {
  const rng = createRng(d.rngState);
  const [first, second, third] = rng.shuffle(V0_WORDS) as [WordEntry, WordEntry, WordEntry];
  d.rngState = rng.state;

  const drawerPid = d.turnOrder[index]!;
  const endsAt = now + d.settings.drawSeconds * 1000;
  const turn: Turn = {
    id: ++d.turnCounter,
    cycle: d.cycle,
    drawerPid,
    choices: [first, second, third],
    dealtAt: now,
    word: first,
    clockStart: now,
    endsAt,
    hintIndexes: [],
    correct: [],
    feed: [],
    closeGuesses: [],
    closeCount: {},
    guessCount: {},
    lastGuessAt: {},
    drawerPoints: 0,
    endReason: null,
  };
  d.turnIndex = index;
  d.turn = turn;
  setPhase(d, 'DRAWING');

  fx.push(
    { type: 'fx', to: { pid: drawerPid }, fx: { kind: 'yourTurn' } },
    { type: 'inkOpen', turnId: turn.id, drawerPid },
    schedule(d, 'drawUp', endsAt + GRACE_MS),
  );
}

function schedule(d: Room, timer: 'drawUp' | 'allGuessed' | 'revealDone', at: number): Effect {
  return { type: 'schedule', at, timer, turnId: d.turn!.id, epoch: d.timerEpoch };
}

function guess(d: Room, a: ActionOf<'player:guess'>, now: number, fx: Effect[]): Handled {
  const turn = d.turn;
  if (d.phase !== 'DRAWING' || !turn?.word || turn.endsAt === null || turn.clockStart === null)
    return 'wrongPhase';
  if (d.paused) return 'paused';
  const player = senderPlayer(d, a.by);
  if (typeof player === 'string') return player;
  const { pid } = player;
  if (pid === turn.drawerPid) return 'drawerCannotGuess';
  if (turn.correct.some((c) => c.pid === pid)) return 'alreadyGuessed';
  // Latency correction: when the guess was sent, as best the server can tell. The server takes
  // guesses until `endsAt + GRACE_MS`, but only those sent by `endsAt` count.
  const sentAt = correctedAt(a.receivedAt, a.oneWayMs);
  if (a.receivedAt > turn.endsAt + GRACE_MS || sentAt > turn.endsAt) return 'tooLate';
  const rejected = guessRejection(a.text);
  if (rejected) return rejected;
  // One guess per GUESS_INTERVAL_MS per player, by arrival time; refused ones don't restart it.
  const last = turn.lastGuessAt[pid];
  if (last !== undefined && a.receivedAt - last < GUESS_INTERVAL_MS) return 'slowDown';
  turn.lastGuessAt[pid] = a.receivedAt;

  turn.guessCount[pid] = (turn.guessCount[pid] ?? 0) + 1;
  const match = matchGuess(a.text, turn.word);

  if (match === 'close') {
    // Never fed or shown on the Screen during the turn: it could give the word away. Kept for
    // the reveal's "Almost:" and counted for awards; only this phone hears "So close!".
    // SPEC-QUESTION: masking a close guess per `guessFeed` arrives with F15 (DECISIONS 37).
    turn.closeGuesses = [...turn.closeGuesses, { pid, text: a.text, at: now }].slice(
      -CLOSE_GUESSES_MAX,
    );
    turn.closeCount[pid] = (turn.closeCount[pid] ?? 0) + 1;
    fx.push({ type: 'fx', to: { pid }, fx: { kind: 'nearMiss' } });
    return undefined;
  }

  if (match === 'wrong') {
    // SPEC-QUESTION: masking per `guessFeed` arrives with F15; v0 feeds every wrong guess as
    // typed (DECISIONS 18).
    turn.feed = [...turn.feed, { pid, text: a.text, at: now }].slice(-FEED_MAX);
    fx.push(
      { type: 'fx', to: 'screen', fx: { kind: 'wrongGuess', pid, text: a.text } },
      { type: 'fx', to: { pid }, fx: { kind: 'wrong' } },
    );
    return undefined;
  }

  // A guess sent within the latency correction of the start counts as at the start.
  const elapsedMs = Math.max(0, sentAt - turn.clockStart);
  const points = guesserPoints(d.settings.drawSeconds * 1000, elapsedMs);
  // In corrected-time order, so a slow phone that typed first is listed first; equal times keep
  // arrival order. Earlier `correct` fx keep the order they announced (DECISIONS 36).
  const at = turn.correct.findIndex((c) => c.elapsedMs > elapsedMs);
  const index = at === -1 ? turn.correct.length : at;
  const oneWayMs = Number.isFinite(a.oneWayMs) ? Math.max(0, a.oneWayMs) : 0;
  turn.correct.splice(index, 0, { pid, receivedAt: a.receivedAt, oneWayMs, elapsedMs, points });
  player.score += points;
  fx.push({
    type: 'fx',
    to: 'all',
    fx: { kind: 'correct', pid, points, order: index + 1 },
  });

  checkAllGuessed(d, now, fx);
  return undefined;
}

/**
 * Every connected guesser is correct (and at least one is): end the turn in 1.5 s. A second
 * schedule is harmless; whichever fires first moves the phase and the other goes stale.
 */
function checkAllGuessed(d: Room, now: number, fx: Effect[]): void {
  const turn = d.turn!;
  if (turn.correct.length === 0) return;
  const guessers = Object.values(d.players).filter((p) => p.connected && p.pid !== turn.drawerPid);
  if (guessers.every((p) => turn.correct.some((c) => c.pid === p.pid)))
    fx.push(schedule(d, 'allGuessed', now + ALL_GUESSED_MS));
}

/** DRAWING → REVEAL: the drawer's half, the summary, `inkClose`, `turnEnd`, maybe `revealDone`. */
function endTurn(d: Room, reason: TurnEndReason, now: number, fx: Effect[]): void {
  const turn = d.turn!;
  turn.drawerPoints = drawerPoints(turn.correct.map((c) => c.points));
  turn.endReason = reason;
  const drawer = d.players[turn.drawerPid];
  if (drawer) drawer.score += turn.drawerPoints;

  const points: Record<string, number> = {};
  for (const c of turn.correct) points[c.pid] = c.points;
  if (turn.drawerPoints > 0) points[turn.drawerPid] = turn.drawerPoints;
  const wrong: Record<string, number> = {};
  for (const [pid, count] of Object.entries(turn.guessCount)) {
    const misses = count - (points[pid] ? 1 : 0) - (turn.closeCount[pid] ?? 0);
    if (misses > 0) wrong[pid] = misses;
  }
  d.history.push({
    turnId: turn.id,
    drawerPid: turn.drawerPid,
    word: turn.word!.word,
    points,
    correct: turn.correct.map(({ pid, elapsedMs }) => ({ pid, elapsedMs })),
    close: { ...turn.closeCount },
    wrong,
    // SPEC-QUESTION: the InkStore may drop this log later (4 MB per room) without the reducer
    // knowing; `ink:get` then answers `inkNotKept` and the gallery shows "Drawing not kept".
    hasInk: true,
  });

  setPhase(d, 'REVEAL');
  fx.push(
    { type: 'inkClose', turnId: turn.id },
    { type: 'fx', to: 'all', fx: { kind: 'turnEnd', reason } },
  );
  if (d.settings.autoAdvance) fx.push(schedule(d, 'revealDone', now + REVEAL_MS));
}

function skip(d: Room, a: ActionOf<'host:skip'>, now: number, fx: Effect[]): Handled {
  if (d.phase !== 'DRAWING') return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  endTurn(d, 'skip', now, fx);
  return undefined;
}

function next(d: Room, a: ActionOf<'host:next'>, now: number, fx: Effect[]): Handled {
  if (d.phase !== 'REVEAL') return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  if (d.paused) return 'paused';
  advance(d, now, fx);
  return undefined;
}

function timer(d: Room, a: ActionOf<'timer'>, now: number, fx: Effect[]): Handled {
  if (!d.turn || a.turnId !== d.turn.id || a.epoch !== d.timerEpoch) return 'staleTimer';
  switch (a.timer) {
    case 'drawUp':
    case 'allGuessed':
      if (d.phase !== 'DRAWING') return 'wrongPhase';
      endTurn(d, a.timer === 'drawUp' ? 'time' : 'allGuessed', now, fx);
      return undefined;
    case 'revealDone':
      if (d.phase !== 'REVEAL') return 'wrongPhase';
      advance(d, now, fx);
      return undefined;
    default:
      return 'notAvailable';
  }
}

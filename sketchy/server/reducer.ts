// The game logic: a pure `reduce(room, action, now) → {room, effects}`. See "Game flow and state
// machine" in docs/spec.md. No I/O, timers, clocks or `Math.random`: `now` is the gateway's
// monotonic ms, randomness comes from the seeded RNG in `room.rngState`, and timers go out as
// `schedule` effects carrying `turnId` and `timerEpoch`.
//
// LOBBY → CHOOSING → DRAWING → REVEAL → … → SCOREBOARD between cycles → … → FINAL after
// `settings.cycles` cycles. From the second turn the next drawer is dealt as `upcoming` on entering
// REVEAL and chooses during REVEAL and SCOREBOARD (overlapped choosing). A pause freezes every
// phase timer. FINAL → a new game by Rematch (after a 3-2-1) or Back to lobby. Actions of features
// still to come are rejected as `notAvailable` until then.

import {
  ALL_GUESSED_MS,
  CHOOSE_MS,
  DEFAULT_SETTINGS,
  CLOSE_GUESSES_MAX,
  FEED_MAX,
  GRACE_MS,
  GUESS_INTERVAL_MS,
  HINT_AT,
  MAX_PLAYERS,
  MID_GAME_SETTINGS,
  MIN_PLAYERS,
  NAME_OF_DISCONNECTED_ERROR,
  PLAYER_COLORS,
  REMATCH_COUNTDOWN_MS,
  RESUME_COUNTDOWN_MS,
  REVEAL_MS,
  SCOREBOARD_MS,
} from '../shared/constants.js';
import type {
  Action,
  ChoiceIndex,
  Effect,
  PauseReason,
  Phase,
  Player,
  ReduceError,
  Room,
  RoomSettings,
  Sender,
  Turn,
  TurnEndReason,
} from '../shared/types.js';
import {
  allowedWords,
  CHOICE_COUNT,
  chooseWord,
  drawChoices,
  easiestIndex,
  newDeck,
  returnChoices,
  returnDealt,
} from './deck.js';
import { correctedAt } from './fairness.js';
import { hintCount, pickHint } from './hints.js';
import { guessRejection, matchGuess } from './match.js';
import { feedText } from './profanity.js';
import { createRng } from './rng.js';
import { drawerPoints, guesserPoints } from './scoring.js';
import { cycleOrder } from './turnOrder.js';

export type ReduceResult =
  { ok: true; room: Room; effects: Effect[] } | { ok: false; error: ReduceError };

type ActionOf<T extends Action['type']> = Extract<Action, { type: T }>;

/** A handler mutates `d`, a private copy of the room, and pushes effects; or returns an error. */
type Handled = ReduceError | undefined;

const PID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const PID_LENGTH = 8;

export function reduce(room: Room, action: Action, now: number): ReduceResult {
  // The packs are frozen and shared by every room, so they are passed on, never copied.
  const { packs, ...rest } = room;
  const d: Room = { ...structuredClone(rest), packs };
  const effects: Effect[] = [];
  const error = apply(d, action, now, effects);
  // Every phase timer is frozen at `since`, so what it had left is read from there.
  if (!error && d.paused) d.paused.remainingMs = phaseLeft(d, d.paused.since);
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
    case 'drawer:choose':
      return choose(d, action, now, fx);
    case 'host:start':
      return start(d, action, now, fx);
    case 'host:skip':
      return skip(d, action, now, fx);
    case 'host:next':
      return next(d, action, now, fx);
    case 'host:settings':
      return settings(d, action);
    case 'host:crown':
      return giveCrown(d, action, fx);
    case 'host:pause':
      return hostPause(d, action, now);
    case 'host:resume':
      return hostResume(d, action, now, fx);
    case 'host:kick':
      return kick(d, action, now, fx);
    case 'host:end':
      return end(d, action, now, fx);
    case 'host:rematch':
      return rematch(d, action, now, fx);
    case 'host:rematchCancel':
      return rematchCancel(d, action);
    case 'host:backToLobby':
      return backToLobby(d, action, now, fx);
    case 'timer':
      return timer(d, action, now, fx);
    case 'sys:connected':
    case 'sys:disconnected':
      return connection(d, action, now, fx);
    case 'sys:screens':
      d.screens = action.count;
      return undefined;
    case 'sys:doodle':
      return doodle(d, action);
    case 'player:react':
      return react(d, action, fx);
    case 'player:rename':
    case 'player:visibility':
    case 'host:customWords':
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
    // Strictly after everyone here: the turn order and the rematch rotation read join order from it.
    // SPEC-QUESTION: the spec stores `now`; two joins in one ms would tie (DECISIONS 52).
    joinedAt: Math.max(now, ...players.map((p) => p.joinedAt + 1)),
  };
  fx.push({ type: 'fx', to: 'screen', fx: { kind: 'join', pid } });
  appendLateJoiner(d, pid);
  if (d.crownPid === null) crown(d, pid, fx);
  return undefined;
}

/**
 * **Late joiners** (Turn order): a new player joining mid-game is appended to this cycle's
 * `turnOrder` if at least one turn remains after the current one. Otherwise they draw from the next
 * cycle, whose order is built in join order, and in the last cycle they only guess. In REVEAL and
 * SCOREBOARD a standing `upcoming` deal decides: one of this cycle is a turn after the one just
 * played; one of the next cycle means `turnOrder` is already that cycle's, so they draw in it. With
 * no deal, the next cycle's order (if any) is still to be built and will include them. They can
 * guess at once either way: guessing never reads `turnOrder`.
 */
// SPEC-QUESTION: "a turn remains" counts places in turnOrder, connected or not (DECISIONS 46).
function appendLateJoiner(d: Room, pid: string): void {
  const inTurn = d.phase === 'CHOOSING' || d.phase === 'DRAWING';
  const remains = d.upcoming !== null || (inTurn && d.turnIndex < d.turnOrder.length - 1);
  if (remains && !d.turnOrder.includes(pid)) d.turnOrder.push(pid);
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

/**
 * After the crown holder has gone (leave or kick): the longest-connected remaining player,
 * i.e. the earliest joiner who is connected, else the earliest joiner; nobody in an empty room.
 */
function passCrown(d: Room, fx: Effect[]): void {
  const heir = Object.values(d.players).sort(
    (x, y) => Number(y.connected) - Number(x.connected) || x.joinedAt - y.joinedAt,
  )[0];
  crown(d, heir?.pid ?? null, fx);
}

/**
 * `host:crown`, in any phase: the token Screen or the crown holder moves the crown to another
 * player, who gets `crowned` (their "You're the host now 👑" toast). The old holder's phone loses
 * its host block with the next view. Giving it to its holder changes nothing.
 */
// SPEC-QUESTION: a disconnected player may be given the crown; the Screen's controls still work (DECISIONS 48).
function giveCrown(d: Room, a: ActionOf<'host:crown'>, fx: Effect[]): Handled {
  if (!isHost(d, a.by)) return 'notHost';
  if (!d.players[a.pid]) return 'unknownPlayer';
  if (d.crownPid !== a.pid) crown(d, a.pid, fx);
  return undefined;
}

function leave(d: Room, a: ActionOf<'player:leave'>, now: number, fx: Effect[]): Handled {
  const player = senderPlayer(d, a.by);
  if (typeof player === 'string') return player;
  removePlayer(d, player.pid, now, fx);
  return undefined;
}

/**
 * `host:kick`, in any phase: removed as on leave, and their `keyHash` can't join this room again.
 * The gateway sends them `kicked` and disconnects them. Not their own pid: Leave is for that.
 */
function kick(d: Room, a: ActionOf<'host:kick'>, now: number, fx: Effect[]): Handled {
  if (!isHost(d, a.by)) return 'notHost';
  const target = d.players[a.pid];
  if (!target) return 'unknownPlayer';
  // SPEC-QUESTION: the spec allows any pid; the crown holder's own is refused (DECISIONS 51).
  if (a.by.kind === 'player' && a.by.pid === a.pid) return 'cannotKickSelf';
  d.kickedKeyHashes.push(target.keyHash);
  removePlayer(d, a.pid, now, fx);
  fx.push({ type: 'kick', pid: a.pid });
  return undefined;
}

/**
 * A player leaves or is kicked: out of the room and the turn order, their doodle dropped, the
 * crown passed on, and their turn ended as a skip if they were drawing.
 */
function removePlayer(d: Room, pid: string, now: number, fx: Effect[]): void {
  // A finished game's points stay in the night's totals; mid-game they are lost, as Leave warns.
  if (d.phase === 'FINAL') bankScore(d, d.players[pid]!);
  delete d.players[pid];
  fx.push({ type: 'doodleDrop', pid });

  // Keep `turnIndex` on the turn just played, so the next turn is still `turnIndex + 1`.
  const index = d.turnOrder.indexOf(pid);
  if (index !== -1) {
    d.turnOrder.splice(index, 1);
    if (index <= d.turnIndex) d.turnIndex -= 1;
  }

  if (d.crownPid === pid) passCrown(d, fx);

  // The upcoming drawer leaving (REVEAL, SCOREBOARD) is dealt with at take-up.
  if (d.phase === 'CHOOSING' && d.turn?.drawerPid === pid) {
    abandonChoice(d, now, fx);
  } else if (d.phase === 'DRAWING') {
    if (d.turn?.drawerPid === pid) endTurn(d, 'skip', now, fx);
    // The leaver may have been the last guesser still drawing a blank.
    else if (!d.turn?.correct.some((c) => c.pid === pid)) checkAllGuessed(d, now, fx);
  }
}

/** The ink gateway stored or dropped a lobby doodle. Only a drop (`has: false`) outside LOBBY. */
function doodle(d: Room, a: ActionOf<'sys:doodle'>): Handled {
  const player = d.players[a.pid];
  if (!player) return 'unknownPlayer';
  if (a.has && d.phase !== 'LOBBY') return 'wrongPhase';
  player.hasDoodle = a.has;
  return undefined;
}

function connection(
  d: Room,
  a: ActionOf<'sys:connected' | 'sys:disconnected'>,
  now: number,
  fx: Effect[],
): Handled {
  const player = d.players[a.pid];
  if (!player) return 'unknownPlayer';
  // The crown stays on disconnect; it passes only on leave or kick.
  player.connected = a.type === 'sys:connected';
  // A disconnected player doesn't hold the turn open: they may have been the last guesser without
  // the word. A reconnect never cancels a scheduled early end.
  // SPEC-QUESTION: the drawer disconnecting is F40's drawerAway pause; here it changes nothing.
  const turn = d.turn;
  if (
    a.type === 'sys:disconnected' &&
    d.phase === 'DRAWING' &&
    turn &&
    a.pid !== turn.drawerPid &&
    !turn.correct.some((c) => c.pid === a.pid)
  )
    checkAllGuessed(d, now, fx);
  return undefined;
}

// ---------- Game flow ----------

/**
 * Every phase change bumps `timerEpoch`, so the choice still open (CHOOSING's, or `upcoming`'s in
 * REVEAL and SCOREBOARD) gets its `chooseUp` again, still due 12 s after its deal. A pause ends
 * with the game (FINAL, LOBBY); otherwise it holds the new phase too (a skip or kick while
 * paused): its timers count from now and wait for `resumeGo`, and a running 3-2-1 is re-armed.
 */
function setPhase(d: Room, phase: Phase, now: number, fx: Effect[]): void {
  d.phase = phase;
  d.timerEpoch += 1;
  d.advanceAt = null;
  if (phase === 'LOBBY' || phase === 'FINAL') d.paused = null;
  if (d.paused) {
    d.paused.since = now;
    if (d.paused.resumeAt !== null) fx.push(schedule(d, 'resumeGo', d.paused.resumeAt));
    return;
  }
  scheduleChooseUp(d, fx);
}

/** REVEAL or SCOREBOARD with auto-advance: due at `at`, held (and moved) by a pause. */
function autoAdvance(
  d: Room,
  timer: 'revealDone' | 'scoreboardDone',
  at: number,
  fx: Effect[],
): void {
  d.advanceAt = at;
  if (!d.paused) fx.push(schedule(d, timer, at));
}

/** What the current phase's timer has left at `at`: the clock, the choice or the auto-advance. */
function phaseLeft(d: Room, at: number): number | null {
  const due =
    d.phase === 'DRAWING'
      ? (d.turn?.endsAt ?? null)
      : d.phase === 'CHOOSING' && d.turn
        ? d.turn.dealtAt + CHOOSE_MS
        : d.advanceAt;
  return due === null ? null : Math.max(0, due - at);
}

/** The dealt turn whose word is still to be chosen, if any. */
function openChoice(d: Room): Turn | null {
  const turn = d.phase === 'CHOOSING' ? d.turn : inBetween(d.phase) ? d.upcoming : null;
  return turn && turn.word === null ? turn : null;
}

const inBetween = (phase: Phase) => phase === 'REVEAL' || phase === 'SCOREBOARD';

/** `chooseUp` for the open choice at this epoch. `resumeGo` calls it after moving `dealtAt`. */
function scheduleChooseUp(d: Room, fx: Effect[]): void {
  const open = openChoice(d);
  if (open) fx.push(schedule(d, 'chooseUp', open.dealtAt + CHOOSE_MS, open.id));
}

function start(d: Room, a: ActionOf<'host:start'>, now: number, fx: Effect[]): Handled {
  if (d.phase !== 'LOBBY') return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  if (Object.values(d.players).filter((p) => p.connected).length < MIN_PLAYERS)
    return 'notEnoughPlayers';
  if (allowedWords(d.packs, d.settings).length < CHOICE_COUNT) return 'notEnoughWords';
  // A game started from the lobby always begins with the earliest joiner.
  d.rotateAfter = null;
  beginGame(d, now, fx);
  return undefined;
}

/**
 * LOBBY → CHOOSING, or FINAL → CHOOSING by Rematch: the new game's deck, then cycle 1's first
 * deal. At least one player is connected, so there is a drawer; their `joinedAt` is recorded for
 * the next rematch's rotation.
 */
function beginGame(d: Room, now: number, fx: Effect[]): void {
  // A new game's deck: every allowed word not chosen yet this session (Word selection).
  const rng = createRng(d.rngState);
  const built = newDeck(allowedWords(d.packs, d.settings), d.deck.usedIds, rng);
  d.rngState = rng.state;
  d.deck = built.deck;
  if (built.reshuffled) fx.push({ type: 'fx', to: 'screen', fx: { kind: 'wordsReshuffled' } });

  d.cycle = 0;
  startCycle(d, now, fx);
  d.session.firstDrawerJoinedAt = d.players[d.turn!.drawerPid]!.joinedAt;
}

// ---------- The next game ----------

/** `host:rematch` on FINAL: the 3-2-1 starts. Nothing is reset yet, so a cancel loses nothing. */
function rematch(d: Room, a: ActionOf<'host:rematch'>, now: number, fx: Effect[]): Handled {
  if (d.phase !== 'FINAL' || d.rematchAt !== null) return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  d.rematchAt = now + REMATCH_COUNTDOWN_MS;
  fx.push(schedule(d, 'rematchGo', d.rematchAt, d.turn?.id ?? 0));
  return undefined;
}

/** `host:rematchCancel`: FINAL as it was; the new epoch makes the countdown's `rematchGo` stale. */
function rematchCancel(d: Room, a: ActionOf<'host:rematchCancel'>): Handled {
  if (d.phase !== 'FINAL' || d.rematchAt === null) return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  d.rematchAt = null;
  d.timerEpoch += 1;
  return undefined;
}

/**
 * The countdown ran out: with at least 2 connected, the new-game reset and cycle 1 of the next
 * game, begun after last game's first drawer (Rematch rotation), as are its later cycles. With
 * fewer, FINAL stays as it was and everyone hears "Need 2 players".
 */
function rematchGo(d: Room, now: number, fx: Effect[]): void {
  d.rematchAt = null;
  const connected = Object.values(d.players).filter((p) => p.connected).length;
  // The words can't run short: the settings and custom words haven't changed since this game began.
  if (connected < MIN_PLAYERS || allowedWords(d.packs, d.settings).length < CHOICE_COUNT) {
    fx.push({ type: 'fx', to: 'all', fx: { kind: 'notEnoughPlayers' } });
    return;
  }
  const after = d.session.firstDrawerJoinedAt;
  newGame(d, fx);
  d.rotateAfter = after;
  beginGame(d, now, fx);
}

/** `host:backToLobby` on FINAL (a running countdown too): the new-game reset, then LOBBY. */
function backToLobby(d: Room, a: ActionOf<'host:backToLobby'>, now: number, fx: Effect[]): Handled {
  if (d.phase !== 'FINAL') return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  newGame(d, fx);
  setPhase(d, 'LOBBY', now, fx);
  return undefined;
}

/** Adds a player's game score to the night's totals and records who they are. */
function bankScore(d: Room, p: Player): void {
  const { session } = d;
  session.totals[p.pid] = (session.totals[p.pid] ?? 0) + p.score;
  session.players[p.pid] = { name: p.name, color: p.color, joinedAt: p.joinedAt };
}

/**
 * **New-game reset**: each player's score goes into the night's totals (with who they are, for
 * the Tonight panel after they leave) and back to 0; the game's turns, gallery and awards are
 * cleared, so the next game's turns count from 1; `inkReset` drops the drawings (the doodles stay,
 * and so does `hasDoodle`). Players, crown, settings, custom words and `usedIds` stay. Turn ids
 * keep rising, so nothing of the last game matches the next.
 */
function newGame(d: Room, fx: Effect[]): void {
  for (const p of Object.values(d.players)) {
    bankScore(d, p);
    p.score = 0;
  }
  d.session.gameNumber += 1;
  d.history = [];
  d.awards = [];
  d.turn = null;
  d.upcoming = null;
  d.cycle = 0;
  d.turnOrder = [];
  d.turnIndex = 0;
  d.advanceAt = null;
  d.rematchAt = null;
  d.rotateAfter = null;
  fx.push({ type: 'inkReset' });
}

/**
 * Deals the next connected drawer in this cycle's `turnOrder` a standalone CHOOSING. A
 * disconnected player is skipped for this cycle. Past the last one the cycle is done.
 */
function advance(d: Room, now: number, fx: Effect[]): void {
  if (dealNext(d, now, fx)) return;
  endCycle(d, now, fx);
}

/**
 * The cycle is done: SCOREBOARD while cycles remain (`scoreboardDone` in 6 s with auto-advance),
 * else FINAL. An `upcoming` deal for the next cycle waits through SCOREBOARD; `turnOrder` is
 * already that cycle's then.
 */
function endCycle(d: Room, now: number, fx: Effect[]): void {
  if (!d.upcoming) d.turnIndex = d.turnOrder.length;
  if (d.cycle < d.settings.cycles) {
    setPhase(d, 'SCOREBOARD', now, fx);
    if (d.settings.autoAdvance) autoAdvance(d, 'scoreboardDone', now + SCOREBOARD_MS, fx);
  } else {
    setPhase(d, 'FINAL', now, fx);
  }
}

/**
 * REVEAL ends (`revealDone`, `host:next`): **take up** an `upcoming` deal of this cycle; with
 * none, or one for the next cycle, the cycle is done.
 */
function afterReveal(d: Room, now: number, fx: Effect[]): void {
  if (d.upcoming && d.upcoming.cycle === d.cycle) takeUp(d, now, fx);
  else endCycle(d, now, fx);
}

/** SCOREBOARD ends (`scoreboardDone`, `host:next`): take up the next cycle's first deal. */
function afterScoreboard(d: Room, now: number, fx: Effect[]): void {
  if (d.upcoming) takeUp(d, now, fx);
  else startCycle(d, now, fx);
}

/**
 * **Take up** `upcoming`: drawing at once if its word is chosen, else CHOOSING until 12 s after its
 * deal. If its drawer has left or is disconnected, the deal is discarded (its words back to the
 * deck) and the following connected drawer gets a standalone CHOOSING; a disconnected drawer draws
 * again from the next cycle. A discarded first deal of a new cycle starts that cycle afresh
 * instead, so it never shows a second SCOREBOARD (DECISIONS 44).
 */
function takeUp(d: Room, now: number, fx: Effect[]): void {
  const up = d.upcoming!;
  d.upcoming = null;
  if (!d.players[up.drawerPid]?.connected) {
    d.deck = returnDealt(d.deck, up.choices, up.word);
    if (up.cycle > d.cycle) {
      startCycle(d, now, fx);
    } else {
      // `turnIndex` is still on the discarded deal (or just before it, if its drawer left).
      advance(d, now, fx);
    }
    return;
  }
  d.cycle = up.cycle;
  d.turn = up;
  if (up.word) startDrawing(d, now, fx);
  else setPhase(d, 'CHOOSING', now, fx);
}

/**
 * The next cycle (the first, from `host:start` or Rematch): `turnOrder` is every player in the
 * room in join order (rotated in a rematch game), fixed for the cycle, and its first connected
 * drawer is dealt. With nobody connected to draw, the game ends (DECISIONS 43).
 */
// SPEC-QUESTION: the spec rotates a rematch game's first cycle only; its later cycles rotate too, or a player could draw twice in a row (DECISIONS 52).
function startCycle(d: Room, now: number, fx: Effect[]): void {
  d.cycle += 1;
  d.turnOrder = joinOrder(d);
  d.turnIndex = -1;
  if (dealNext(d, now, fx)) return;
  d.turnIndex = d.turnOrder.length;
  setPhase(d, 'FINAL', now, fx);
}

/** Every player in the room in join order, rotated in a rematch game: a cycle's `turnOrder`. */
function joinOrder(d: Room): string[] {
  return cycleOrder(Object.values(d.players), d.rotateAfter);
}

/** The first connected player in `order` from `from` on, or -1. */
function nextConnected(d: Room, order: string[], from: number): number {
  for (let i = Math.max(0, from); i < order.length; i++)
    if (d.players[order[i]!]?.connected) return i;
  return -1;
}

/**
 * A standalone CHOOSING for the first connected player after `turnIndex` in `turnOrder`; false if
 * there is none.
 */
function dealNext(d: Room, now: number, fx: Effect[]): boolean {
  const index = nextConnected(d, d.turnOrder, d.turnIndex + 1);
  if (index === -1) return false;
  d.turn = deal(d, index, d.cycle, now, fx);
  setPhase(d, 'CHOOSING', now, fx);
  return true;
}

/**
 * DRAWING → REVEAL: if a turn remains in the game, deal it as `upcoming`: the next connected
 * player in this cycle, else the first connected one of the next cycle, whose order is built now
 * (fixed from here; a player disconnected at this deal is skipped for that cycle).
 */
function dealUpcoming(d: Room, now: number, fx: Effect[]): void {
  let index = nextConnected(d, d.turnOrder, d.turnIndex + 1);
  let cycle = d.cycle;
  if (index === -1 && d.cycle < d.settings.cycles) {
    const order = joinOrder(d);
    index = nextConnected(d, order, 0);
    if (index === -1) return;
    d.turnOrder = order;
    cycle += 1;
  }
  if (index !== -1) d.upcoming = deal(d, index, cycle, now, fx);
}

/**
 * **Deal**: three words off the deck for the drawer at `index`, and `fx yourTurn`. The caller puts
 * the turn in `turn` or `upcoming`; `setPhase` schedules its `chooseUp` 12 s on. The words reach
 * only that drawer, through their view.
 */
function deal(d: Room, index: number, cycle: number, now: number, fx: Effect[]): Turn {
  const rng = createRng(d.rngState);
  const dealt = drawChoices(d.deck, allowedWords(d.packs, d.settings), d.settings.difficulty, rng);
  d.rngState = rng.state;
  d.deck = dealt.deck;
  // "All words used, reshuffling", once, on the Screen; it names no word.
  if (dealt.reshuffled) fx.push({ type: 'fx', to: 'screen', fx: { kind: 'wordsReshuffled' } });

  const drawerPid = d.turnOrder[index]!;
  const turn: Turn = {
    id: ++d.turnCounter,
    cycle,
    drawerPid,
    choices: dealt.choices,
    dealtAt: now,
    word: null,
    clockStart: null,
    endsAt: null,
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
  fx.push({ type: 'fx', to: { pid: drawerPid }, fx: { kind: 'yourTurn' } });
  return turn;
}

/**
 * The drawer's choice: in CHOOSING it starts drawing; in REVEAL and SCOREBOARD the `upcoming`
 * drawer's choice only sets `upcoming.word`, taken up when the phase ends.
 */
function choose(d: Room, a: ActionOf<'drawer:choose'>, now: number, fx: Effect[]): Handled {
  const open = openChoice(d);
  if (!open) return 'wrongPhase';
  if (d.paused) return 'paused';
  const player = senderPlayer(d, a.by);
  if (typeof player === 'string') return player;
  if (player.pid !== open.drawerPid) return 'notDrawer';
  setWord(d, open, a.index);
  if (d.phase === 'CHOOSING') startDrawing(d, now, fx);
  return undefined;
}

/** The choice (or the auto-pick) is set: only it is used up, the other two go to the bottom. */
function setWord(d: Room, turn: Turn, index: ChoiceIndex): void {
  d.deck = chooseWord(d.deck, turn.choices, index);
  turn.word = turn.choices[index];
}

/** **Start drawing** `d.turn`, its word set: the clock, `drawUp`, the hints, `inkOpen`. */
function startDrawing(d: Room, now: number, fx: Effect[]): void {
  const turn = d.turn!;
  turn.clockStart = now;
  turn.endsAt = now + d.settings.drawSeconds * 1000;
  setPhase(d, 'DRAWING', now, fx);
  fx.push(
    { type: 'inkOpen', turnId: turn.id, drawerPid: turn.drawerPid },
    schedule(d, 'drawUp', turn.endsAt + GRACE_MS),
  );
  scheduleHints(d, turn, fx);
}

/**
 * One hint at each HINT_AT mark of the clock, as many as the word's cap allows (none under 4
 * letters), from the first not yet given: all of them at the start, the rest after a pause.
 */
function scheduleHints(d: Room, turn: Turn, fx: Effect[]): void {
  if (!d.settings.hints) return;
  const drawMs = d.settings.drawSeconds * 1000;
  for (const f of HINT_AT.slice(turn.hintIndexes.length, hintCount(turn.word!.word)))
    fx.push(schedule(d, 'hint', turn.clockStart! + f * drawMs));
}

/**
 * **Hint**: one more random unrevealed letter, the same for every view (they all read
 * `hintIndexes`). Past the cap, nothing changes. The fx carries no letter.
 */
function hint(d: Room, fx: Effect[]): void {
  const turn = d.turn!;
  const rng = createRng(d.rngState);
  const index = pickHint(turn.word!.word, turn.hintIndexes, rng);
  if (index === null) return;
  d.rngState = rng.state;
  turn.hintIndexes = [...turn.hintIndexes, index];
  fx.push({ type: 'fx', to: 'all', fx: { kind: 'hint' } });
}

/**
 * CHOOSING ends with no word (host skip, the drawer left): no reveal and no points; the dealt words
 * go back to the bottom of the deck and the next drawer is dealt.
 */
function abandonChoice(d: Room, now: number, fx: Effect[]): void {
  d.deck = returnChoices(d.deck, d.turn!.choices);
  advance(d, now, fx);
}

function schedule(
  d: Room,
  timer:
    | 'chooseUp'
    | 'drawUp'
    | 'hint'
    | 'allGuessed'
    | 'revealDone'
    | 'scoreboardDone'
    | 'resumeGo'
    | 'rematchGo',
  at: number,
  turnId = d.turn!.id,
): Effect {
  return { type: 'schedule', at, timer, turnId, epoch: d.timerEpoch };
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
    // the reveal's "Almost:" (masked per `guessFeed` by the view) and counted for awards; only
    // this phone hears "So close!".
    turn.closeGuesses = [...turn.closeGuesses, { pid, text: a.text, at: now }].slice(
      -CLOSE_GUESSES_MAX,
    );
    turn.closeCount[pid] = (turn.closeCount[pid] ?? 0) + 1;
    fx.push({ type: 'fx', to: { pid }, fx: { kind: 'nearMiss' } });
    return undefined;
  }

  if (match === 'wrong') {
    // Stored as typed, so the view masks it per the feed setting of the moment; the Screen's
    // bubble is masked now, and carries no text at all under 'off' ("Bea is guessing…").
    turn.feed = [...turn.feed, { pid, text: a.text, at: now }].slice(-FEED_MAX);
    // SPEC-QUESTION: 'off' still sends the fx, without text, for the "Bea is guessing…" pulse (DECISIONS 38).
    const mode = d.settings.guessFeed;
    const text = mode === 'off' ? null : feedText(a.text, mode);
    fx.push(
      { type: 'fx', to: 'screen', fx: { kind: 'wrongGuess', pid, text } },
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
 * A reaction from a player who has the word (DRAWING) or from anyone (REVEAL), floated from their
 * chip on the Screens. No free text, so nobody can hint the word, and no state change: the gateway
 * sends no fresh views for it and keeps it to one a second per player.
 */
function react(d: Room, a: ActionOf<'player:react'>, fx: Effect[]): Handled {
  if (d.phase !== 'DRAWING' && d.phase !== 'REVEAL') return 'wrongPhase';
  if (d.paused) return 'paused';
  const player = senderPlayer(d, a.by);
  if (typeof player === 'string') return player;
  const { pid } = player;
  if (d.phase === 'DRAWING' && !d.turn?.correct.some((c) => c.pid === pid)) return 'notGuessed';
  fx.push({ type: 'fx', to: 'screen', fx: { kind: 'reaction', pid, emoji: a.emoji } });
  return undefined;
}

/**
 * Every eligible guesser (connected, not the drawer, in the room now) is correct, and at least one
 * guesser is (connected or not): end the turn in 1.5 s. With nobody connected left to guess, a turn
 * someone got ends early too. Once scheduled it always fires: a join or reconnect in the window
 * doesn't cancel it. A second schedule is harmless; whichever fires first moves the phase and the
 * other goes stale.
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
  const turn = closeTurn(d, reason);
  dealUpcoming(d, now, fx);
  setPhase(d, 'REVEAL', now, fx);
  fx.push(
    { type: 'inkClose', turnId: turn.id },
    { type: 'fx', to: 'all', fx: { kind: 'turnEnd', reason } },
  );
  if (d.settings.autoAdvance) autoAdvance(d, 'revealDone', now + REVEAL_MS, fx);
}

/** The drawing turn is over: the drawer gets their half and the turn goes into `history`. */
function closeTurn(d: Room, reason: TurnEndReason): Turn {
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
  return turn;
}

function skip(d: Room, a: ActionOf<'host:skip'>, now: number, fx: Effect[]): Handled {
  if (d.phase !== 'CHOOSING' && d.phase !== 'DRAWING') return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  if (d.phase === 'CHOOSING') abandonChoice(d, now, fx);
  else endTurn(d, 'skip', now, fx);
  return undefined;
}

/**
 * `host:end` → FINAL from any game phase. A turn being drawn ends as a skip, so every point earned
 * stays; a choice still open and an `upcoming` deal put their words back in the deck.
 */
function end(d: Room, a: ActionOf<'host:end'>, now: number, fx: Effect[]): Handled {
  if (!pausable(d.phase)) return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  if (d.phase === 'CHOOSING') {
    d.deck = returnChoices(d.deck, d.turn!.choices);
  } else if (d.phase === 'DRAWING') {
    const turn = closeTurn(d, 'skip');
    fx.push({ type: 'inkClose', turnId: turn.id });
  }
  if (d.upcoming) {
    d.deck = returnDealt(d.deck, d.upcoming.choices, d.upcoming.word);
    d.upcoming = null;
  }
  setPhase(d, 'FINAL', now, fx);
  return undefined;
}

// ---------- Pausing ----------

/** The phases a game can be paused (and ended) in. */
const pausable = (phase: Phase) => phase !== 'LOBBY' && phase !== 'FINAL';

function hostPause(d: Room, a: ActionOf<'host:pause'>, now: number): Handled {
  if (!pausable(d.phase)) return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  if (d.paused?.reasons.includes('host')) return 'paused';
  pause(d, 'host', now);
  return undefined;
}

function hostResume(d: Room, a: ActionOf<'host:resume'>, now: number, fx: Effect[]): Handled {
  if (!isHost(d, a.by)) return 'notHost';
  if (!d.paused?.reasons.includes('host')) return 'notPaused';
  clearPauseReason(d, 'host', now, fx);
  return undefined;
}

/**
 * Adds a pause reason. The first one freezes the phase: `since` is now and the epoch moves, so
 * every timer in flight is ignored. One added during the 3-2-1 stops it.
 */
function pause(d: Room, reason: PauseReason, now: number): void {
  if (!d.paused) {
    d.paused = { reasons: [reason], since: now, remainingMs: null, resumeAt: null };
    d.timerEpoch += 1;
    return;
  }
  if (!d.paused.reasons.includes(reason)) d.paused.reasons.push(reason);
  if (d.paused.resumeAt !== null) {
    d.paused.resumeAt = null;
    d.timerEpoch += 1;
  }
}

/** Clears a pause reason; with none left, the 3-2-1 starts and `resumeGo` is due at its end. */
function clearPauseReason(d: Room, reason: PauseReason, now: number, fx: Effect[]): void {
  const paused = d.paused!;
  paused.reasons = paused.reasons.filter((r) => r !== reason);
  if (paused.reasons.length > 0 || paused.resumeAt !== null) return;
  paused.resumeAt = now + RESUME_COUNTDOWN_MS;
  fx.push(schedule(d, 'resumeGo', paused.resumeAt));
}

/**
 * `resumeGo`: the phase runs again. Everything timed in it moves forward by the paused time (the
 * 3-2-1 included), so the clock, a guess's `t`, an open choice and the auto-advance each keep what
 * they had left; its timers are scheduled again at a fresh epoch.
 */
function resume(d: Room, now: number, fx: Effect[]): void {
  const paused = now - d.paused!.since;
  d.paused = null;
  d.timerEpoch += 1;
  const turn = d.turn;
  if (d.phase === 'DRAWING' && turn && turn.clockStart !== null && turn.endsAt !== null) {
    turn.clockStart += paused;
    turn.endsAt += paused;
    fx.push(schedule(d, 'drawUp', turn.endsAt + GRACE_MS));
    scheduleHints(d, turn, fx);
    // An early end due during the pause was dropped with its epoch.
    checkAllGuessed(d, now, fx);
  }
  const open = openChoice(d);
  if (open) open.dealtAt += paused;
  scheduleChooseUp(d, fx);
  if (d.advanceAt !== null) {
    d.advanceAt += paused;
    fx.push(schedule(d, d.phase === 'REVEAL' ? 'revealDone' : 'scoreboardDone', d.advanceAt));
  }
}

function next(d: Room, a: ActionOf<'host:next'>, now: number, fx: Effect[]): Handled {
  if (d.phase !== 'REVEAL' && d.phase !== 'SCOREBOARD') return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  if (d.paused) return 'paused';
  if (d.phase === 'REVEAL') afterReveal(d, now, fx);
  else afterScoreboard(d, now, fx);
  return undefined;
}

/**
 * Merges a validated partial into the settings: any key in LOBBY, only `guessFeed` once the game
 * has started (FINAL too; a rematch keeps the game's settings). One lobby-only key refuses the
 * whole payload, as the schema does for a bad value. Nothing else changes: views read the settings
 * at view time, so a new `guessFeed` re-masks a feed already on screen (DECISIONS 38).
 */
function settings(d: Room, a: ActionOf<'host:settings'>): Handled {
  if (!isHost(d, a.by)) return 'notHost';
  // The action carries the settings beside `type` and `by`; only setting keys are read.
  const changes = (Object.keys(DEFAULT_SETTINGS) as (keyof RoomSettings)[]).filter(
    (key) => a[key] !== undefined,
  );
  const midGame: readonly string[] = MID_GAME_SETTINGS;
  if (d.phase !== 'LOBBY' && changes.some((key) => !midGame.includes(key))) return 'wrongPhase';
  d.settings = { ...d.settings, ...Object.fromEntries(changes.map((key) => [key, a[key]])) };
  return undefined;
}

function timer(d: Room, a: ActionOf<'timer'>, now: number, fx: Effect[]): Handled {
  if (a.epoch !== d.timerEpoch) return 'staleTimer';
  // A pause holds every phase timer; `resumeGo` schedules them again with what they had left.
  if (d.paused && a.timer !== 'resumeGo') return 'paused';
  // FINAL's countdown: the epoch alone tells a cancelled one apart.
  if (a.timer === 'rematchGo') {
    if (d.phase !== 'FINAL' || d.rematchAt === null) return 'staleTimer';
    rematchGo(d, now, fx);
    return undefined;
  }
  // The `upcoming` deal's auto-pick, during REVEAL or SCOREBOARD: it only sets the word.
  if (a.timer === 'chooseUp' && d.upcoming && a.turnId === d.upcoming.id) {
    if (!inBetween(d.phase)) return 'wrongPhase';
    if (d.upcoming.word) return 'staleTimer';
    setWord(d, d.upcoming, easiestIndex(d.upcoming.choices));
    return undefined;
  }
  if (!d.turn || a.turnId !== d.turn.id) return 'staleTimer';
  switch (a.timer) {
    case 'chooseUp':
      if (d.phase !== 'CHOOSING' || d.turn.word) return 'wrongPhase';
      setWord(d, d.turn, easiestIndex(d.turn.choices));
      startDrawing(d, now, fx);
      return undefined;
    case 'hint':
      if (d.phase !== 'DRAWING' || !d.turn.word) return 'wrongPhase';
      hint(d, fx);
      return undefined;
    case 'drawUp':
    case 'allGuessed':
      if (d.phase !== 'DRAWING') return 'wrongPhase';
      endTurn(d, a.timer === 'drawUp' ? 'time' : 'allGuessed', now, fx);
      return undefined;
    case 'revealDone':
    case 'scoreboardDone':
      if (d.phase !== (a.timer === 'revealDone' ? 'REVEAL' : 'SCOREBOARD')) return 'wrongPhase';
      if (a.timer === 'revealDone') afterReveal(d, now, fx);
      else afterScoreboard(d, now, fx);
      return undefined;
    case 'resumeGo':
      if (!d.paused || d.paused.resumeAt === null) return 'staleTimer';
      resume(d, now, fx);
      return undefined;
    default:
      return 'notAvailable';
  }
}

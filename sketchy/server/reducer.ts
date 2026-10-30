// The game logic: a pure `reduce(room, action, now) → {room, effects}`. See "Game flow and state
// machine" in docs/spec.md. No I/O, timers, clocks or `Math.random`: `now` is the gateway's
// monotonic ms, randomness comes from the seeded RNG in `room.rngState`, and timers go out as
// `schedule` effects carrying `turnId` and `timerEpoch`.
//
// LOBBY → CHOOSING → DRAWING → REVEAL → … → SCOREBOARD between cycles → … → FINAL after
// `settings.cycles` cycles. From the second turn the next drawer is dealt as `upcoming` on entering
// REVEAL and chooses during REVEAL and SCOREBOARD (overlapped choosing). Pauses (F28) and the rest
// arrive with their features; their actions are rejected as `notAvailable` until then.

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
  REVEAL_MS,
  SCOREBOARD_MS,
} from '../shared/constants.js';
import type {
  Action,
  ChoiceIndex,
  Effect,
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
    case 'player:rename':
    case 'player:react':
    case 'player:visibility':
    case 'host:pause':
    case 'host:resume':
    case 'host:kick':
    case 'host:customWords':
    case 'host:end':
    case 'host:rematch':
    case 'host:rematchCancel':
    case 'host:backToLobby':
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
 * After the crown holder has gone (leave, or F28's kick): the longest-connected remaining player,
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
  const { pid } = player;
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
  return undefined;
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
 * REVEAL and SCOREBOARD) gets its `chooseUp` again, still due 12 s after its deal.
 */
function setPhase(d: Room, phase: Phase, fx: Effect[]): void {
  d.phase = phase;
  d.timerEpoch += 1;
  scheduleChooseUp(d, fx);
}

/** The dealt turn whose word is still to be chosen, if any. */
function openChoice(d: Room): Turn | null {
  const turn = d.phase === 'CHOOSING' ? d.turn : inBetween(d.phase) ? d.upcoming : null;
  return turn && turn.word === null ? turn : null;
}

const inBetween = (phase: Phase) => phase === 'REVEAL' || phase === 'SCOREBOARD';

/** `chooseUp` for the open choice at this epoch. F28's `resumeGo` calls it after moving `dealtAt`. */
function scheduleChooseUp(d: Room, fx: Effect[]): void {
  const open = openChoice(d);
  if (open) fx.push(schedule(d, 'chooseUp', open.dealtAt + CHOOSE_MS, open.id));
}

function start(d: Room, a: ActionOf<'host:start'>, now: number, fx: Effect[]): Handled {
  if (d.phase !== 'LOBBY') return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  if (Object.values(d.players).filter((p) => p.connected).length < MIN_PLAYERS)
    return 'notEnoughPlayers';
  const allowed = allowedWords(d.packs, d.settings);
  if (allowed.length < CHOICE_COUNT) return 'notEnoughWords';

  // A new game's deck: every allowed word not chosen yet this session (Word selection).
  const rng = createRng(d.rngState);
  const built = newDeck(allowed, d.deck.usedIds, rng);
  d.rngState = rng.state;
  d.deck = built.deck;
  if (built.reshuffled) fx.push({ type: 'fx', to: 'screen', fx: { kind: 'wordsReshuffled' } });

  d.cycle = 0;
  startCycle(d, now, fx);
  d.session.firstDrawerJoinedAt = d.players[d.turn!.drawerPid]!.joinedAt;
  return undefined;
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
    setPhase(d, 'SCOREBOARD', fx);
    if (d.settings.autoAdvance) fx.push(schedule(d, 'scoreboardDone', now + SCOREBOARD_MS));
  } else {
    setPhase(d, 'FINAL', fx);
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
  else setPhase(d, 'CHOOSING', fx);
}

/**
 * The next cycle (the first, from `host:start`): `turnOrder` is every player in the room in join
 * order, fixed for the cycle, and its first connected drawer is dealt. With nobody connected to
 * draw, the game ends (DECISIONS 43).
 */
// SPEC-QUESTION: F29's rematch rotation must also apply to cycles 2+ of a rematch game, or a player draws twice in a row.
function startCycle(d: Room, now: number, fx: Effect[]): void {
  d.cycle += 1;
  d.turnOrder = joinOrder(d);
  d.turnIndex = -1;
  if (dealNext(d, now, fx)) return;
  d.turnIndex = d.turnOrder.length;
  setPhase(d, 'FINAL', fx);
}

/** Every player in the room in join order: a cycle's `turnOrder`. */
function joinOrder(d: Room): string[] {
  return Object.values(d.players)
    .sort((x, y) => x.joinedAt - y.joinedAt)
    .map((p) => p.pid);
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
  setPhase(d, 'CHOOSING', fx);
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
  setPhase(d, 'DRAWING', fx);
  fx.push(
    { type: 'inkOpen', turnId: turn.id, drawerPid: turn.drawerPid },
    schedule(d, 'drawUp', turn.endsAt + GRACE_MS),
  );
  // One hint at each HINT_AT mark, as many as the word's cap allows (none under 4 letters).
  // SPEC-QUESTION: a pause moves clockStart; F28's resumeGo must re-schedule the hints still to come.
  if (d.settings.hints) {
    const drawMs = d.settings.drawSeconds * 1000;
    for (const f of HINT_AT.slice(0, hintCount(turn.word!.word)))
      fx.push(schedule(d, 'hint', now + f * drawMs));
  }
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
  timer: 'chooseUp' | 'drawUp' | 'hint' | 'allGuessed' | 'revealDone' | 'scoreboardDone',
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

  dealUpcoming(d, now, fx);
  setPhase(d, 'REVEAL', fx);
  fx.push(
    { type: 'inkClose', turnId: turn.id },
    { type: 'fx', to: 'all', fx: { kind: 'turnEnd', reason } },
  );
  if (d.settings.autoAdvance) fx.push(schedule(d, 'revealDone', now + REVEAL_MS));
}

function skip(d: Room, a: ActionOf<'host:skip'>, now: number, fx: Effect[]): Handled {
  if (d.phase !== 'CHOOSING' && d.phase !== 'DRAWING') return 'wrongPhase';
  if (!isHost(d, a.by)) return 'notHost';
  if (d.phase === 'CHOOSING') abandonChoice(d, now, fx);
  else endTurn(d, 'skip', now, fx);
  return undefined;
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
  // The `upcoming` deal's auto-pick, during REVEAL or SCOREBOARD: it only sets the word.
  if (a.timer === 'chooseUp' && d.upcoming && a.turnId === d.upcoming.id) {
    if (!inBetween(d.phase)) return 'wrongPhase';
    if (d.upcoming.word) return 'staleTimer';
    // A pause holds the choice open; F28's resumeGo calls scheduleChooseUp after moving dealtAt.
    if (d.paused) return 'paused';
    setWord(d, d.upcoming, easiestIndex(d.upcoming.choices));
    return undefined;
  }
  if (!d.turn || a.turnId !== d.turn.id) return 'staleTimer';
  switch (a.timer) {
    case 'chooseUp':
      // SPEC-QUESTION: re-scheduling chooseUp for the remaining time after a pause comes with F28's resumeGo.
      if (d.phase !== 'CHOOSING' || d.turn.word) return 'wrongPhase';
      // A pause holds the choice open; F28's resumeGo schedules the rest of the 12 s.
      if (d.paused) return 'paused';
      setWord(d, d.turn, easiestIndex(d.turn.choices));
      startDrawing(d, now, fx);
      return undefined;
    case 'hint':
      if (d.phase !== 'DRAWING' || !d.turn.word) return 'wrongPhase';
      // A pause holds the hint; F28's resumeGo re-schedules it.
      if (d.paused) return 'paused';
      hint(d, fx);
      return undefined;
    case 'drawUp':
    case 'allGuessed':
      if (d.phase !== 'DRAWING') return 'wrongPhase';
      // A pause holds an early end too; F28's resumeGo re-runs the all-guessed check.
      if (a.timer === 'allGuessed' && d.paused) return 'paused';
      endTurn(d, a.timer === 'drawUp' ? 'time' : 'allGuessed', now, fx);
      return undefined;
    case 'revealDone':
    case 'scoreboardDone':
      if (d.phase !== (a.timer === 'revealDone' ? 'REVEAL' : 'SCOREBOARD')) return 'wrongPhase';
      // A pause holds the reveal and the scoreboard; F28's resumeGo re-schedules them.
      if (d.paused) return 'paused';
      if (a.timer === 'revealDone') afterReveal(d, now, fx);
      else afterScoreboard(d, now, fx);
      return undefined;
    default:
      return 'notAvailable';
  }
}

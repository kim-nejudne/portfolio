// The room model, reducer actions and effects, every client→server payload, and the role views
// (`toView` output) the server sends back. The ink action stack arrives with F11.
//
// `Room` and `Turn` hold the word, its alternates and choices: server state only. Never emit
// them or any part of them; every client gets `toView` output.

import type {
  CYCLES_CHOICES,
  DIFFICULTY_CHOICES,
  DRAW_SECONDS_CHOICES,
  GUESS_FEED_CHOICES,
  AVATARS,
  REACTIONS,
} from './constants.js';

// ---------- Room state ----------

export type Phase = 'LOBBY' | 'CHOOSING' | 'DRAWING' | 'REVEAL' | 'SCOREBOARD' | 'FINAL';

export interface WordEntry {
  id: string; // '<categoryId>/<wordId>', or 'custom/<normalised form>'
  word: string; // as shown at the reveal, e.g. 'doughnut'
  alt: string[]; // other accepted answers, e.g. ['donut']
  difficulty: 1 | 2 | 3;
  lang: 'en' | 'custom'; // 'en' words also accept a plural s/es (Guess matching)
  categoryId: string | null; // the category (or seed pack) it comes from; null for custom words
}

/** A category as a game knows it: never its words, never whether it is hidden. */
export interface CategoryInfo {
  id: string;
  title: string; // e.g. 'Food'
  emoji: string; // e.g. '🍔'
}

/**
 * The words a game deals from (Room state, Categories at game start): the chosen visible
 * categories in title order and their words, deduped by normalised word (the first category in
 * title order keeps it). Built by the gateway from the CategoryStore when a game starts, passed in
 * with the action, deep-frozen and shared by reference, never cloned. Server state only.
 */
export interface GameSnapshot {
  categories: readonly CategoryInfo[];
  words: readonly WordEntry[];
}

/**
 * A loaded word pack (Word pack format), frozen. The server reads them at start; every room shares
 * the same ones by reference. Server state only.
 */
export interface WordPack {
  id: string;
  title: string;
  language: 'en';
  rating: 'family' | 'spicy';
  words: readonly WordEntry[];
}

export interface Player {
  pid: string; // public id, server-generated, appears in views
  keyHash: string; // SHA-256 of the device's private playerKey; never in a view
  name: string;
  color: string; // from PLAYER_COLORS
  avatar: Avatar; // picked on the join form (F53)
  score: number; // this game
  connected: boolean;
  hidden: boolean; // page hidden (phone locked or app switched), from player:visibility
  joinedAt: number;
}

export interface CorrectGuess {
  pid: string;
  receivedAt: number; // server monotonic ms
  oneWayMs: number; // the player's measured one-way latency at that moment
  elapsedMs: number; // corrected time since the turn started, pauses excluded
  points: number;
}

export interface FeedItem {
  pid: string;
  // As typed, server-only: views and fx mask it per `guessFeed` (`feedText`) when they send it.
  text: string;
  at: number;
}

export type TurnEndReason = 'time' | 'allGuessed' | 'skip' | 'drawerGone' | 'end';

export interface Turn {
  id: number; // increments every turn in the room; also the ink turnId
  cycle: number; // 1-based
  drawerPid: string;
  choices: [WordEntry, WordEntry, WordEntry]; // easy, medium, hard when the deck has them
  dealtAt: number; // monotonic ms of the deal; chooseUp fires 12 s later (moved by pauses)
  word: WordEntry | null; // null until chosen
  clockStart: number | null; // monotonic ms the drawing clock started, moved forward by pauses
  endsAt: number | null; // clockStart + drawSeconds * 1000
  hintIndexes: number[]; // letter positions revealed so far
  correct: CorrectGuess[]; // in arrival order
  feed: FeedItem[]; // newest last, max FEED_MAX (8) kept
  closeGuesses: FeedItem[]; // max 3, as typed; the Screen's `almost` from REVEAL on
  closeCount: Record<string, number>; // per pid, for awards
  guessCount: Record<string, number>; // per pid, for stats
  lastGuessAt: Record<string, number>; // per pid, receivedAt of the last matched guess (700 ms limit)
  drawerPoints: number; // set at REVEAL
  endReason: TurnEndReason | null;
}

export interface TurnSummary {
  turnId: number;
  drawerPid: string;
  word: string;
  points: Record<string, number>; // everyone who scored this turn, drawer included
  correct: { pid: string; elapsedMs: number }[]; // in corrected order, for awards
  close: Record<string, number>; // close guesses per pid
  wrong: Record<string, number>; // wrong guesses per pid
  hasInk: boolean; // the InkStore still has this drawing for the gallery
  // SPEC-QUESTION: not in the spec's TurnSummary; Modern art counts only turns that ran out of time (DECISIONS 72).
  endReason: TurnEndReason;
}

export interface Award {
  kind: 'picasso' | 'speedDemon' | 'sharpshooter' | 'almost' | 'mostCreative' | 'modernArt';
  pid: string;
  turnId?: number; // modernArt: the drawing nobody got
}

export type PauseReason = 'host' | 'drawerAway' | 'screenAway' | 'fewPlayers';

export interface Paused {
  reasons: PauseReason[];
  since: number;
  remainingMs: number | null; // what was left on the phase timer
  resumeAt: number | null; // set during the 3-2-1 countdown
}

/**
 * The current drawer's phone is away (disconnected or `hidden`) in CHOOSING or DRAWING: since when,
 * and once the `drawerAway` pause holds the game alone, when its 30 s limit runs out.
 */
export interface DrawerAway {
  turnId: number;
  since: number; // monotonic ms the phone went away; `drawerAwayCheck` is due 2 s later
  goneAt: number | null; // `drawerGone` is due; null before the pause, or while the host holds it too
}

export interface RoomSettings {
  drawSeconds: (typeof DRAW_SECONDS_CHOICES)[number]; // default 60
  cycles: (typeof CYCLES_CHOICES)[number]; // default 2
  hints: boolean; // default true
  difficulty: (typeof DIFFICULTY_CHOICES)[number]; // default 'mixed'
  categories: string[]; // category ids, lobby only; a new room gets the visible `defaultOn` ones
  guessFeed: (typeof GUESS_FEED_CHOICES)[number]; // default 'all'
  autoAdvance: boolean; // default true
}

/** Who a night total belongs to, recorded when it is added to. */
export interface SessionPlayer {
  name: string;
  color: string;
  joinedAt: number;
}

export interface Room {
  code: string;
  hostTokenHash: string;
  settings: RoomSettings;
  players: Record<string, Player>; // by pid
  kickedKeyHashes: string[];
  crownPid: string | null;
  screens: number; // connected Screen sockets, kept by the gateway
  phase: Phase;
  paused: Paused | null;
  // SPEC-QUESTION: not in the spec's Room; the debounce and the 30 s limit need to know when the drawer went away (DECISIONS 62).
  drawerAway: DrawerAway | null;
  // SPEC-QUESTION: not in the spec's Room; the 3 s before `screenAway` needs to know when the last Screen went (DECISIONS 63).
  screenAwaySince: number | null; // monotonic ms no Screen was first seen in CHOOSING or DRAWING
  timerEpoch: number; // bumped on every phase change and pause
  rngState: number; // seeded PRNG state (mulberry32), so the reducer stays pure
  cycle: number; // 0 in the lobby
  turnOrder: string[]; // pids for the current cycle
  turnIndex: number; // index into turnOrder
  turnCounter: number; // last Turn.id used
  turn: Turn | null;
  upcoming: Turn | null; // dealt during REVEAL/SCOREBOARD; the next drawer chooses meanwhile
  advanceAt: number | null; // REVEAL/SCOREBOARD with auto-advance: when `revealDone`/`scoreboardDone` is due
  history: TurnSummary[]; // this game, oldest first
  awards: Award[]; // computed on entering FINAL
  /**
   * The word ids still to deal, top first, and the ids chosen this session. Ids, not entries, so
   * cloning the room stays cheap; they resolve through `snapshot`. `usedIds` survives every new game.
   */
  deck: { remaining: string[]; usedIds: string[] };
  snapshot: GameSnapshot | null; // frozen when a game starts; null in a new room; never cloned
  customWords: WordEntry[]; // session only
  rematchAt: number | null; // FINAL only: when a rematch countdown ends
  /**
   * This game's cycles begin with the first player who joined after this time, wrapping to the
   * earliest joiner: the last game's first drawer for a game started by Rematch, null (the
   * earliest joiner) for one started from the lobby (Turn order).
   */
  // SPEC-QUESTION: not in the spec's Room; every cycle of a rematch game is rotated (DECISIONS 52).
  rotateAfter: number | null;
  session: {
    // the night's games
    gameNumber: number;
    totals: Record<string, number>; // pid → points over every finished game, added at the new-game reset
    // SPEC-QUESTION: not in the spec's session; who each total belongs to, so a player who left still has a name (DECISIONS 52).
    players: Record<string, SessionPlayer>; // pid → identity at their last tally
    firstDrawerJoinedAt: number | null; // for the rematch rotation (Turn order)
  };
  createdAt: number;
  lastActivityAt: number;
}

export type Reaction = (typeof REACTIONS)[number];
export type Avatar = (typeof AVATARS)[number];
export type ChoiceIndex = 0 | 1 | 2;

// ---------- Reducer actions ----------

/** Who sent an action, as authenticated by the gateway. The reducer re-checks permissions. */
export interface Sender {
  kind: 'screen' | 'player';
  pid?: string;
  isHost: boolean;
}

export type TimerName =
  | 'chooseUp'
  | 'drawUp'
  | 'hint'
  | 'allGuessed'
  | 'revealDone'
  | 'scoreboardDone'
  | 'drawerAwayCheck'
  | 'drawerGone'
  | 'screenGone'
  | 'resumeGo'
  | 'rematchGo';

/** An empty wire payload: `{}` with no keys allowed. */
type Empty = Record<string, never>;
/**
 * An action with no payload. Not `Empty`: `{type, by} & Record<string, never>` makes `type` and
 * `by` `never`, so the action could never be built.
 */
type NoPayload = Record<never, never>;

/** Payloads of the actions a client causes, before the gateway adds `by`. */
export interface ClientActionPayloads {
  'player:join': {
    keyHash: string; // the gateway hashes the key
    name: string;
    avatar: Avatar;
    takeOver?: boolean;
    hidden?: boolean;
  };
  'player:leave': NoPayload;
  'player:rename': { name: string };
  'player:avatar': { avatar: Avatar };
  'player:guess': { text: string; receivedAt: number; oneWayMs: number }; // timing from the gateway
  'player:react': { emoji: Reaction };
  'player:visibility': { hidden: boolean };
  'drawer:choose': { index: ChoiceIndex };
  'host:start': { snapshot: GameSnapshot }; // the gateway adds it from the CategoryStore
  'host:pause': NoPayload;
  'host:resume': NoPayload;
  'host:skip': NoPayload;
  'host:next': NoPayload;
  'host:kick': { pid: string };
  'host:crown': { pid: string };
  'host:settings': Partial<RoomSettings>;
  'host:customWords': { words: string[]; clear?: true }; // `clear` empties the list first
  'host:end': NoPayload;
  'host:rematch': NoPayload;
  'host:rematchCancel': NoPayload;
  'host:backToLobby': NoPayload;
}

/** Payloads of the actions the gateway itself dispatches. */
export interface SystemActionPayloads {
  'sys:connected': { pid: string };
  'sys:disconnected': { pid: string };
  'sys:screens': { count: number };
  // `rematchGo` carries the next game's snapshot, read by the gateway when the timer fires.
  timer: { timer: TimerName; turnId: number; epoch: number; snapshot?: GameSnapshot };
}

export type ClientActionType = keyof ClientActionPayloads;
export type SystemActionType = keyof SystemActionPayloads;

export type ClientAction = {
  [T in ClientActionType]: { type: T; by: Sender } & ClientActionPayloads[T];
}[ClientActionType];

export type SystemAction = {
  [T in SystemActionType]: { type: T } & SystemActionPayloads[T];
}[SystemActionType];

/** Every action is `{type, ...payload}`: the input of `reduce(room, action, now)`. */
export type Action = ClientAction | SystemAction;

/**
 * Why the reducer rejected an action. A closed set of codes, so no error can echo a word or a
 * guess; the client maps each to friendly copy.
 */
export type ReduceError =
  | 'unknownAction'
  | 'wrongPhase' // not listed for the current phase in the Transitions table
  | 'notAvailable' // a known action whose feature hasn't landed yet
  | 'notHost'
  | 'notPlayer' // a player action without a player sender
  | 'unknownPlayer'
  | 'kicked'
  | 'roomFull'
  | 'nameTaken'
  | 'nameOfDisconnected' // NAME_OF_DISCONNECTED_ERROR: the phone offers to take over
  | 'notEnoughPlayers'
  | 'paused'
  | 'notPaused' // `host:resume` with no `host` pause reason to clear
  | 'cannotKickSelf' // the crown holder kicking their own pid (Leave is for that)
  | 'notDrawer' // `drawer:choose` from anyone but the turn's drawer
  | 'notEnoughWords' // the settings leave fewer than 3 words to deal
  | 'noCategories' // `host:start` with no chosen category left and no custom words
  | 'tooManyWords' // `host:customWords` would take the list over CUSTOM_WORDS_MAX
  | 'drawerCannotGuess'
  | 'alreadyGuessed'
  | 'notGuessed' // `player:react` in DRAWING from someone who hasn't got the word (the drawer too)
  | 'tooLate'
  | 'emptyGuess' // nothing left after normalisation ("!!!", "the")
  | 'guessTooLong'
  | 'slowDown' // more than one guess per GUESS_INTERVAL_MS; the phone shows "Slow down"
  | 'staleTimer'; // the room has moved on; the gateway drops it silently

// ---------- Effects ----------

/** One-off events that drive sounds and animations. */
export type Fx =
  | { kind: 'yourTurn' }
  | { kind: 'crowned' }
  | { kind: 'rejoined'; pid: string }
  | { kind: 'closeAlert'; pid: string }
  | { kind: 'correct'; pid: string; points: number; order: number }
  | { kind: 'nearMiss' }
  | { kind: 'wrongGuess'; pid: string; text: string | null } // null when masked or the feed is off
  | { kind: 'wrong' }
  | { kind: 'hint' }
  | { kind: 'reaction'; pid: string; emoji: Reaction }
  | { kind: 'join'; pid: string }
  | { kind: 'turnEnd'; reason: TurnEndReason }
  | { kind: 'notEnoughPlayers' }
  | { kind: 'wordsReshuffled' }; // the deck ran out: "All words used, reshuffling"

export type FxKind = Fx['kind'];

/** Where an `fx` goes: every Screen, every socket in the room, or one player's sockets. */
export type FxTarget = 'screen' | 'all' | { pid: string };

/**
 * The one target each kind may have (Effects table), so a type error stops a close-guess alert
 * from reaching the Screen or a wrong guess from reaching phones.
 */
export interface FxTargets {
  yourTurn: { pid: string }; // the dealt drawer
  crowned: { pid: string };
  rejoined: 'screen';
  closeAlert: { pid: string }; // the drawer
  correct: 'all';
  nearMiss: { pid: string };
  wrongGuess: 'screen';
  wrong: { pid: string };
  hint: 'all';
  reaction: 'screen';
  join: 'screen';
  turnEnd: 'all';
  notEnoughPlayers: 'all';
  wordsReshuffled: 'screen';
}

export type FxEffect = {
  [K in FxKind]: { type: 'fx'; to: FxTargets[K]; fx: Extract<Fx, { kind: K }> };
}[FxKind];

/** What the reducer asks the gateway to do after storing the new room. */
export type Effect =
  | { type: 'schedule'; at: number; timer: TimerName; turnId: number; epoch: number }
  | FxEffect
  | { type: 'inkOpen'; turnId: number; drawerPid: string }
  | { type: 'inkClose'; turnId: number }
  | { type: 'inkReset' }
  | { type: 'kick'; pid: string };

// ---------- Client → server events (main namespace) ----------

/** Why the gateway refused an event before the reducer saw it. A closed set, like `ReduceError`. */
export type GatewayError =
  | 'invalidPayload' // failed its zod schema; the input is never echoed back
  | 'roomNotFound'
  | 'alreadyJoined' // this socket already joined a room
  | 'notJoined' // a player or host event before a successful join
  | 'badHostToken'
  | 'notHost'
  | 'notDrawer' // `/ink`: a batch from anyone but the current drawer
  | 'staleTurn' // `/ink`: a batch for a turn that is no longer current
  // Over a per-socket limit (`ping`, host actions, `/ink` hellos and gets), per player (`player:react`,
  // `/ink` batches) or per client address (`player:join` by a key the room doesn't know).
  | 'rateLimited'
  | 'inkFull' // `/ink`: the canvas is full; the batch's new strokes were dropped, the rest applied
  | 'inkGap' // `/ink`: a batch after a missing `seq`; dropped, and `ink:resend` asks for the gap
  | 'inkNotKept' // `/ink`: `ink:get` for a drawing the room no longer keeps
  | 'notScreen' // `ink:get` or `debug:rtt` from a phone
  | 'serverError';

export type AckError = ReduceError | GatewayError;

/** Every client→server event acknowledges with this. */
export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: AckError };

/** Client→server payloads, keyed by Socket.IO event name. */
export interface ClientPayloads {
  'screen:join': { code: string; hostToken?: string };
  'player:join': {
    code: string;
    playerKey: string;
    name: string;
    avatar: Avatar;
    takeOver?: boolean;
    hidden?: boolean; // the page is hidden as it joins (a locked phone reconnecting), F40
  };
  ping: { t: number };
  'player:guess': { text: string };
  'player:react': { emoji: Reaction };
  'player:visibility': { hidden: boolean };
  'player:rename': { name: string };
  'player:avatar': { avatar: Avatar };
  'player:leave': Empty;
  'drawer:choose': { index: ChoiceIndex };
  'host:start': Empty;
  'host:pause': Empty;
  'host:resume': Empty;
  'host:skip': Empty;
  'host:next': Empty;
  'host:kick': { pid: string };
  'host:crown': { pid: string };
  'host:settings': Partial<RoomSettings>;
  'host:customWords': { words: string[]; clear?: true }; // `clear` empties the list first
  'host:end': Empty;
  'host:rematch': Empty;
  'host:rematchCancel': Empty;
  'host:backToLobby': Empty;
  'debug:rtt': Empty;
}

export type ClientEvent = keyof ClientPayloads;

/**
 * What a successful ack carries beyond `ok`, for the main-namespace events that answer with data.
 * `debug:rtt` (Screens only, F16): each connected player's median RTT in ms, by pid, for players
 * with at least one sample.
 */
export interface ClientAckData {
  'debug:rtt': { rtt: Record<string, number> };
}

/** Typed Socket.IO map for the main namespace's client→server side. */
export type ClientToServerEvents = {
  [E in ClientEvent]: (payload: ClientPayloads[E], ack: (res: Ack) => void) => void;
};

// ---------- Role views (server → client `state`) ----------
//
// Built only by `toView` in `server/views.ts`, which is where the secrecy rules live (Role views).
// Nothing here may carry `keyHash`, `hostTokenHash`, `rngState`, the deck, custom words, RTTs,
// alternates, or (before the reveal) the word or a choice, except in `secret` for the
// drawer it belongs to.

/** A phase timer at send time. Clients count down locally and resync on every `state`. */
export interface TimerView {
  remainingMs: number;
  totalMs: number;
  running: boolean; // false while paused
}

export interface PlayerChipView {
  pid: string;
  name: string;
  color: string;
  avatar: Avatar;
  connected: boolean;
  crown: boolean;
  isDrawer: boolean;
  guessed: boolean; // correct this turn
  turnPoints: number; // points this turn (the drawer's once the turn ends)
  score: number | null; // the game total: SCOREBOARD and FINAL only
  rank: number | null; // shared rank by `score` (1, 1, 3): SCOREBOARD and FINAL only
  // SPEC-QUESTION: not in the spec's views; the scoreboard's ↑n/↓n and reorder (DECISIONS 89).
  prevRank?: number; // SCOREBOARD only: the shared rank before the round's last turn
}

export interface CorrectView {
  pid: string;
  points: number;
  order: number; // 1-based
}

export interface TurnView {
  id: number;
  number: number; // 1-based turn of this game
  cycle: number;
  drawerPid: string;
  drawerName: string;
  timer: TimerView | null; // CHOOSING and DRAWING
  /** DRAWING: one entry per character, `_` for a hidden letter, spaces, hyphens etc. as themselves. */
  mask: string[] | null;
  word: string | null; // REVEAL and later, for everyone
  correct: CorrectView[];
  guessed: { guessed: number; of: number };
  endReason: TurnEndReason | null;
  /** The drawer's phone is away, in the 2 s before a `drawerAway` pause: "Mika's phone reconnecting…". */
  drawerReconnecting: boolean;
  /** DRAWING and REVEAL: the chosen word's category, for every role. Null before the choice. */
  category: TurnCategoryView | null;
}

/**
 * The current word's category (Role views): its title and emoji ("🍔 Food"), or `custom` for one of
 * the room's own words ("Custom"). Never the category's id, the word, or any other choice's.
 */
export type TurnCategoryView =
  { kind: 'category'; title: string; emoji: string } | { kind: 'custom' };

/** A wrong guess as shown on the Screen; `text` null when masked ("•••"). */
export interface GuessView {
  pid: string;
  text: string | null;
}

/** A visible category in the lobby's picker (Host controls, Categories). */
export interface LobbyCategoryView {
  id: string;
  title: string;
  emoji: string;
  wordCount: number;
  defaultOn: boolean;
}

export interface HostBlockView {
  code: string;
  customWordCount: number; // a count only: the words themselves are never sent
  /** LOBBY only (empty otherwise): the visible categories in title order, read when the view is built. */
  categories: LobbyCategoryView[];
}

export interface PausedView {
  reasons: PauseReason[];
  resumeInMs: number | null; // during the 3-2-1 countdown
}

interface BaseView {
  code: string;
  phase: Phase;
  paused: PausedView | null;
  rematchInMs: number | null; // FINAL, while a rematch countdown runs
  /** FINAL, while a rematch countdown runs: who draws first in the next game, as things stand. */
  rematchFirst: { pid: string; name: string; color: string } | null;
  gameNumber: number; // 1-based game of the night in this room
  settings: RoomSettings;
  players: PlayerChipView[]; // in join order; ranked by the client with `rank` where shown
  turn: TurnView | null;
  /** The Screen holding the token, or the crown holder's phone. */
  host: HostBlockView | null;
}

export interface ScreenView extends BaseView {
  role: 'screen';
  feed: GuessView[]; // this turn's wrong guesses; empty when `guessFeed` is 'off'
  /**
   * The reveal's "Almost:" (REVEAL and later only): the turn's close guesses, then its most recent
   * wrong ones, each guess once, at most `ALMOST_MAX`, masked like the feed.
   */
  almost: GuessView[];
  awards: Award[]; // FINAL
  gallery: { turnId: number; drawerPid: string; word: string }[]; // FINAL
  /** FINAL from game 2: the night's totals, this game included, players who left too. */
  tonight: TonightRow[] | null;
  /**
   * REVEAL: who draws next ("Next: Jun draws"), the `upcoming` deal's drawer; null with no turn
   * left in the game, and outside REVEAL. Never the word or anything about it.
   */
  nextDrawer: { pid: string; name: string; color: string } | null;
}

/** A night total as the Screen's Tonight panel lists it. Equal totals share a rank. */
export interface TonightRow {
  pid: string;
  name: string;
  color: string;
  total: number;
  rank: number;
}

export interface ChoiceView {
  word: string;
  difficulty: WordEntry['difficulty'];
  custom: boolean; // one of the room's own words, shown as "Ours" instead of its level
}

/**
 * Drawer-only: the current drawer's choices and word (CHOOSING, DRAWING), or the `upcoming`
 * drawer's (REVEAL, SCOREBOARD). Never alternates.
 */
export interface SecretView {
  turnId: number;
  choices: ChoiceView[] | null; // while the choice is open
  word: ChoiceView | null; // once chosen
  /**
   * The `upcoming` drawer's open choice (REVEAL, SCOREBOARD): time left until the auto-pick, 12 s
   * after the deal. Null otherwise; in CHOOSING the turn's own timer shows it.
   */
  chooseTimer: TimerView | null;
}

export interface PlayerView extends BaseView {
  role: 'player';
  me: {
    pid: string;
    turnPoints: number;
    score: number | null; // SCOREBOARD and FINAL only
    rank: { rank: number; of: number } | null; // SCOREBOARD and FINAL only; shared ranks
    award: Award | null; // FINAL
  };
  secret: SecretView | null;
  lastGuess: GuessView | null; // the drawer, in DRAWING: the latest wrong guess
}

export type View = ScreenView | PlayerView;

/** Server→client events on the main namespace. */
export interface ServerToClientEvents {
  state: (view: View) => void;
  fx: (fx: Fx) => void;
  /**
   * The phone acks it at once: the server times its RTT sample from the emit to the ack.
   * `serverNow` is the server's wall clock, for the `?debug=1` clock-offset estimate (F16).
   */
  pong: (payload: { t: number; serverNow: number }, ack: () => void) => void;
  kicked: (payload: Empty) => void;
  'room:closed': (payload: { reason: RoomClosedReason }) => void;
}

export type RoomClosedReason = 'expired';

// ---------- Ink (`/ink` namespace) ----------

/** Begin a stroke at (x, y): `["b", strokeId, color, size, x, y]`. */
export type InkBeginOp = ['b', number, number, number, number, number];
/** More points, each relative to the previous: `["p", strokeId, dx1, dy1, dx2, dy2, …]`. */
export type InkPointsOp = ['p', number, ...number[]];
/** End the stroke: `["e", strokeId]`. */
export type InkEndOp = ['e', number];
/** Undo the last action (a stroke or a clear). */
export type InkUndoOp = ['u'];
/** Clear the canvas (itself undoable). */
export type InkClearOp = ['c'];

export type InkOp = InkBeginOp | InkPointsOp | InkEndOp | InkUndoOp | InkClearOp;

/**
 * `[turnId, seq, ops]`; `seq` starts at 1 each turn, +1 per batch. Under `?debug=1` the drawer
 * adds `sentAt`, its send time in server time (ms), for the Screen's ink delay overlay (F16).
 */
export type InkBatch = [turnId: number, seq: number, ops: InkOp[], sentAt?: number];

/** `/ink` client→server payloads, keyed by event name. */
export interface InkClientPayloads {
  'ink:batch': InkBatch;
  'ink:hello': { code: string };
  'ink:sync': { turnId: number; lastSentSeq: number };
  'ink:get': { turnId: number };
}

export type InkClientEvent = keyof InkClientPayloads;

/** What a successful ack carries beyond `ok`, for the `/ink` events that answer with data. */
export interface InkAckData {
  'ink:get': { turnId: number; actions: InkOp[] };
}

/**
 * A turn's whole action stack as ops that rebuild it on an empty stack (strokes under a clear
 * included, so a later undo of the clear still works), and the last `seq` it includes.
 */
export interface InkSnapshot {
  turnId: number;
  seq: number;
  actions: InkOp[];
}

/**
 * `/ink` handshake `auth`. A phone sends its room code and playerKey, so the gateway knows which
 * player the socket is; a Screen sends nothing and joins with `ink:hello`.
 */
export type InkAuth = { code: string; playerKey: string } | Empty;

/** `/ink` client→server events. Every one may take an ack; the drawer sends batches without. */
export type InkClientToServerEvents = {
  [E in InkClientEvent]: (
    payload: InkClientPayloads[E],
    ack?: (res: Ack<E extends keyof InkAckData ? InkAckData[E] : object>) => void,
  ) => void;
};

/**
 * `/ink` server→client events. Only Screens get ink, except the current drawer's own snapshot;
 * `ink:state` and `ink:resend` go to the drawer and carry only `seq` numbers.
 */
export interface InkServerToClientEvents {
  /** A new turn has opened: clear the canvas. */
  'ink:turn': (payload: { turnId: number }) => void;
  /**
   * The drawer's batch, relayed as received (without the ops a full canvas refused; possibly
   * none, so `seq` stays contiguous).
   */
  'ink:batch': (batch: InkBatch) => void;
  /** The answer to `ink:hello`: the latest turn's whole stack; live batches continue after it. */
  'ink:snapshot': (snapshot: InkSnapshot) => void;
  /** The answer to the drawer's `ink:sync`: resend every kept batch with `seq > lastSeq`. */
  'ink:state': (payload: { turnId: number; lastSeq: number }) => void;
  /** A batch arrived after a gap: resend every kept batch from `from` on. */
  'ink:resend': (payload: { turnId: number; from: number }) => void;
}

// ---------- HTTP ----------

/** `POST /api/rooms` body. */
export interface CreateRoomBody {
  settings?: Partial<RoomSettings>;
}

export interface CreateRoomResponse {
  code: string;
  hostToken: string;
}

/** `GET /api/rooms/:code/exists`, for the join form. `phase` is null when there is no room. */
export interface RoomExistsResponse {
  exists: boolean;
  phase: Phase | null;
  full: boolean;
}

/**
 * Dev only (`NODE_ENV !== 'production'`): `GET /api/dev/rooms/:code/word`, so a dev bot can guess
 * right on demand. The one deliberate way a word leaves the server before REVEAL; production
 * never registers the route.
 */
export interface DevWordResponse {
  turnId: number | null;
  word: string | null; // null until the drawer has a word
}

/** Body of every HTTP error response, shaped like a failed `Ack`. */
export interface HttpErrorBody {
  ok: false;
  error: string;
}

/** `GET /healthz`. */
export interface HealthResponse {
  ok: true;
}

// ---------- Admin HTTP (F80) ----------

/**
 * `GET /api/admin/status`. `configured`: a setup code or a password hash exists (without either,
 * every other admin route is 404). `passwordSet`: a hash is set, so `/admin` asks to sign in.
 */
export interface AdminStatusResponse {
  configured: boolean;
  passwordSet: boolean;
  signedIn: boolean;
}

/** `POST /api/admin/setup` and `POST /api/admin/reset`. */
export interface AdminSetupBody {
  setupCode: string;
  password: string;
}

/** `POST /api/admin/login`. */
export interface AdminLoginBody {
  password: string;
}

/** Setup, reset, login and logout answer `{ok: true}`; setup, reset and login also set the cookie. */
export interface AdminOkResponse {
  ok: true;
}

// ---------- Admin category editor (F81) ----------

/** A word's level: 1 easy, 2 medium, 3 hard. */
export type WordLevel = 1 | 2 | 3;

/** Admin errors may name the body field they refuse (`word`, `alt`, `title`, `emoji`…). */
export interface AdminErrorBody extends HttpErrorBody {
  field?: string;
}

/** One row of `GET /api/admin/categories`. */
export interface AdminCategorySummary {
  id: string;
  title: string;
  emoji: string;
  defaultOn: boolean;
  hidden: boolean;
  wordCount: number;
}

export interface AdminCategoriesResponse {
  categories: AdminCategorySummary[];
}

export interface AdminWord {
  /** Short id, unique in its category; the full id is `<categoryId>/<id>`. */
  id: string;
  word: string;
  alt: string[];
  difficulty: WordLevel;
}

export interface AdminCategory {
  id: string;
  title: string;
  emoji: string;
  defaultOn: boolean;
  hidden: boolean;
  words: AdminWord[];
}

/** Every category and word write answers with the category as saved. */
export interface AdminCategoryResponse {
  category: AdminCategory;
}

/** `POST /api/admin/categories`: the id is made from the title. */
export interface AdminCategoryCreateBody {
  title: string;
  emoji: string;
  defaultOn?: boolean;
  hidden?: boolean;
}

/** `PATCH /api/admin/categories/:id`: any of these; the id never changes. */
export interface AdminCategoryPatchBody {
  title?: string;
  emoji?: string;
  defaultOn?: boolean;
  hidden?: boolean;
}

/** `POST /api/admin/categories/:id/words`: level defaults to medium. */
export interface AdminWordBody {
  word: string;
  difficulty?: WordLevel;
  alt?: string[];
}

/** `PATCH /api/admin/categories/:id/words/:wordId`: any of these; the word id never changes. */
export interface AdminWordPatchBody {
  word?: string;
  difficulty?: WordLevel;
  alt?: string[];
}

/** `POST /api/admin/categories/:id/words/bulk`: `word | level | alt, alt`, one per line. */
export interface AdminBulkBody {
  text: string;
}

/** A pasted line that was not added, with its 1-based line number. */
export interface AdminBulkLineError {
  line: number;
  text: string;
  reason: string;
}

export interface AdminBulkResponse extends AdminCategoryResponse {
  added: number;
  /** Lines whose word is already in the category (or earlier in the paste). */
  duplicates: number;
  errors: AdminBulkLineError[];
}

// ---------- Admin export and import (F82) ----------

/**
 * A category as a word pack (spec: Word pack format): the admin's export and import format, and
 * the seed packs' own. Export leaves `alt` out when it is empty, as the seed packs do; `rating` is
 * gone and an imported file's is ignored.
 */
export interface AdminPackFile {
  schemaVersion: 1;
  id: string;
  title: string;
  language: 'en';
  words: { id: string; word: string; alt?: string[]; difficulty: WordLevel }[];
}

/** What to do when an imported file's id is already a category's. */
export type AdminImportClash = 'rename' | 'replace';

/** `POST /api/admin/import`: the category as saved, and whether it replaced one. */
export interface AdminImportResponse extends AdminCategoryResponse {
  replaced: boolean;
}

/**
 * A refused import. `issues` lists what is wrong with the file, one line each, in the store's
 * words; `clash` names the category that already has the file's id (409).
 */
export interface AdminImportErrorBody extends AdminErrorBody {
  issues?: string[];
  clash?: { id: string; title: string };
}

// ---------- Word generation (F83) ----------

/**
 * Which generator the server runs: Claude (a key is set), the fake one (development without a
 * key), or none (generation off).
 */
export type AdminGenerateMode = 'claude' | 'fake' | 'off';

/** One drafted word, as the admin reviews and saves it. */
export interface AdminDraftWord {
  word: string;
  alt: string[];
  difficulty: WordLevel;
}

/** Where a running generation is. */
export type AdminGenerateStage = 'writing' | 'checking';

/**
 * A generation: `new` drafts a category from a title, `more` drafts words for an existing one.
 * Running, then `ready` with a draft to review, or `failed` with a message. In memory only.
 */
export interface AdminGenerationJob {
  id: string;
  kind: 'new' | 'more';
  title: string;
  /** The category `more` adds to; null for `new`. */
  categoryId: string | null;
  /** Words asked for. */
  count: number;
  status: 'running' | 'ready' | 'failed';
  stage: AdminGenerateStage | null;
  error: string | null;
  startedAt: number;
  /** The draft once ready: the emoji the writer suggested, and the words the checker kept. */
  draft: { emoji: string; words: AdminDraftWord[] } | null;
}

/** `GET /api/admin/generate`: the mode, why it is off, and every job held (newest first). */
export interface AdminGenerateStatus {
  mode: AdminGenerateMode;
  /** Set when `mode` is `off`: what to do to turn it on. */
  off: string | null;
  jobs: AdminGenerationJob[];
}

/** `POST /api/admin/generate`: a new category from a title, or more words for a category. */
export type AdminGenerateBody =
  { title: string; count?: number } | { categoryId: string; count?: number };

/** `POST /api/admin/generate` and `GET /api/admin/generate/:id`. */
export interface AdminGenerationResponse {
  job: AdminGenerationJob;
}

/**
 * `POST /api/admin/generate/:id/save`: the reviewed words (only the ticked ones), and for a new
 * category its title and emoji (the draft's when left out).
 */
export interface AdminDraftSaveBody {
  title?: string;
  emoji?: string;
  words: AdminDraftWord[];
}

/** The category as saved, the words added and the repeats skipped. */
export interface AdminDraftSaveResponse extends AdminCategoryResponse {
  added: number;
  duplicates: number;
}

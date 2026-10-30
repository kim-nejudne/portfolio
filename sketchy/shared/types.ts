// The room model, reducer actions and effects, every client→server payload, and the role views
// (`toView` output) the server sends back. The ink action stack arrives with F11.
//
// `Room` and `Turn` hold the word, its alternates, gloss and choices: server state only. Never emit
// them or any part of them; every client gets `toView` output.

import type {
  COPY_LANGUAGES,
  CYCLES_CHOICES,
  DIFFICULTY_CHOICES,
  DRAW_SECONDS_CHOICES,
  GUESS_FEED_CHOICES,
  REACTIONS,
  WORDS_CHOICES,
} from './constants.js';

// ---------- Room state ----------

export type Phase = 'LOBBY' | 'CHOOSING' | 'DRAWING' | 'REVEAL' | 'SCOREBOARD' | 'FINAL';

export interface WordEntry {
  id: string; // '<packId>/<wordId>', or 'custom/<n>'
  word: string; // as shown at the reveal, e.g. 'bahay kubo'
  alt: string[]; // other accepted answers, e.g. ['kubo', 'nipa hut']
  difficulty: 1 | 2 | 3;
  lang: 'en' | 'tl' | 'custom'; // 'en' words also accept a plural s/es (Guess matching)
  gloss?: string; // drawer-only description, e.g. "wide woven farmer's hat"
}

export interface Player {
  pid: string; // public id, server-generated, appears in views
  keyHash: string; // SHA-256 of the device's private playerKey; never in a view
  name: string;
  color: string; // from PLAYER_COLORS
  score: number; // this game
  connected: boolean;
  hidden: boolean; // page hidden (phone locked or app switched), from player:visibility
  hasDoodle: boolean; // the InkStore holds a lobby doodle for this player (Screen avatar)
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
  text: string | null; // null = masked ("•••")
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
  closeGuesses: FeedItem[]; // max 3, never in a view before REVEAL
  closeCount: Record<string, number>; // per pid, for awards
  guessCount: Record<string, number>; // per pid, for rate limiting and stats
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
}

export interface Award {
  kind: 'picasso' | 'bilis' | 'sharpshooter' | 'malapitNa' | 'mostCreative' | 'modernArt';
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

export interface RoomSettings {
  drawSeconds: (typeof DRAW_SECONDS_CHOICES)[number]; // default 60
  cycles: (typeof CYCLES_CHOICES)[number]; // default 2
  hints: boolean; // default true
  difficulty: (typeof DIFFICULTY_CHOICES)[number]; // default 'mixed'
  words: (typeof WORDS_CHOICES)[number]; // default 'mixed'
  spicy: boolean; // default false
  guessFeed: (typeof GUESS_FEED_CHOICES)[number]; // default 'all'
  copy: (typeof COPY_LANGUAGES)[number]; // phone and Screen language, default 'en', lobby only
  autoAdvance: boolean; // default true
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
  timerEpoch: number; // bumped on every phase change and pause
  rngState: number; // seeded PRNG state (mulberry32), so the reducer stays pure
  cycle: number; // 0 in the lobby
  turnOrder: string[]; // pids for the current cycle
  turnIndex: number; // index into turnOrder
  turnCounter: number; // last Turn.id used
  turn: Turn | null;
  upcoming: Turn | null; // dealt during REVEAL/SCOREBOARD; the next drawer chooses meanwhile
  history: TurnSummary[]; // this game, oldest first
  awards: Award[]; // computed on entering FINAL
  deck: { remaining: WordEntry[]; usedIds: string[] }; // usedIds survives every new game
  customWords: WordEntry[]; // session only
  rematchAt: number | null; // FINAL only: when a rematch countdown ends
  session: {
    // the night's games
    gameNumber: number;
    totals: Record<string, number>;
    firstDrawerJoinedAt: number | null; // for the rematch rotation (Turn order)
  };
  createdAt: number;
  lastActivityAt: number;
}

export type Reaction = (typeof REACTIONS)[number];
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
  'player:join': { keyHash: string; name: string; takeOver?: boolean }; // gateway hashes the key
  'player:leave': NoPayload;
  'player:rename': { name: string };
  'player:guess': { text: string; receivedAt: number; oneWayMs: number }; // timing from the gateway
  'player:react': { emoji: Reaction };
  'player:visibility': { hidden: boolean };
  'drawer:choose': { index: ChoiceIndex };
  'host:start': NoPayload;
  'host:pause': NoPayload;
  'host:resume': NoPayload;
  'host:skip': NoPayload;
  'host:next': NoPayload;
  'host:kick': { pid: string };
  'host:crown': { pid: string };
  'host:settings': Partial<RoomSettings>;
  'host:customWords': { words: string[] };
  'host:end': NoPayload;
  'host:rematch': NoPayload;
  'host:rematchCancel': NoPayload;
  'host:backToLobby': NoPayload;
}

/** Payloads of the actions the gateway itself dispatches. */
export interface SystemActionPayloads {
  'sys:connected': { pid: string };
  'sys:disconnected': { pid: string };
  'sys:doodle': { pid: string; has: boolean };
  'sys:screens': { count: number };
  timer: { timer: TimerName; turnId: number; epoch: number };
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
  | 'drawerCannotGuess'
  | 'alreadyGuessed'
  | 'tooLate'
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
  | { kind: 'wrongGuess'; pid: string; text: string | null } // null when masked
  | { kind: 'wrong' }
  | { kind: 'hint' }
  | { kind: 'reaction'; pid: string; emoji: Reaction }
  | { kind: 'join'; pid: string }
  | { kind: 'turnEnd'; reason: TurnEndReason }
  | { kind: 'notEnoughPlayers' };

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
  | 'rateLimited' // over a per-socket limit (`ping`, `/ink` batches, hellos, gets)
  | 'inkFull' // `/ink`: the canvas is full; the batch's new strokes were dropped, the rest applied
  | 'inkGap' // `/ink`: a batch after a missing `seq`; dropped, and `ink:resend` asks for the gap
  | 'inkNotKept' // `/ink`: `ink:get` for a drawing the room no longer keeps
  | 'notScreen' // `/ink`: `ink:get` from a phone
  | 'serverError';

export type AckError = ReduceError | GatewayError;

/** Every client→server event acknowledges with this. */
export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: AckError };

/** Client→server payloads, keyed by Socket.IO event name. */
export interface ClientPayloads {
  'screen:join': { code: string; hostToken?: string };
  'player:join': { code: string; playerKey: string; name: string; takeOver?: boolean };
  ping: { t: number };
  'player:guess': { text: string };
  'player:react': { emoji: Reaction };
  'player:visibility': { hidden: boolean };
  'player:rename': { name: string };
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
  'host:customWords': { words: string[] };
  'host:end': Empty;
  'host:rematch': Empty;
  'host:rematchCancel': Empty;
  'host:backToLobby': Empty;
}

export type ClientEvent = keyof ClientPayloads;

/** Typed Socket.IO map for the main namespace's client→server side. */
export type ClientToServerEvents = {
  [E in ClientEvent]: (payload: ClientPayloads[E], ack: (res: Ack) => void) => void;
};

// ---------- Role views (server → client `state`) ----------
//
// Built only by `toView` in `server/views.ts`, which is where the secrecy rules live (Role views).
// Nothing here may carry `keyHash`, `hostTokenHash`, `rngState`, the deck, custom words, RTTs,
// alternates, or (before the reveal) the word, a gloss or a choice, except in `secret` for the
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
  connected: boolean;
  crown: boolean;
  isDrawer: boolean;
  hasDoodle: boolean;
  guessed: boolean; // correct this turn
  turnPoints: number; // points this turn (the drawer's once the turn ends)
  score: number | null; // the game total: SCOREBOARD and FINAL only
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
}

/** A wrong guess as shown on the Screen; `text` null when masked ("•••"). */
export interface GuessView {
  pid: string;
  text: string | null;
}

export interface HostBlockView {
  code: string;
  customWordCount: number; // a count only: the words themselves are never sent
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
  settings: RoomSettings;
  players: PlayerChipView[]; // in join order
  turn: TurnView | null;
  /** The Screen holding the token, or the crown holder's phone. */
  host: HostBlockView | null;
}

export interface ScreenView extends BaseView {
  role: 'screen';
  feed: GuessView[]; // this turn's wrong guesses; empty when `guessFeed` is 'off'
  closeGuesses: GuessView[]; // REVEAL and later only
  awards: Award[]; // FINAL
  gallery: { turnId: number; drawerPid: string; word: string }[]; // FINAL
}

export interface ChoiceView {
  word: string;
  gloss: string | null;
  difficulty: WordEntry['difficulty'];
}

/**
 * Drawer-only: the current drawer's choices and word (CHOOSING, DRAWING), or the `upcoming`
 * drawer's (REVEAL, SCOREBOARD). Never alternates.
 */
export interface SecretView {
  turnId: number;
  choices: ChoiceView[] | null; // while the choice is open
  word: ChoiceView | null; // once chosen
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
  /** The phone acks it at once: the server times its RTT sample from the emit to the ack. */
  pong: (payload: { t: number }, ack: () => void) => void;
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

/** `[turnId, seq, ops]`; `seq` starts at 1 each turn, +1 per batch. */
export type InkBatch = [number, number, InkOp[]];

/** `/ink` client→server payloads, keyed by event name. */
export interface InkClientPayloads {
  'ink:batch': InkBatch;
  'ink:hello': { code: string };
  'ink:sync': { turnId: number; lastSentSeq: number };
  'ink:get': { turnId: number };
  'doodle:batch': { ops: InkOp[] };
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

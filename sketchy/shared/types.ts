// The room model, reducer actions and effects, and every client→server payload. Views (what
// `toView` sends) arrive with F05, the ink action stack with F11.
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

type Empty = Record<string, never>;

/** Payloads of the actions a client causes, before the gateway adds `by`. */
export interface ClientActionPayloads {
  'player:join': { keyHash: string; name: string; takeOver?: boolean }; // gateway hashes the key
  'player:leave': Empty;
  'player:rename': { name: string };
  'player:guess': { text: string; receivedAt: number; oneWayMs: number }; // timing from the gateway
  'player:react': { emoji: Reaction };
  'player:visibility': { hidden: boolean };
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

/** Every client→server event acknowledges with this. */
export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

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

/** Body of every HTTP error response, shaped like a failed `Ack`. */
export interface HttpErrorBody {
  ok: false;
  error: string;
}

/** `GET /healthz`. */
export interface HealthResponse {
  ok: true;
}

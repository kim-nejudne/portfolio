// The game's data model (spec: Data model) and the role views the server sends (spec: Role views).
// Socket payload and HTTP body types are inferred from the zod schemas in `shared/schemas.ts`.

// ---- Stored categories ----

export type Difficulty = 'easy' | 'medium' | 'hard';
export type DifficultyChoice = Difficulty | 'mixed';
export type Mode = 'name' | 'picture';
export type PlaceKind = 'city' | 'landmark'; // Name mode plays cities, Picture mode landmarks
export type LabelStyle = 'city' | 'cityCountry';

export interface Box {
  south: number;
  west: number;
  north: number;
  east: number;
} // degrees

export interface Photo {
  id: string; // nanoid; files photos/<id>.webp and photos/<id>-thumb.webp
  width: number;
  height: number;
  author: string; // plain text, ≤ 120
  licence: string; // 'CC BY-SA 4.0'
  licenceUrl: string;
  commonsFile: string; // 'File:…'
  sourceUrl: string; // the Commons file page
}

export interface PhotoCandidate {
  commonsFile: string;
  thumbUrl: string;
  author: string;
  licence: string;
  licenceUrl: string;
  width: number;
  height: number;
}

export interface Place {
  id: string; // nanoid
  kind: PlaceKind;
  name: string; // English, 1–60
  displayName: string; // shown in Name mode, 1–40 (landmarks: equals name)
  autoDisplayName: boolean; // false once the admin edits it
  fact: string; // 1–90
  lat: number; // −85.05…85.05
  lng: number; // −180…180
  coordsSource: 'wikidata' | 'admin';
  wikidataId: string; // 'Q35765'
  countryId: string; // 'Q17'
  countryName: string; // short name, 'Japan'
  photo?: Photo; // landmarks only; required to publish
  photoCandidates?: PhotoCandidate[]; // ≤ 6
}

export interface LevelContent {
  places: Place[]; // cities and landmarks, 5–30 of each when generated
  reviewed: boolean; // drafts only
  short?: { city?: number; landmark?: number }; // asked-for counts when saved short
  updatedAt: number;
}

export interface Category {
  id: string; // slug of the name, unique
  name: string; // 1–40
  emoji: string | null;
  box: Box; // live box (also the draft's when draftMeta is null)
  labelStyle: LabelStyle;
  draftMeta: { box: Box; labelStyle: LabelStyle } | null;
  hidden: boolean;
  live: Partial<Record<Difficulty, LevelContent>>;
  draft: Partial<Record<Difficulty, LevelContent>>;
  createdAt: number;
  updatedAt: number;
}

export interface CategoriesFile {
  schemaVersion: 1;
  categories: Category[];
}

// ---- Room state ----

export type Phase = 'LOBBY' | 'INTRO' | 'GUESSING' | 'REVEAL' | 'SCOREBOARD' | 'FINAL';
export type Multiplier = 1 | 1.5 | 2;
export type RoundCount = 5 | 10 | 15;
export type TimerSeconds = 20 | 30 | 45;

export interface Player {
  id: string; // public; base64url SHA-256 of (code + playerKey), first 16 chars
  keyHash: string; // SHA-256 of playerKey; the key itself is never stored
  name: string; // 1–16
  emoji: string; // from EMOJI
  color: string; // from PALETTE
  connected: boolean;
  connectedSince: number | null; // for VIP succession
  joinedAt: number;
  waiting: boolean; // joined mid-game; plays from the next INTRO
}

export interface GameSettings {
  categoryId: string;
  mode: Mode;
  difficulty: DifficultyChoice; // default 'mixed'
  rounds: RoundCount; // default 10
  timerSeconds: TimerSeconds; // default 30
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoundResult {
  playerId: string;
  position: LatLng | null; // null when missed
  lockedIn: boolean;
  distanceKm: number | null;
  basePoints: number; // 0–1000
  bullseye: boolean;
  multiplier: Multiplier;
  points: number; // round(basePoints × multiplier)
}

/**
 * The viewer's own row; `closest` because a phone never sees the other rows, and `totalAfter`
 * (their total with this round counted) because totals take the round in only at `revealDone`.
 */
export type MyResult = RoundResult & { closest: boolean; totalAfter: number };

export type RevealStage = 'pins' | 'target' | 'lines' | 'done';

export interface Round {
  number: number; // 1-based; unchanged by a skip
  placeId: string;
  level: Difficulty;
  multiplier: Multiplier;
  photoToken: string | null; // Picture mode: 22-char nanoid, opaque
  startedAt: number | null; // GUESSING start
  endsAt: number | null;
  participants: string[];
  everConnected: string[]; // participants connected at some moment of GUESSING
  aims: Record<string, LatLng>;
  locks: Record<string, LatLng & { at: number }>;
  results: RoundResult[] | null; // set on entering REVEAL, in reveal order
  revealStage: RevealStage;
  revealedCount: number;
}

export interface Game {
  number: number;
  categoryName: string;
  categoryEmoji: string | null;
  box: Box;
  scale: number;
  labelStyle: LabelStyle;
  pool: Partial<Record<Difficulty, Place[]>>; // snapshot of the chosen mode's places
  levelPlan: Difficulty[]; // per round number − 1
  usedPlaceIds: string[];
  played: Round[]; // revealed rounds, in order
  current: Round | null;
  photoTokens: Record<string, { photoId: string; revealed: boolean }>; // this game's tokens
}

export type PauseReason = 'vip' | 'screenAway';

export interface Room {
  code: string;
  phase: Phase;
  players: Record<string, Player>;
  vipId: string | null;
  /** When the disconnected VIP's `VIP_AWAY_MS` runs out; null while the VIP is connected (DECISIONS 14). */
  vipAwayUntil: number | null;
  /** When the last Screen's `SCREEN_AWAY_MS` runs out; null while a Screen is connected (DECISIONS 28). */
  screenAwayUntil: number | null;
  kickedIds: string[];
  settings: GameSettings;
  game: Game | null;
  previousGames: { number: number; revealedPhotoIds: string[] }[]; // for /credits
  placeUsage: Record<string, number>; // placeId → game number last used
  paused: null | {
    reasons: PauseReason[];
    since: number;
    remainingMs: Record<string, number>; // per pending timer
    resumeAt: number | null;
  };
  rematchAt: number | null;
  timerEpoch: number;
  /** Deadlines of the phase timers scheduled in this phase, by `timerKey`, for a pause (DECISIONS 28). */
  phaseTimers: Record<string, number>;
  screenCount: number;
  rngState: number;
  createdAt: number;
  lastActivityAt: number;
}

// ---- Role views (built by server/views.ts) ----
// Nothing here may carry the round's coordinates, Wikidata id, country, fact, photo id, Commons
// file, (Picture mode) name, or another player's aim or lock before the round's REVEAL.

export type Role = 'screen' | 'player';

/** The VIP controls a phase allows (spec: VIP controls). */
export type VipControl =
  | 'start'
  | 'next'
  | 'pause'
  | 'resume'
  | 'skipRound'
  | 'kick'
  | 'roundSettings'
  | 'end'
  | 'rematch'
  | 'rematchCancel'
  | 'backToLobby';

/** Built field by field, never by spreading `Player`: `keyHash` must never reach a view. */
export interface PublicPlayer {
  id: string;
  name: string;
  emoji: string;
  color: string;
  connected: boolean;
  waiting: boolean;
  isVip: boolean;
  total: number;
  rank: number; // standard competition ranking (1, 2, 2, 4)
}

export interface Region {
  box: Box;
  scale: number;
}

export interface PausedView {
  reasons: PauseReason[];
  since: number; // server clock: timers show `endsAt − since` while paused
  resumeAt: number | null; // set during the 3-2-1
}

export type NamePrompt = { kind: 'name'; displayName: string };
/** `credit` is the guessing credit (spec: Photos and credits), never naming the answer. */
export type PicturePrompt = { kind: 'picture'; photoUrl: string; credit: string };
export type ScreenPrompt = NamePrompt | PicturePrompt;
export type PlayerPrompt = NamePrompt | (PicturePrompt & { thumbUrl: string });

/** "Final call" is the client's own last-5-s state of `boarding`. */
export type GateStatus = 'nowBoarding' | 'boarding' | 'delayed';

export interface RoundHeader {
  number: number;
  total: number;
  multiplier: Multiplier;
  endsAt: number | null;
}

/** The answer, only in views of a round at REVEAL or later. */
export interface RevealedPlace {
  name: string;
  displayName: string;
  fact: string;
  position: LatLng;
  /** Full credit, Picture mode only: "Photo: ‹author›, ‹licence›, via Wikimedia Commons". */
  credit: string | null;
  photoUrl: string | null;
}

export interface StandingRow {
  playerId: string;
  rank: number;
  total: number;
  roundPoints: number;
  movement: number; // places gained since the last board (negative: lost)
}

export interface FinalPass {
  playerId: string;
  rank: number;
  total: number;
  bestRound: string | null; // "Round 7 · Osaka · 960"; null without a played round
  avgKm: number | null; // unrounded, over played rounds
}

export type AwardId = 'pinpointPilot' | 'lostLuggage' | 'frequentFlyer' | 'smoothLanding';

export interface Award {
  id: AwardId;
  title: string;
  playerIds: string[]; // more than one when tied on the stat, in standings order
  stat: string; // "4,812 km from Lima"
}

/** FINAL with at least one played round. */
export interface FinalView {
  /** The top 3 ranks; tied players share a step. Only occupied ranks appear. */
  podium: { rank: number; playerIds: string[] }[];
  passes: FinalPass[]; // every player, in standings order
  awards: Award[]; // empty below 3 players
}

export interface ScreenView {
  role: 'screen';
  serverNow: number;
  code: string;
  joinUrl: string;
  phase: Phase;
  players: PublicPlayer[];
  settings: GameSettings;
  /** The chosen category's name while it is live; null before one is picked. */
  categoryName: string | null;
  /** False with no live, visible category: "No destinations yet. Check back soon." */
  hasCategories: boolean;
  paused: PausedView | null;
  rematchAt: number | null;
  region: Region | null; // from INTRO until the game ends
  round:
    | (RoundHeader & {
        gate: GateStatus;
        lockedIn: string[]; // participant ids who locked in
        prompt: ScreenPrompt;
      })
    | null;
  reveal: {
    place: RevealedPlace;
    /** Reveal order, all rows from REVEAL start (every pin drops at once); the rail shows the first `revealedCount`. */
    results: RoundResult[];
    revealStage: RevealStage;
    revealedCount: number;
  } | null;
  standings: StandingRow[] | null; // SCOREBOARD and FINAL
  final: FinalView | null;
}

/** `GET /api/rooms/:code/exists`. */
export interface RoomExistsResponse {
  exists: boolean;
  phase: Phase | null;
  full: boolean;
  /** Emoji already in use, so the join form can disable them (DECISIONS 18). */
  takenEmoji: string[];
}

/** `POST /api/admin/login` and `GET /api/admin/session`: when the session ends (epoch ms). */
export interface AdminSessionResponse {
  expiresAt: number;
}

/** A Leaflet tile layer from `GET /api/config`. */
export interface TileLayerConfig {
  url: string;
  attribution: string;
  maxNativeZoom: number;
}

/** `GET /api/config`: `tiles` is CARTO, null without `PINPOINT_CARTO_KEY`. */
export interface ConfigResponse {
  tiles: TileLayerConfig | null;
  fallbackTiles: TileLayerConfig;
}

export interface CategoryLevelCounts {
  city: number;
  landmark: number;
}

/** A live, visible category as `GET /api/categories` and the VIP's lobby list see it. */
export interface CategorySummary {
  id: string;
  name: string;
  emoji: string | null;
  box: Box;
  labelStyle: LabelStyle;
  counts: Partial<Record<Difficulty, CategoryLevelCounts>>;
}

export interface PlayerView {
  role: 'player';
  serverNow: number;
  code: string;
  phase: Phase;
  me: PublicPlayer;
  playerCount: number;
  vipName: string | null;
  settings: GameSettings;
  /** The chosen category's name while it is live; null before one is picked. */
  categoryName: string | null;
  /** False with no live, visible category: "No destinations yet. Check back soon." */
  hasCategories: boolean;
  paused: PausedView | null;
  rematchAt: number | null;
  region: Region | null; // from INTRO until the game ends
  round:
    | (RoundHeader & {
        prompt: PlayerPrompt;
        myLock: LatLng | null; // only the viewer's own
        /** The viewer's own last aim, so a returning participant's crosshair keeps it (DECISIONS 25). */
        myAim: LatLng | null;
        stillGuessing: string[]; // emoji of participants not locked in
      })
    | null;
  myResult: MyResult | null; // only once revealedCount is past the viewer's reveal index
  /** FINAL with a played round: the viewer's own pass and only the awards they won. */
  final: { pass: FinalPass; awards: Award[] } | null;
  vip: {
    categories: CategorySummary[];
    /** Connected Screens: Start needs one ("Open the Screen first"). */
    screenCount: number;
    players: PublicPlayer[];
    controls: VipControl[];
  } | null;
}

export type View = ScreenView | PlayerView;

// ---- Server to client events ----

export type ScreenFx =
  | { kind: 'join'; playerId: string }
  | { kind: 'practice'; playerId: string }
  | { kind: 'lockedIn'; playerId: string };

export type PlayerFx = { kind: 'practiceResult'; distanceKm: number } | { kind: 'vipNow' };

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** What the server emits (spec: Server to client). Client events are typed in `shared/schemas.ts`. */
export interface ServerToClientEvents {
  state: (view: View) => void;
  fx: (fx: ScreenFx | PlayerFx) => void;
  kicked: (payload: Record<string, never>) => void;
  'room:closed': (payload: { reason: string }) => void;
}

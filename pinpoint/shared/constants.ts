// Constants shared by the client, the server and the tooling (spec: Look and tokens; Scheduled
// timers; Rate limits and limits).

/** The server's port inside the container (`PORT` overrides it). */
export const DEFAULT_PORT = 3000;

/**
 * Development ports (DECISIONS 5): the server on 3010 and Vite on 5180, clear of Buzzr and
 * Sketchy (3000, 5173) and the hub (4500, 4501), which Kim may run at the same time.
 */
export const DEV_SERVER_PORT = 3010;
export const DEV_CLIENT_PORT = 5180;

// ---- Look ----

/** Design tokens the server or tests need; the CSS defines its own copy (DECISIONS 8). */
export const TOKENS = {
  boardBg: '#0B0C0E',
  boardPanel: '#15171B',
  flapBg: '#1C1E22',
  flapSeam: '#050506',
  amber: '#FFB000',
  amberDim: '#8A6200',
  text: '#F2E9D8',
  textDim: '#8C8578',
  line: '#2A2D33',
  delayed: '#FF4D4F',
  onTime: '#3DDC84',
  passBg: '#F2E9D8',
  passText: '#0B0C0E',
} as const;

/** Player colours, assigned in this order (first free slot). `shared/palette.test.ts` is the authority. */
export const PALETTE = [
  '#56B4E9', // sky
  '#E5603A', // vermillion
  '#44BB99', // mint
  '#FFAABB', // pink
  '#4477EE', // blue
  '#BBCC33', // pear
  '#F2F2F2', // white
  '#CC6677', // rose
  '#99DDFF', // ice
  '#AA4499', // purple
  '#EEDD88', // sand
  '#9F7FE0', // lilac
] as const;

/** The 24 emoji a player picks from at join, one per player in a room. */
export const EMOJI = [
  '🦊', '🐼', '🐸', '🐙', '🦄', '🐯', '🐵', '🐧', '🦉', '🐢', '🦁', '🐨',
  '🐷', '🐮', '🐰', '🐻', '🐳', '🦩', '🦜', '🐝', '🦀', '🐌', '🦔', '🐲',
] as const; // prettier-ignore

// ---- Rooms and players ----

/** No I, L or O. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;
/** Draws before room creation gives up (23⁴ ≈ 280,000 codes, so only a near-full server fails). */
export const ROOM_CODE_MAX_ATTEMPTS = 100;
/** A room with no activity for this long is deleted. */
export const ROOM_IDLE_TTL_MS = 3 * 60 * 60_000;
export const ROOM_SWEEP_INTERVAL_MS = 5 * 60_000;
/** `playerKey` is a 21-character nanoid made on the device. */
export const PLAYER_KEY_LENGTH = 21;
export const NAME_MIN = 1;
export const NAME_MAX = 16;
export const MAX_PLAYERS = 12;
export const MAX_SCREENS = 4;
/** An unknown or expired room, as the gateway refuses it and the Screen and phones show it. */
export const GAME_ENDED_ERROR = 'This game has ended';
/** A kicked player's refusal and their phone's screen (spec: Creating and joining a room). */
export const KICKED_ERROR = 'You were removed from this game';

// ---- Settings ----

export const ROUND_OPTIONS = [5, 10, 15] as const;
export const TIMER_OPTIONS = [20, 30, 45] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const DIFFICULTY_CHOICES = [...DIFFICULTIES, 'mixed'] as const;
export const MODES = ['name', 'picture'] as const;
export const DEFAULT_ROUNDS = 10;
export const DEFAULT_TIMER_SECONDS = 30;
/** The lobby offers a (category, mode, level) only with at least this many live places. */
export const MIN_PLACES_TO_OFFER = 5;

// ---- Map ----

/** Web Mercator's latitude limit; coordinates outside it are refused. */
export const MAX_LAT = 85.0511;

// ---- Timers (ms) ----

export const INTRO_MS = 3000;
export const GRACE_MS = 300;
export const ALL_LOCKED_MS = 1000;
export const SCOREBOARD_MS = 6000;
export const SCREEN_AWAY_MS = 3000;
export const VIP_AWAY_MS = 60_000;
export const RESUME_COUNTDOWN_MS = 3000;
export const REMATCH_COUNTDOWN_MS = 3000;
/** Reveal timeline: the target lands at 1.5 s, player k's line at 3 s + k × STEP, done 1.5 s after the last. */
export const REVEAL_TARGET_MS = 1500;
export const REVEAL_FIRST_STEP_MS = 3000;
export const REVEAL_DONE_AFTER_MS = 1500;
export const REVEAL_STEP_TOTAL_MS = 7500;
export const REVEAL_STEP_MIN_MS = 600;
export const REVEAL_STEP_MAX_MS = 1800;

// ---- Limits (spec: Rate limits and limits) ----

const MINUTE = 60_000;

/** `max` events per `windowMs`. */
export const RATE_LIMITS = {
  roomCreate: { max: 10, windowMs: 60 * MINUTE }, // per IP; 429
  playerJoinNew: { max: 30, windowMs: MINUTE }, // per IP, new players only
  roomLookup: { max: 30, windowMs: MINUTE }, // per IP: rooms/:code/exists, credits/:code, screen:join
  aim: { max: 8, windowMs: 1000 }, // per socket; dropped silently
  lockIn: { max: 2, windowMs: 1000 }, // per socket
  practice: { max: 1, windowMs: 2000 }, // per player
  vipAction: { max: 10, windowMs: 1000 }, // per socket
  photo: { max: 120, windowMs: MINUTE }, // per IP; 429
  adminLogin: { max: 5, windowMs: MINUTE }, // per IP; 429
  wikidataSearch: { max: 30, windowMs: MINUTE }, // admin; 429
} as const;

/** Socket.IO `maxHttpBufferSize`: a bigger message disconnects the socket. */
export const SOCKET_MAX_BYTES = 16 * 1024;

// ---- Categories and admin ----

export const CATEGORY_NAME_MAX = 40;
export const PLACE_NAME_MAX = 60;
export const DISPLAY_NAME_MAX = 40;
export const FACT_MAX = 90;
export const GUIDANCE_MAX = 500;
export const NOTE_MAX = 500; // SPEC-QUESTION: DECISIONS 9 (the spec gives no limit for `note`)
export const LEVEL_COUNT_MIN = 5;
export const LEVEL_COUNT_MAX = 30;
export const DEFAULT_LEVEL_COUNT = 15;
export const PHOTO_AUTHOR_MAX = 120;
export const PHOTO_CANDIDATES_MAX = 6;
export const ADMIN_PASSWORD_MAX = 1024;
export const WIKIDATA_QUERY_MAX = 100;
export const ID_MAX = 64;
/** A category's emoji: one grapheme, at most this many UTF-16 units (as in Buzzr). */
export const CATEGORY_EMOJI_MAX = 16;

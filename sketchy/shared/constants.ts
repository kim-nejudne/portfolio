// Fixed numbers from the spec: timings, limits, palettes and presets. Schemas, the reducer and the
// clients all read them from here.

import type { RoomSettings } from './types.js';

// ---------- Server ----------

/** The Node server's port in development, and the default when `PORT` is unset. */
export const DEFAULT_PORT = 3000;

/** Vite's dev server port. Phones on the LAN open this one in development. */
export const DEV_CLIENT_PORT = 5173;

/** Socket.IO `maxHttpBufferSize`: the largest socket message, as in Buzzr. */
export const SOCKET_MAX_BUFFER_BYTES = 100 * 1024;
/** Socket.IO heartbeat: a dead phone is noticed within about 10 s. */
export const SOCKET_PING_INTERVAL_MS = 5_000;
export const SOCKET_PING_TIMEOUT_MS = 5_000;

// ---------- Rooms and players ----------

/** Room codes avoid look-alikes: no I, L or O. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;
/** Rooms are deleted after this long without activity. */
export const ROOM_IDLE_TTL_MS = 3 * 60 * 60 * 1000;
/** How often the server looks for idle rooms to delete. */
export const ROOM_SWEEP_INTERVAL_MS = 60 * 1000;
/** Fresh codes to draw before `POST /api/rooms` gives up with 503 (23^4 codes, so only on a near-full server). */
export const ROOM_CODE_MAX_ATTEMPTS = 100;
/** `POST /api/rooms` body: `{settings?}` is a few hundred bytes at most. */
export const CREATE_ROOM_BODY_MAX_BYTES = 4 * 1024;
/** hostToken: random bytes, sent as base64url (43 characters). */
export const HOST_TOKEN_BYTES = 32;
export const HOST_TOKEN_LENGTH = 43;
/** playerKey: a nanoid made on the device. */
export const PLAYER_KEY_LENGTH = 21;
/** Server-generated ids (pid). */
// SPEC-QUESTION: the spec gives no pid format; see DECISIONS (F02).
export const ID_MAX = 64;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
/** Player names are trimmed, then must be 1 to 16 characters. */
export const PLAYER_NAME_MIN = 1;
export const PLAYER_NAME_MAX = 16;
/** The `player:join` error for a name held by a disconnected player; the phone asks "Are you Jun?". */
export const NAME_OF_DISCONNECTED_ERROR = 'nameOfDisconnected';

// ---------- Timings ----------

/** The drawer has this long from the deal to pick a word. */
export const CHOOSE_MS = 12_000;
/** Auto-advance: how long REVEAL and SCOREBOARD stay up. */
export const REVEAL_MS = 8_000;
export const SCOREBOARD_MS = 6_000;
/** The turn ends this long after every eligible guesser is correct. */
export const ALL_GUESSED_MS = 1_500;
/** Guesses still count until `endsAt + GRACE_MS` if their corrected time is ≤ `endsAt`. */
export const GRACE_MS = 300;
/** The most one-way latency a guess's timing is corrected by. */
export const MAX_LATENCY_CORRECTION_MS = 250;
/** The drawer must be away this long before `drawerAway` pauses the game. */
export const DRAWER_AWAY_DEBOUNCE_MS = 2_000;
/** After this long in a `drawerAway` pause, the turn is skipped. */
export const DRAWER_AWAY_MS = 30_000;
/** The last Screen must be gone this long before `screenAway` pauses the game. */
export const SCREEN_AWAY_MS = 3_000;
/** The 3-2-1 countdown after the last pause reason clears. */
export const RESUME_COUNTDOWN_MS = 3_000;
/** The 3-2-1 countdown to a rematch. */
export const REMATCH_COUNTDOWN_MS = 3_000;
/** Phones send a `ping` this often for RTT samples. */
export const PING_INTERVAL_MS = 2_000;
/** The gateway's rolling median RTT uses each socket's last this-many samples. */
export const RTT_SAMPLES = 10;
/** The server times RTT from `pong` to the phone's ack of it, and drops the sample after this. */
export const PONG_ACK_TIMEOUT_MS = 5_000;
/** Hints: one letter at each of these fractions of the drawing time. */
export const HINT_AT = [0.5, 0.75] as const;
/** Never more than this fraction of the letters (rounded down) is revealed. */
export const HINT_MAX_FRACTION = 1 / 3;
/** Words with fewer letters get no hints. */
export const HINT_MIN_LETTERS = 4;
/** The timer ring turns red and the Screen ticks for the last this-many ms. */
export const LAST_SECONDS_MS = 10_000;

// ---------- Guesses and feed ----------

/** Guesses are trimmed, then 1 to 40 characters. */
export const GUESS_MAX = 40;
/** One guess per player per this long. */
export const GUESS_INTERVAL_MS = 700;
/** One reaction per player per this long. */
export const REACTION_INTERVAL_MS = 1_000;
/** Wrong guesses kept in the turn's feed. */
export const FEED_MAX = 8;
/** Close guesses kept per turn, shown at the reveal. */
export const CLOSE_GUESSES_MAX = 3;
/** Guesses in the reveal's "Almost:": close ones first, then the most recent wrong ones. */
export const ALMOST_MAX = 3;
/** A guesser's own last guesses shown on their phone. */
export const OWN_GUESSES_SHOWN = 5;
/** The only reactions a guesser can send: no free text, so nobody can hint the word. */
export const REACTIONS = ['😂', '🔥', '👏', '😱', '🤔', '💀'] as const;
/**
 * The avatars a player picks from on joining (F53). Ported from Buzzr (buzzer/shared/constants.ts):
 * each is a single code point with emoji presentation (no variation selector, no ZWJ sequence), so
 * it is one glyph on every device and `z.enum` matches it exactly. Two players may share one.
 */
export const AVATARS = [
  '🦊',
  '🐼',
  '🐸',
  '🐙',
  '🦄',
  '🐯',
  '🐵',
  '🐧',
  '🦉',
  '🐢',
  '🦁',
  '🐨',
  '🐷',
  '🐮',
  '🐰',
  '🐻',
  '🐳',
  '🦖',
  '👻',
  '🤖',
  '👽',
  '🍕',
  '🌵',
  '🚀',
] as const;

// ---------- Scoring ----------

/** A correct guess at the very start of the turn. */
export const GUESSER_POINTS_MAX = 300;
/** A correct guess at the buzzer. */
export const GUESSER_POINTS_MIN = 100;
/** Points round to the nearest multiple of this. */
export const POINTS_STEP = 5;
/** The drawer earns this share of the guessers' total (DECISIONS open question 1). */
export const DRAWER_SHARE = 0.5;

// ---------- Custom words ----------

export const CUSTOM_WORDS_MAX = 100;
/** Each custom word is trimmed, then 1 to 30 characters. */
export const CUSTOM_WORD_MIN = 1;
export const CUSTOM_WORD_MAX = 30;

// ---------- Rate limits ----------

/** Admin setup, reset and sign-in together, per IP (Security). Every try counts, right or wrong. */
export const ADMIN_AUTH_RATE_LIMIT = { max: 5, windowMs: 60 * 1000 } as const;
export const ROOM_CREATE_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 } as const;
/** `GET /api/rooms/:code/exists`, so one address cannot walk the code space (DECISIONS #13). */
// SPEC-QUESTION: the spec lists no limit for the room check; see DECISIONS (F03).
export const ROOM_CHECK_RATE_LIMIT = { max: 60, windowMs: 60 * 1000 } as const;
export const JOIN_RATE_LIMIT = { max: 10, windowMs: 60 * 1000 } as const;
export const HOST_ACTION_RATE_LIMIT = { max: 10, windowMs: 1000 } as const;
export const INK_BATCH_RATE_LIMIT = { max: 40, windowMs: 1000 } as const;
/** `ping` per main-namespace socket; phones send one every PING_INTERVAL_MS (DECISIONS 36). */
// SPEC-QUESTION: the spec lists no limit for `ping`; Buzzr's is 5 per second.
export const PING_RATE_LIMIT = { max: 5, windowMs: 1000 } as const;
/** `player:visibility` per player: a page flapping hidden and visible costs a reduce and a broadcast each time. */
// SPEC-QUESTION: the spec lists no limit for `player:visibility` (DECISIONS 62).
export const VISIBILITY_RATE_LIMIT = { max: 5, windowMs: 1000 } as const;
/** `player:avatar` per player (F54): each change costs a reduce and a broadcast, as a visibility report does. */
// SPEC-QUESTION: the spec lists no limit for `player:avatar`; it takes `player:visibility`'s (DECISIONS 77).
export const AVATAR_RATE_LIMIT = VISIBILITY_RATE_LIMIT;
/** `ink:hello` and `ink:sync` per `/ink` socket: each can make the server send a whole snapshot. */
export const INK_HELLO_RATE_LIMIT = { max: 5, windowMs: 1000 } as const;
/** `ink:get` per `/ink` socket: the FINAL gallery asks for every turn's drawing at once. */
export const INK_GET_RATE_LIMIT = { max: 60, windowMs: 10 * 1000 } as const;

// ---------- Drawing ----------

/** Ink coordinates are integers on a square grid, 0 to INK_GRID - 1 on each axis. */
export const INK_GRID = 1024;
/** The drawer flushes a batch this often while drawing. */
export const INK_FLUSH_MS = 50;
/** The drawer drops a point closer than this (grid units) to the last kept point. */
export const INK_RADIAL_MIN = 3;
/** Ramer–Douglas–Peucker tolerance (grid units) for the drawer's pending points. */
export const INK_RDP_EPSILON = 1;
/**
 * After RDP the drawer still keeps a point wherever the next kept one would be further than this
 * (grid units). Strokes are smoothed through segment midpoints, so a long simplified run would
 * round the following corner far more on the Screen than on the drawer's pad.
 */
export const INK_SEGMENT_MAX = 24;
/** Brush widths in grid units for S, M and L (`size` 0, 1, 2). */
export const INK_SIZES = [4, 10, 24] as const;
export const DEFAULT_INK_SIZE = 1;
/** Drawing colours, `color` 0 to 7. Black is the default. */
export const DRAW_COLORS = [
  '#1D1B22', // black
  '#E5383B', // red
  '#F48C06', // orange
  '#FFC300', // yellow
  '#2DC653', // green
  '#2F80ED', // blue
  '#8E44AD', // purple
  '#8B5A2B', // brown
] as const;
/** `color` 8: the eraser paints the canvas colour. */
export const ERASER_COLOR_INDEX = 8;
/** The drawing square. */
export const CANVAS_COLOR = '#FFFFFF';
/** One batch, encoded as JSON. */
export const INK_BATCH_MAX_BYTES = 4 * 1024;
/** Points in one `p` op. */
export const INK_POINTS_PER_OP_MAX = 200;
/**
 * The visible picture of a turn (every op after the last clear on the stack), encoded; past it new
 * strokes are refused ("Canvas full"). Undo and clear still work.
 */
export const INK_TURN_MAX_BYTES = 200 * 1024;
/**
 * A turn's whole action stack (strokes under clears too), encoded: a hard memory bound above the
 * soft INK_TURN_MAX_BYTES. Past it only undo (and ends of strokes) still apply.
 */
export const INK_TURN_HARD_MAX_BYTES = 2 * INK_TURN_MAX_BYTES;
/** The server asks the drawer for the same missing batches at most this often (ms). */
export const INK_RESEND_ASK_MS = 1000;
/** Strokes and clears on one turn's stack; a real drawing has a few hundred. */
export const INK_TURN_MAX_ACTIONS = 5000;
/** What one action costs in memory beyond its encoded ops, charged against INK_ROOM_MAX_BYTES. */
export const INK_ACTION_OVERHEAD_BYTES = 64;
/** The drawer retries an unanswered hello or sync, and a rate-limited resend, after this (ms). */
export const INK_DRAWER_RETRY_MS = 1000;
/** Kept batches the drawer resends per sync, under INK_BATCH_RATE_LIMIT; the rest follow. */
export const INK_RESEND_BURST = 30;
/** Frozen ink logs a room keeps for the gallery; past it the oldest are dropped. */
export const INK_ROOM_MAX_BYTES = 4 * 1024 * 1024;
/** Invalid batches in one turn before the drawer's `/ink` socket is disconnected. */
export const INK_INVALID_BATCHES_MAX = 20;

// ---------- Look and feel ----------

/** The sketchbook paper behind everything (Look and feel; `paper` in `client/src/index.css`). */
export const BACKGROUND_COLOR = '#F8F8F3';
/** The old dark look's accent, marker orange; goes with the dark look (F67). */
export const ACCENT_COLOR = '#FF6B35';
/**
 * Players' colours, in join order: 12 crayons. Names are written in them on paper, so each is at
 * least 4.5:1 against BACKGROUND_COLOR, and each stays clearly apart from the drawing colours and
 * the other crayons (`constants.test.ts`). The first five are the mockup's crayons, darkened.
 */
// SPEC-QUESTION: the spec names no player colours; see DECISIONS (F02, F56).
export const PLAYER_COLORS = [
  '#C2410C', // vermilion
  '#1A7A4A', // green
  '#2457B8', // blue
  '#B0307F', // magenta
  '#8F6508', // ochre
  '#0F766E', // teal
  '#6D28D9', // violet
  '#B91C3C', // crimson
  '#5F7A12', // olive
  '#475569', // slate
  '#0E7490', // cyan
  '#9D174D', // raspberry
] as const;

// ---------- Settings ----------

export const DRAW_SECONDS_CHOICES = [45, 60, 80, 100] as const;
export const CYCLES_CHOICES = [1, 2, 3] as const;
export const DIFFICULTY_CHOICES = ['easy', 'mixed'] as const;
export const GUESS_FEED_CHOICES = ['all', 'clean', 'off'] as const;

/** `settings.categories` (Actions, `host:settings`): each id 1–40 characters, at most 100 ids. */
export const CATEGORY_ID_MIN = 1;
export const CATEGORY_ID_MAX = 40;
export const CATEGORIES_MAX = 100;

export const DEFAULT_SETTINGS: RoomSettings = {
  drawSeconds: 60,
  cycles: 2,
  hints: true,
  difficulty: 'mixed',
  // The real default is the store's visible `defaultOn` set, filled in by `createRoom` (F78).
  categories: [],
  guessFeed: 'all',
  autoAdvance: true,
};

/** Settings the host may change mid-game; the rest are lobby only. */
export const MID_GAME_SETTINGS = ['guessFeed'] as const satisfies readonly (keyof RoomSettings)[];

export type PresetId = 'quick' | 'classic' | 'partyNight';

/** Client-side shortcuts: picking one sends `host:settings` with its `settings`. */
export const PRESETS: Record<
  PresetId,
  { label: string; settings: Pick<RoomSettings, 'drawSeconds' | 'cycles' | 'hints'> }
> = {
  quick: { label: 'Quick', settings: { drawSeconds: 45, cycles: 1, hints: true } },
  classic: { label: 'Classic', settings: { drawSeconds: 60, cycles: 2, hints: true } },
  partyNight: { label: 'Party Night', settings: { drawSeconds: 80, cycles: 3, hints: true } },
};
export const DEFAULT_PRESET: PresetId = 'classic';

// ---------- Admin (F80) ----------

/** The admin session cookie (Admin access), path `/api/admin`. */
export const ADMIN_COOKIE = 'sketchy_admin';
/** An admin session lasts 12 hours (Buzzr's). */
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
/** Random bytes in a session token (base64url in the cookie). */
export const ADMIN_SESSION_BYTES = 32;
/** A new admin password (setup or reset) is at least 12 characters. */
export const ADMIN_PASSWORD_MIN = 12;
/** Any password or setup code: 1024 characters is at most 4 KB of UTF-8. */
export const ADMIN_PASSWORD_MAX = 1024;
/** `DATA_DIR/admin.env`: holds the `ADMIN_PASSWORD_HASH=` line. */
export const ADMIN_ENV_FILE = 'admin.env';

// ---------- Admin category editor (F81) ----------

/** A word or alternate is 1–30 characters (Word pack format); `server/packs.ts` uses these. */
export const WORD_FORM_MAX = 30;
/** A word has at most 6 alternates. */
export const WORD_ALT_MAX = 6;
/** A category title is 1–40 characters. */
export const CATEGORY_TITLE_MAX = 40;
/** A category emoji, in UTF-16 units: room for a sequence such as 👩‍🔬 or 🏳️‍🌈. */
export const CATEGORY_EMOJI_MAX = 16;
/** The admin shows a word filter once a category has this many words. */
export const ADMIN_WORD_FILTER_MIN = 20;
/** Bulk paste: at most this many lines, and this many bytes of body. */
export const ADMIN_BULK_LINES_MAX = 1000;
export const ADMIN_BULK_BYTES_MAX = 64 * 1024;

// ---------- Admin export and import (F82) ----------

/** An imported file (the request body) is at most 256 KB. */
export const ADMIN_IMPORT_BYTES_MAX = 256 * 1024;
/** An import refused for its contents lists at most this many problems. */
export const ADMIN_IMPORT_ISSUES_MAX = 20;
/** The emoji of an imported category whose id is not a seed pack's. */
export const ADMIN_IMPORT_EMOJI = '🎨';
/** Export file names: one category, and every category. */
export const exportFileName = (id: string) => `sketchy-category-${id}.json`;
export const EXPORT_ALL_FILE = 'sketchy-categories.json';

// ---------- Word generation (F83) ----------

/** A generation drafts 10–100 words, 40 unless the admin picks another number. */
export const GENERATE_COUNT_MIN = 10;
export const GENERATE_COUNT_MAX = 100;
export const GENERATE_COUNT_DEFAULT = 40;
/** Drafts waiting for review, at most; Save or Discard one to start another. */
export const GENERATE_DRAFTS_MAX = 10;
/** A draft (or a failed job) left unsaved this long after it ended is forgotten. */
export const GENERATE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
/** One request to the Claude API may take this long before the generation fails. */
export const GENERATE_REQUEST_TIMEOUT_MS = 3 * 60 * 1000;
/** The admin page asks how a running generation is doing this often. */
export const GENERATE_POLL_MS = 1500;
/** The only variable generation reads its key from. */
export const GENERATE_KEY_VAR = 'SKETCHY_ANTHROPIC_API_KEY';

// Values shared by the server and the client: app identity, palette and limits.
// Sizes use binary units (1 KB = 1024 bytes). Times are in milliseconds.

import type { RoomSettings } from './types.js';

export const APP_NAME = 'Buzzr';

/** Port of the Express + Socket.IO server. Vite (:5173) proxies to it in development. */
export const DEFAULT_PORT = 3000;

// ---------- Players ----------

/** One colour per player, used on their phone and wherever their name appears. Bright on a dark background. */
export const PLAYER_PALETTE = [
  '#EF4444', // red
  '#F97316', // orange
  '#FACC15', // yellow
  '#A3E635', // lime
  '#22C55E', // green
  '#2DD4BF', // teal
  '#38BDF8', // sky
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#D946EF', // magenta
  '#F472B6', // pink
  '#E2C08D', // sand
] as const;

export const MAX_PLAYERS_PER_ROOM = 50;
/** The `player:join` error for a kicked playerId. The phone keeps that id, so it stays refused. */
export const PLAYER_KICKED_ERROR = 'You were removed from this game';
/** The `screen:join` and `host:join` error for a wrong or stale hostToken. Clients drop the stored token on it. */
export const INVALID_HOST_TOKEN_ERROR = 'Invalid host token';
/** The error for a `host:*` event from a socket that did not join with the hostToken. */
export const NOT_HOST_ERROR = 'Only the host can do that';
/** The `*:join` error for a code with no room: never created, expired, or lost in a server restart. */
export const ROOM_NOT_FOUND_ERROR = 'Room not found';
/**
 * The page shown once a game is over for good: a `room:closed` event, or "Room not found" for a
 * room this device was in. Also the `player:join` error for a new player in FINAL.
 */
export const GAME_ENDED_ERROR = 'This game has ended';
/** The `room:closed` reason when the sweeper deletes an idle room. */
export const ROOM_EXPIRED_REASON = 'expired';
/** The `player:buzz` error past `BUZZ_RATE_LIMIT`. */
export const BUZZ_RATE_LIMITED_ERROR = 'Too many buzzes';
/** The `ping` error past `PING_RATE_LIMIT`. */
export const PING_RATE_LIMITED_ERROR = 'Too many pings';
/** Player names are trimmed, then must be 1 to 16 characters. */
export const PLAYER_NAME_MIN = 1;
export const PLAYER_NAME_MAX = 16;
/** Client-generated ids (playerId, question and set ids, imageId). */
// SPEC-QUESTION: the spec gives no id length; see DECISIONS (F02).
export const ID_MAX = 64;

// ---------- Rooms ----------

/** Room codes avoid look-alikes: no I, L or O. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;
/** Rooms are deleted after this long without activity. */
export const ROOM_IDLE_TTL_MS = 3 * 60 * 60 * 1000;
/** How often the server looks for idle rooms to delete. */
export const ROOM_SWEEP_INTERVAL_MS = 60 * 1000;
/** Random draws before room creation gives up (23^4 ≈ 280k codes, so this only trips when nearly full). */
export const ROOM_CODE_MAX_ATTEMPTS = 100;
/** hostToken: random bytes, sent as base64url (43 characters). */
export const HOST_TOKEN_BYTES = 32;
export const HOST_TOKEN_LENGTH = 43;
/** The Screen's pairing QR hides itself after this long. */
export const PAIRING_QR_TTL_MS = 60 * 1000;

export const DEFAULT_SETTINGS: RoomSettings = {
  wrongPenalty: false,
  autoOpenBuzzers: false,
  scoreboardEvery: 5,
};

// ---------- Question sets ----------

export const MAX_QUESTIONS_PER_SET = 100;
export const SET_TITLE_MAX = 100; // DECISIONS #11
export const QUESTION_TEXT_MAX = 300;
export const ANSWER_MAX = 200;
export const HOST_NOTES_MAX = 500; // DECISIONS #11
export const DEFAULT_POINTS = 100;
// SPEC-QUESTION: the spec gives no points range, no score-change bound and no scoreboard ceiling; see DECISIONS (F02).
export const POINTS_MIN = 0;
export const POINTS_MAX = 10_000;
/** Bounds a manual score change from `host:adjustScore`. */
export const SCORE_DELTA_MAX = 100_000;
/** 0 turns the automatic scoreboard off. */
export const SCOREBOARD_EVERY_MAX = MAX_QUESTIONS_PER_SET;

// ---------- Images ----------

export const IMAGE_MAX_SIDE_PX = 1600;
export const IMAGE_QUALITY = 0.8;
/** Image types the editor accepts and the server stores and serves. */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;
export const ROOM_IMAGES_MAX_BYTES = 50 * 1024 * 1024;
/** Cap on image bytes held across all rooms. */
export const GLOBAL_IMAGES_MAX_BYTES = 500 * 1024 * 1024; // DECISIONS #12

// ---------- Transport ----------

export const SOCKET_MESSAGE_MAX_BYTES = 100 * 1024;
/** `POST /api/rooms` JSON body. */
export const CREATE_ROOM_BODY_MAX_BYTES = 1024 * 1024; // DECISIONS #11

// ---------- Buzzer timing ----------

export const PING_INTERVAL_MS = 2000;
/** The server times RTT from `pong` to the client's ack of it, and drops the sample after this (DECISIONS F15). */
export const PONG_ACK_TIMEOUT_MS = 5000;
/** The rolling median RTT uses the last N samples. */
export const RTT_SAMPLES = 10;
/** After the first buzz, other buzzes are collected for this long. */
export const COLLECTION_WINDOW_MS = 150;
/** One-way latency correction is capped at this value. */
export const MAX_LATENCY_CORRECTION_MS = 150;
/** After a wrong answer, buzzers reopen for the others after this delay. */
export const REOPEN_DELAY_MS = 1500;
export const BUZZ_VIBRATE_MS = 30;

// ---------- Rate limits ----------

export const BUZZ_RATE_LIMIT = { max: 5, windowMs: 1000 } as const;
/** Per socket. A client pings every 2 s; each ping holds a pong timer on the server (DECISIONS F15). */
export const PING_RATE_LIMIT = { max: 5, windowMs: 1000 } as const;
export const PLAYER_JOIN_RATE_LIMIT = { max: 60, windowMs: 60 * 1000 } as const; // DECISIONS #3
export const ROOM_CREATE_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 } as const;

// ---------- Client UI ----------

export const AUTOSAVE_DEBOUNCE_MS = 500;
export const CONTROL_BAR_HIDE_MS = 3000;

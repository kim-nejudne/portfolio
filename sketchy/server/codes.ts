// Ported from Buzzr (buzzer/server/codes.ts). Changes: Tagalog blocked words.
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_CODE_MAX_ATTEMPTS,
} from '../shared/constants.js';

/** Returns a number in [0, 1), like `Math.random`. Injected so tests can seed it. */
export type Rng = () => number;

/**
 * Words a room code must not contain. A code is blocked when any of these appears in it,
 * so 3-letter entries also block every code that embeds them. Buzzr's English list, then
 * Tagalog profanity and slang of 4 letters or fewer (Kim reviews the Tagalog list; DECISIONS #14).
 */
export const BLOCKED_WORDS: readonly string[] = [
  'ANUS',
  'ARSE',
  'CRAP',
  'CUM',
  'CUNT',
  'DYKE',
  'FAG',
  'FCK',
  'FUCK',
  'FUK',
  'JEW',
  'KKK',
  'RAPE',
  'SEX',
  'SPAZ',
  'TURD',
  'TWAT',
  'WANK',
  // Tagalog. GAGO, BOBO, TITE and the like need I, L or O, which codes never use.
  'GAGA',
  'PEPE',
  'PUKE',
  'PUTA',
  'PWET',
  'TAE',
  'UTEN',
];

/** Draws one code from the alphabet. It may collide or be blocked; `createRoomCode` handles both. */
export function generateRoomCode(rng: Rng): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function isBlockedCode(code: string): boolean {
  return BLOCKED_WORDS.some((word) => code.includes(word));
}

/**
 * Returns a free, unblocked room code. Codes are not secrets (the hostToken is), so
 * `Math.random` is enough by default.
 */
export function createRoomCode(isTaken: (code: string) => boolean, rng: Rng = Math.random): string {
  for (let attempt = 0; attempt < ROOM_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode(rng);
    if (!isBlockedCode(code) && !isTaken(code)) return code;
  }
  throw new Error(`No free room code after ${ROOM_CODE_MAX_ATTEMPTS} attempts`);
}

// Ported from Buzzr (buzzer/server/codes.test.ts), with Tagalog cases and the room PRNG.
import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_CODE_MAX_ATTEMPTS,
} from '../shared/constants.js';
import {
  BLOCKED_WORDS,
  createRoomCode,
  generateRoomCode,
  isBlockedCode,
  type Rng,
} from './codes.js';
import { createRng } from './rng.js';

/** The room PRNG as an `Rng`, so every run draws the same codes. */
function seededRng(seed: number): Rng {
  const rng = createRng(seed);
  return () => rng.next();
}

/** An RNG that draws exactly the given codes, in order. */
function rngDrawing(...codes: string[]): Rng {
  const values = codes
    .join('')
    .split('')
    .map((letter) => (ROOM_CODE_ALPHABET.indexOf(letter) + 0.5) / ROOM_CODE_ALPHABET.length);
  return () => {
    const value = values.shift();
    if (value === undefined) throw new Error('rngDrawing ran out of values');
    return value;
  };
}

describe('generateRoomCode', () => {
  it('draws 4 letters from the room-code alphabet only', () => {
    const rng = seededRng(42);
    const pattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
    for (let i = 0; i < 10_000; i++) expect(generateRoomCode(rng)).toMatch(pattern);
  });

  it('stays inside the alphabet at both ends of the RNG range', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAA');
    expect(generateRoomCode(() => 0.999_999_999)).toBe('ZZZZ');
  });
});

describe('isBlockedCode', () => {
  it('blocks a code that is a blocked word', () => {
    expect(isBlockedCode('FUCK')).toBe(true);
    expect(isBlockedCode('CUNT')).toBe(true);
  });

  it('blocks a code that contains a blocked word', () => {
    expect(isBlockedCode('KKKA')).toBe(true);
    expect(isBlockedCode('AFAG')).toBe(true);
  });

  it('blocks Tagalog profanity, alone or inside a code', () => {
    for (const word of ['PUTA', 'PEPE', 'PUKE', 'UTEN', 'GAGA'])
      expect(isBlockedCode(word)).toBe(true);
    expect(isBlockedCode('TAEX')).toBe(true);
    expect(isBlockedCode('XTAE')).toBe(true);
  });

  it('lets ordinary codes through', () => {
    expect(isBlockedCode('ABCD')).toBe(false);
    expect(isBlockedCode('QUZZ')).toBe(false);
  });

  it('lists only words that a code could contain', () => {
    for (const word of BLOCKED_WORDS) {
      expect(word.length).toBeLessThanOrEqual(ROOM_CODE_LENGTH);
      expect(word).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`));
    }
  });
});

describe('createRoomCode', () => {
  it('returns the first draw when it is free', () => {
    expect(createRoomCode(() => false, rngDrawing('ABCD'))).toBe('ABCD');
  });

  it('retries on collision with an existing room (seeded RNG)', () => {
    const draws = seededRng(7);
    const first = generateRoomCode(draws);
    const second = generateRoomCode(draws);
    expect(isBlockedCode(first) || isBlockedCode(second)).toBe(false);
    expect(first).not.toBe(second);

    const taken = new Set([first]);
    expect(createRoomCode((code) => taken.has(code), seededRng(7))).toBe(second);
  });

  it('skips every code already in use', () => {
    const taken = new Set(['ABCD', 'EFGH']);
    expect(createRoomCode((code) => taken.has(code), rngDrawing('ABCD', 'EFGH', 'JKMN'))).toBe(
      'JKMN',
    );
  });

  it('retries instead of returning a blocked word', () => {
    expect(createRoomCode(() => false, rngDrawing('FUCK', 'TWAT', 'BEAR'))).toBe('BEAR');
    expect(createRoomCode(() => false, rngDrawing('PUTA', 'PEPE', 'BAHY'))).toBe('BAHY');
  });

  it('throws when every attempt collides', () => {
    let attempts = 0;
    const isTaken = () => {
      attempts++;
      return true;
    };
    expect(() => createRoomCode(isTaken, seededRng(1))).toThrow(/room code/i);
    expect(attempts).toBe(ROOM_CODE_MAX_ATTEMPTS);
  });
});

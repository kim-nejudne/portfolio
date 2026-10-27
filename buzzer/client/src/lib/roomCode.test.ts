import { describe, expect, it } from 'vitest';
import { ROOM_CODE_LENGTH } from '../../../shared/constants.js';
import { isCompleteRoomCode, normalizeRoomCode } from './roomCode.js';

describe('normalizeRoomCode', () => {
  it('upper-cases typed letters', () => {
    expect(normalizeRoomCode('abcd')).toBe('ABCD');
  });

  it('drops look-alike letters I, L and O in either case', () => {
    expect(normalizeRoomCode('aIiLlOob')).toBe('AB');
  });

  it('drops digits, spaces and punctuation', () => {
    expect(normalizeRoomCode(' a1-b 2c.d ')).toBe('ABCD');
  });

  it(`keeps at most ${ROOM_CODE_LENGTH} letters`, () => {
    expect(normalizeRoomCode('abcdefgh')).toBe('ABCD');
  });

  it('cleans a pasted code with surrounding text', () => {
    expect(normalizeRoomCode('  wxyz\n')).toBe('WXYZ');
  });

  it('returns an empty string for nothing usable', () => {
    expect(normalizeRoomCode('ilo 123')).toBe('');
  });
});

describe('isCompleteRoomCode', () => {
  it('accepts a full-length normalised code', () => {
    expect(isCompleteRoomCode('ABCD')).toBe(true);
  });

  it('rejects a short code', () => {
    expect(isCompleteRoomCode('ABC')).toBe(false);
  });

  it('rejects a code with an excluded letter', () => {
    expect(isCompleteRoomCode('ABCI')).toBe(false);
  });
});

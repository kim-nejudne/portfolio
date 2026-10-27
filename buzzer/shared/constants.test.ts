import { describe, expect, it } from 'vitest';
import {
  APP_NAME,
  DEFAULT_PORT,
  DEFAULT_SETTINGS,
  PLAYER_PALETTE,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from './constants.js';

describe('shared constants', () => {
  it('names the app and the server port the Vite proxy targets', () => {
    expect(APP_NAME).toBe('Buzzr');
    expect(DEFAULT_PORT).toBe(3000);
  });

  it('has 12 distinct hex player colours', () => {
    expect(PLAYER_PALETTE).toHaveLength(12);
    expect(new Set(PLAYER_PALETTE.map((c) => c.toUpperCase())).size).toBe(12);
    for (const colour of PLAYER_PALETTE) expect(colour).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('builds 4-letter room codes from upper-case letters without I, L or O', () => {
    expect(ROOM_CODE_LENGTH).toBe(4);
    expect(ROOM_CODE_ALPHABET).toMatch(/^[A-Z]+$/);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[ILO]/);
    expect(ROOM_CODE_ALPHABET).toHaveLength(23);
  });

  it('defaults to no penalty, manual buzzer opening and a scoreboard every 5 questions', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      wrongPenalty: false,
      autoOpenBuzzers: false,
      scoreboardEvery: 5,
    });
  });
});

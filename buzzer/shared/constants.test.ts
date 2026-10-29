import { describe, expect, it } from 'vitest';
import {
  ANSWER_SECONDS_CHOICES,
  APP_NAME,
  AVATARS,
  BUZZ_SECONDS_CHOICES,
  CHOICE_LETTERS,
  CHOICE_SECONDS_DEFAULT,
  CHOICE_SECONDS_MAX,
  CHOICE_SECONDS_MIN,
  CHOICES_MAX,
  CHOICES_MIN,
  DEFAULT_PORT,
  DEFAULT_SETTINGS,
  FALSE_START_MS_CHOICES,
  PLAYER_PALETTE,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  TEAM_COUNT_CHOICES,
  TEAMS,
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

  it('has 24 distinct avatars, each a single emoji glyph', () => {
    expect(AVATARS).toHaveLength(24);
    expect(new Set(AVATARS).size).toBe(24);
    for (const avatar of AVATARS) {
      expect([...avatar], avatar).toHaveLength(1);
      expect(avatar, avatar).toMatch(/^\p{Emoji_Presentation}$/u);
    }
  });

  it('builds 4-letter room codes from upper-case letters without I, L or O', () => {
    expect(ROOM_CODE_LENGTH).toBe(4);
    expect(ROOM_CODE_ALPHABET).toMatch(/^[A-Z]+$/);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[ILO]/);
    expect(ROOM_CODE_ALPHABET).toHaveLength(23);
  });

  it('defaults to no penalty, manual buzzer opening, a scoreboard every 5 questions no answer or buzz timer, no false start, the standings rail on, teams off and 10 s for a choice question', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      wrongPenalty: false,
      autoOpenBuzzers: false,
      scoreboardEvery: 5,
      answerSeconds: 0,
      buzzSeconds: 0,
      falseStartMs: 0,
      showStandings: true,
      teams: 0,
      choiceSeconds: 10,
    });
  });

  it('gives a choice question 5 to 30 seconds, 10 by default', () => {
    expect([CHOICE_SECONDS_MIN, CHOICE_SECONDS_MAX]).toEqual([5, 30]);
    expect(DEFAULT_SETTINGS.choiceSeconds).toBe(CHOICE_SECONDS_DEFAULT);
  });

  it('offers teams Off, 2, 3 and 4 in stepper order', () => {
    expect(TEAM_COUNT_CHOICES).toEqual([0, 2, 3, 4]);
    expect(TEAM_COUNT_CHOICES).toContain(DEFAULT_SETTINGS.teams);
  });

  it('has a distinct name and a distinct palette colour for each of the 4 teams', () => {
    expect(TEAMS).toHaveLength(Math.max(...TEAM_COUNT_CHOICES));
    expect(new Set(TEAMS.map((t) => t.name)).size).toBe(TEAMS.length);
    expect(new Set(TEAMS.map((t) => t.color)).size).toBe(TEAMS.length);
    for (const { color } of TEAMS) expect(PLAYER_PALETTE).toContain(color);
  });

  it('offers buzz times Off, 5, 10, 15, 20 and 30 s in stepper order', () => {
    expect(BUZZ_SECONDS_CHOICES).toEqual([0, 5, 10, 15, 20, 30]);
  });

  it('offers false-start waits Off, 0.5 s and 1 s in stepper order', () => {
    expect(FALSE_START_MS_CHOICES).toEqual([0, 500, 1000]);
    expect(FALSE_START_MS_CHOICES).toContain(DEFAULT_SETTINGS.falseStartMs);
  });

  it('offers answer times Off, 3, 5, 7 and 10 s in stepper order', () => {
    expect(ANSWER_SECONDS_CHOICES).toEqual([0, 3, 5, 7, 10]);
    expect(ANSWER_SECONDS_CHOICES).toContain(DEFAULT_SETTINGS.answerSeconds);
  });

  it('allows 2 to 4 choices, one letter A–D each', () => {
    expect([CHOICES_MIN, CHOICES_MAX]).toEqual([2, 4]);
    expect(CHOICE_LETTERS).toEqual(['A', 'B', 'C', 'D']);
    expect(CHOICE_LETTERS).toHaveLength(CHOICES_MAX);
  });
});

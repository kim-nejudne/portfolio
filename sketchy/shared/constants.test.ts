import { describe, expect, it } from 'vitest';
import * as C from './constants.js';
import {
  BACKGROUND_COLOR,
  DEFAULT_PRESET,
  DEFAULT_SETTINGS,
  DRAW_COLORS,
  PLAYER_COLORS,
  PRESETS,
  ROOM_CODE_ALPHABET,
} from './constants.js';
import { partialSettingsSchema, roomSettingsSchema } from './schemas.js';

/** WCAG relative luminance of a `#RRGGBB` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE L*a*b* (D65) of a `#RRGGBB` colour. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t) / 116 + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIE76 colour difference: about 2 is just noticeable, 15+ reads as a different colour. */
function deltaE(a: string, b: string): number {
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

describe('fixed constants', () => {
  it('match the spec', () => {
    expect({
      CHOOSE_MS: C.CHOOSE_MS,
      REVEAL_MS: C.REVEAL_MS,
      SCOREBOARD_MS: C.SCOREBOARD_MS,
      ALL_GUESSED_MS: C.ALL_GUESSED_MS,
      GRACE_MS: C.GRACE_MS,
      MAX_LATENCY_CORRECTION_MS: C.MAX_LATENCY_CORRECTION_MS,
      DRAWER_AWAY_DEBOUNCE_MS: C.DRAWER_AWAY_DEBOUNCE_MS,
      DRAWER_AWAY_MS: C.DRAWER_AWAY_MS,
      SCREEN_AWAY_MS: C.SCREEN_AWAY_MS,
      RESUME_COUNTDOWN_MS: C.RESUME_COUNTDOWN_MS,
      REMATCH_COUNTDOWN_MS: C.REMATCH_COUNTDOWN_MS,
      PING_INTERVAL_MS: C.PING_INTERVAL_MS,
      RTT_SAMPLES: C.RTT_SAMPLES,
      ROOM_IDLE_TTL_MS: C.ROOM_IDLE_TTL_MS,
      GUESS_MAX: C.GUESS_MAX,
      GUESS_INTERVAL_MS: C.GUESS_INTERVAL_MS,
      REACTION_INTERVAL_MS: C.REACTION_INTERVAL_MS,
      FEED_MAX: C.FEED_MAX,
      CLOSE_GUESSES_MAX: C.CLOSE_GUESSES_MAX,
      MIN_PLAYERS: C.MIN_PLAYERS,
      MAX_PLAYERS: C.MAX_PLAYERS,
      PLAYER_NAME_MIN: C.PLAYER_NAME_MIN,
      PLAYER_NAME_MAX: C.PLAYER_NAME_MAX,
      CUSTOM_WORDS_MAX: C.CUSTOM_WORDS_MAX,
      CUSTOM_WORD_MAX: C.CUSTOM_WORD_MAX,
      INK_GRID: C.INK_GRID,
      INK_FLUSH_MS: C.INK_FLUSH_MS,
      INK_RADIAL_MIN: C.INK_RADIAL_MIN,
      INK_RDP_EPSILON: C.INK_RDP_EPSILON,
      INK_SIZES: C.INK_SIZES,
      INK_BATCH_MAX_BYTES: C.INK_BATCH_MAX_BYTES,
      INK_POINTS_PER_OP_MAX: C.INK_POINTS_PER_OP_MAX,
      INK_TURN_MAX_BYTES: C.INK_TURN_MAX_BYTES,
      INK_ROOM_MAX_BYTES: C.INK_ROOM_MAX_BYTES,
      INK_INVALID_BATCHES_MAX: C.INK_INVALID_BATCHES_MAX,
      SOCKET_MAX_BUFFER_BYTES: C.SOCKET_MAX_BUFFER_BYTES,
      SOCKET_PING: [C.SOCKET_PING_INTERVAL_MS, C.SOCKET_PING_TIMEOUT_MS],
      GUESSER_POINTS: [C.GUESSER_POINTS_MIN, C.GUESSER_POINTS_MAX, C.POINTS_STEP],
      DRAWER_SHARE: C.DRAWER_SHARE,
      HINT_AT: C.HINT_AT,
    }).toEqual({
      CHOOSE_MS: 12_000,
      REVEAL_MS: 8_000,
      SCOREBOARD_MS: 6_000,
      ALL_GUESSED_MS: 1_500,
      GRACE_MS: 300,
      MAX_LATENCY_CORRECTION_MS: 250,
      DRAWER_AWAY_DEBOUNCE_MS: 2_000,
      DRAWER_AWAY_MS: 30_000,
      SCREEN_AWAY_MS: 3_000,
      RESUME_COUNTDOWN_MS: 3_000,
      REMATCH_COUNTDOWN_MS: 3_000,
      PING_INTERVAL_MS: 2_000,
      RTT_SAMPLES: 10,
      ROOM_IDLE_TTL_MS: 3 * 60 * 60 * 1000,
      GUESS_MAX: 40,
      GUESS_INTERVAL_MS: 700,
      REACTION_INTERVAL_MS: 1_000,
      FEED_MAX: 8,
      CLOSE_GUESSES_MAX: 3,
      MIN_PLAYERS: 2,
      MAX_PLAYERS: 10,
      PLAYER_NAME_MIN: 1,
      PLAYER_NAME_MAX: 16,
      CUSTOM_WORDS_MAX: 100,
      CUSTOM_WORD_MAX: 30,
      INK_GRID: 1024,
      INK_FLUSH_MS: 50,
      INK_RADIAL_MIN: 3,
      INK_RDP_EPSILON: 1,
      INK_SIZES: [4, 10, 24],
      INK_BATCH_MAX_BYTES: 4 * 1024,
      INK_POINTS_PER_OP_MAX: 200,
      INK_TURN_MAX_BYTES: 200 * 1024,
      INK_ROOM_MAX_BYTES: 4 * 1024 * 1024,
      INK_INVALID_BATCHES_MAX: 20,
      SOCKET_MAX_BUFFER_BYTES: 100 * 1024,
      SOCKET_PING: [5_000, 5_000],
      GUESSER_POINTS: [100, 300, 5],
      DRAWER_SHARE: 0.5,
      HINT_AT: [0.5, 0.75],
    });
    expect(C.REACTIONS).toEqual(['😂', '🔥', '👏', '😱', '🤔', '💀']);
  });

  it('offers 24 distinct avatars, each one emoji-presentation code point (F53)', () => {
    expect(C.AVATARS).toHaveLength(24);
    expect(new Set(C.AVATARS).size).toBe(24);
    for (const avatar of C.AVATARS) {
      expect([...avatar], avatar).toHaveLength(1);
      expect(avatar, avatar).toMatch(/^\p{Emoji_Presentation}$/u);
    }
  });
});

describe('settings', () => {
  it('defaults are valid settings and match the spec', () => {
    expect(roomSettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({ drawSeconds: 60, cycles: 2, hints: true });
    // English only (F69): no words or copy setting.
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual(
      ['autoAdvance', 'cycles', 'difficulty', 'drawSeconds', 'guessFeed', 'hints', 'spicy'].sort(),
    );
  });

  it('every preset is a valid host:settings payload, and Classic is the defaults', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(partialSettingsSchema.safeParse(preset.settings).success).toBe(true);
    }
    expect(DEFAULT_SETTINGS).toMatchObject(PRESETS[DEFAULT_PRESET].settings);
    expect(PRESETS.quick.settings).toEqual({ drawSeconds: 45, cycles: 1, hints: true });
    expect(PRESETS.partyNight).toEqual({
      label: 'Party Night',
      settings: { drawSeconds: 80, cycles: 3, hints: true },
    });
  });
});

describe('palettes', () => {
  it('has 8 drawing colours and 12 player colours, all distinct', () => {
    expect(DRAW_COLORS).toHaveLength(8);
    expect(PLAYER_COLORS).toHaveLength(12);
    const all = [...DRAW_COLORS, ...PLAYER_COLORS].map((c) => c.toUpperCase());
    expect(new Set(all).size).toBe(all.length);
  });

  it('the background is the sketchbook paper', () => {
    expect(BACKGROUND_COLOR).toBe('#F8F8F3');
  });

  it('player colours are readable on paper (≥ 4.5:1), since names are written in them', () => {
    for (const color of PLAYER_COLORS) {
      expect(contrast(color, BACKGROUND_COLOR), color).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('player colours stay distinct from every drawing colour and from each other', () => {
    for (const color of PLAYER_COLORS) {
      for (const draw of DRAW_COLORS) {
        expect(deltaE(color, draw), `${color} vs ${draw}`).toBeGreaterThanOrEqual(15);
      }
      for (const other of PLAYER_COLORS) {
        if (other !== color) {
          expect(deltaE(color, other), `${color} vs ${other}`).toBeGreaterThanOrEqual(20);
        }
      }
    }
  });
});

describe('room codes', () => {
  it('leave out the look-alikes I, L and O', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[ILO]/);
    expect(ROOM_CODE_ALPHABET).toHaveLength(23);
  });
});

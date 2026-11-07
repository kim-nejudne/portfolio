import { describe, expect, it } from 'vitest';
import { EMOJI, MAX_LAT } from '#shared/constants.js';
import {
  boxSchema,
  categoriesFileSchema,
  categoryEmojiBodySchema,
  clientEventSchemas,
  generateBodySchema,
  latLngSchema,
  normalizeLng,
  placeEditBodySchema,
  type ClientEvent,
} from '#shared/schemas.js';

const KEY = 'V1StGXR8_Z5jdHi6B-myT'; // 21 chars

const ok = (e: ClientEvent, p: unknown) => clientEventSchemas[e].safeParse(p).success;

describe('coordinates', () => {
  it('normalises longitude into [−180, 180)', () => {
    expect(normalizeLng(0)).toBe(0);
    expect(normalizeLng(-0)).toBe(0);
    expect(Object.is(normalizeLng(-360), 0)).toBe(true);
    expect(normalizeLng(180)).toBe(-180);
    expect(normalizeLng(-180)).toBe(-180);
    expect(normalizeLng(179.5)).toBe(179.5);
    expect(normalizeLng(190)).toBe(-170);
    expect(normalizeLng(-190)).toBe(170);
    expect(normalizeLng(540)).toBe(-180);
    expect(normalizeLng(-725)).toBe(-5);
    expect(normalizeLng(1e6)).toBeGreaterThanOrEqual(-180);
    expect(normalizeLng(1e6)).toBeLessThan(180);
  });

  it('outputs the normalised longitude', () => {
    expect(latLngSchema.parse({ lat: 35.68, lng: 139.69 })).toEqual({ lat: 35.68, lng: 139.69 });
    expect(latLngSchema.parse({ lat: 35.68, lng: 499.69 }).lng).toBeCloseTo(139.69, 9);
  });

  it('accepts latitudes on the Web Mercator limit and refuses beyond it', () => {
    expect(latLngSchema.safeParse({ lat: MAX_LAT, lng: 0 }).success).toBe(true);
    expect(latLngSchema.safeParse({ lat: -MAX_LAT, lng: 0 }).success).toBe(true);
    expect(latLngSchema.safeParse({ lat: 85.0512, lng: 0 }).success).toBe(false);
    expect(latLngSchema.safeParse({ lat: -90, lng: 0 }).success).toBe(false);
  });

  it('refuses non-finite and non-numeric coordinates', () => {
    for (const bad of [
      { lat: NaN, lng: 0 },
      { lat: 0, lng: NaN },
      { lat: 0, lng: Infinity },
      { lat: 0, lng: -Infinity },
      { lat: '1', lng: 0 },
      { lat: 0 },
      null,
    ]) {
      expect(latLngSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('applies to practice, aim and lock-in', () => {
    for (const e of ['player:practice', 'player:aim', 'player:lockIn'] as const) {
      expect(ok(e, { lat: 1, lng: 2 })).toBe(true);
      expect(ok(e, { lat: 89, lng: 2 })).toBe(false);
    }
  });
});

describe('screen:join', () => {
  it('upper-cases and trims the code', () => {
    expect(clientEventSchemas['screen:join'].parse({ code: ' abcd ' })).toEqual({ code: 'ABCD' });
  });
  it('refuses I, L, O, wrong lengths and non-letters', () => {
    for (const code of ['ABCI', 'ABCL', 'ABCO', 'ABC', 'ABCDE', 'AB1D', '']) {
      expect(ok('screen:join', { code })).toBe(false);
    }
  });
});

describe('player:join', () => {
  const valid = { code: 'WXYZ', playerKey: KEY, name: '  Mika ', emoji: '🦊' };

  it('accepts a valid join and trims the name', () => {
    expect(clientEventSchemas['player:join'].parse(valid)).toEqual({ ...valid, name: 'Mika' });
  });
  it('accepts every listed emoji and nothing else', () => {
    for (const emoji of EMOJI) expect(ok('player:join', { ...valid, emoji })).toBe(true);
    for (const emoji of ['🐶', 'A', '', '🦊🦊']) {
      expect(ok('player:join', { ...valid, emoji })).toBe(false);
    }
  });
  it('enforces name length 1–16 after trimming', () => {
    expect(ok('player:join', { ...valid, name: 'x'.repeat(16) })).toBe(true);
    expect(ok('player:join', { ...valid, name: `  ${'x'.repeat(16)}  ` })).toBe(true);
    expect(ok('player:join', { ...valid, name: 'x'.repeat(17) })).toBe(false);
    expect(ok('player:join', { ...valid, name: '   ' })).toBe(false);
    expect(ok('player:join', { ...valid, name: '' })).toBe(false);
  });
  it('refuses invisible characters in names', () => {
    expect(ok('player:join', { ...valid, name: 'Mi​ka' })).toBe(false);
    expect(ok('player:join', { ...valid, name: 'Mi\nka' })).toBe(false);
  });
  it('requires a 21-character nanoid key', () => {
    expect(ok('player:join', { ...valid, playerKey: KEY.slice(1) })).toBe(false);
    expect(ok('player:join', { ...valid, playerKey: `${KEY.slice(1)}!` })).toBe(false);
    expect(ok('player:join', { ...valid, playerKey: undefined })).toBe(false);
  });
});

describe('player:rename', () => {
  it('takes a name and an optional emoji', () => {
    expect(ok('player:rename', { name: 'Ana' })).toBe(true);
    expect(ok('player:rename', { name: 'Ana', emoji: '🐲' })).toBe(true);
    expect(ok('player:rename', { name: 'Ana', emoji: '🐶' })).toBe(false);
    expect(ok('player:rename', {})).toBe(false);
  });
});

describe('events without data', () => {
  const empty = [
    'player:leave',
    'vip:start',
    'vip:next',
    'vip:pause',
    'vip:resume',
    'vip:skipRound',
    'vip:end',
    'vip:rematch',
    'vip:rematchCancel',
    'vip:backToLobby',
  ] as const;
  it('accept {} and strip extra keys', () => {
    for (const e of empty) {
      expect(clientEventSchemas[e].parse({ extra: 1 })).toEqual({});
    }
  });
  it('refuse non-objects', () => {
    for (const e of empty) {
      expect(ok(e, null)).toBe(false);
      expect(ok(e, 'x')).toBe(false);
    }
  });
});

describe('vip:settings', () => {
  it('accepts any subset of valid settings', () => {
    expect(ok('vip:settings', {})).toBe(true);
    expect(ok('vip:settings', { mode: 'picture', rounds: 15 })).toBe(true);
    expect(
      ok('vip:settings', {
        categoryId: 'japan',
        mode: 'name',
        difficulty: 'mixed',
        rounds: 5,
        timerSeconds: 45,
      }),
    ).toBe(true);
  });
  it('refuses values off the menu', () => {
    expect(ok('vip:settings', { rounds: 7 })).toBe(false);
    expect(ok('vip:settings', { timerSeconds: 60 })).toBe(false);
    expect(ok('vip:settings', { mode: 'map' })).toBe(false);
    expect(ok('vip:settings', { difficulty: 'expert' })).toBe(false);
    expect(ok('vip:settings', { categoryId: '../etc' })).toBe(false);
    expect(ok('vip:settings', { categoryId: '' })).toBe(false);
  });
});

describe('vip:kick and vip:roundSettings', () => {
  it('kick needs a player id', () => {
    expect(ok('vip:kick', { playerId: 'aB3_-xYz09aB3_-x' })).toBe(true);
    expect(ok('vip:kick', {})).toBe(false);
    expect(ok('vip:kick', { playerId: 'a b' })).toBe(false);
  });
  it('round settings take only timer and rounds', () => {
    expect(ok('vip:roundSettings', { timerSeconds: 20 })).toBe(true);
    expect(ok('vip:roundSettings', { rounds: 10, timerSeconds: 30 })).toBe(true);
    expect(ok('vip:roundSettings', { rounds: 12 })).toBe(false);
    expect(clientEventSchemas['vip:roundSettings'].parse({ mode: 'picture' })).toEqual({});
  });
});

describe('boxes', () => {
  it('accepts normal and antimeridian-crossing boxes', () => {
    expect(boxSchema.safeParse({ south: 30, west: 129, north: 45.5, east: 146 }).success).toBe(
      true,
    );
    expect(boxSchema.safeParse({ south: -50, west: 165, north: -30, east: 200 }).success).toBe(
      true,
    );
    expect(boxSchema.safeParse({ south: -60, west: -180, north: 80, east: 180 }).success).toBe(
      true,
    );
  });
  it('refuses inverted or over-wide boxes', () => {
    expect(boxSchema.safeParse({ south: 45, west: 129, north: 30, east: 146 }).success).toBe(false);
    expect(boxSchema.safeParse({ south: 30, west: 146, north: 45, east: 129 }).success).toBe(false);
    expect(boxSchema.safeParse({ south: 30, west: -180, north: 45, east: 181 }).success).toBe(
      false,
    );
  });
});

describe('admin bodies', () => {
  it('generate needs a name and at least one level of 5–30', () => {
    const base = { name: 'Japan', guidance: '' };
    expect(generateBodySchema.safeParse({ ...base, levels: { easy: { count: 15 } } }).success).toBe(
      true,
    );
    expect(generateBodySchema.safeParse({ ...base, levels: {} }).success).toBe(false);
    expect(generateBodySchema.safeParse({ ...base, levels: { easy: { count: 4 } } }).success).toBe(
      false,
    );
    expect(generateBodySchema.safeParse({ ...base, levels: { hard: { count: 31 } } }).success).toBe(
      false,
    );
    expect(
      generateBodySchema.safeParse({ ...base, name: ' ', levels: { easy: { count: 5 } } }).success,
    ).toBe(false);
  });
  it('place edits send lat and lng together, normalised', () => {
    expect(placeEditBodySchema.parse({ lat: 10, lng: 190 })).toEqual({ lat: 10, lng: -170 });
    expect(placeEditBodySchema.safeParse({ lat: 10 }).success).toBe(false);
    expect(placeEditBodySchema.safeParse({ fact: 'x'.repeat(91) }).success).toBe(false);
    expect(placeEditBodySchema.safeParse({ photoCandidate: 'File:Tokyo.jpg' }).success).toBe(true);
    expect(placeEditBodySchema.safeParse({ photoCandidate: 'Tokyo.jpg' }).success).toBe(false);
  });
  it('category emoji is one emoji or null', () => {
    expect(categoryEmojiBodySchema.safeParse({ emoji: '🗾' }).success).toBe(true);
    expect(categoryEmojiBodySchema.safeParse({ emoji: '🇯🇵' }).success).toBe(true);
    expect(categoryEmojiBodySchema.safeParse({ emoji: null }).success).toBe(true);
    expect(categoryEmojiBodySchema.safeParse({ emoji: 'ab' }).success).toBe(false);
    expect(categoryEmojiBodySchema.safeParse({ emoji: '🗾🗾' }).success).toBe(false);
  });
});

describe('categories.json', () => {
  it('parses a minimal file and refuses another schema version', () => {
    const file = {
      schemaVersion: 1,
      categories: [
        {
          id: 'japan',
          name: 'Japan',
          emoji: '🗾',
          box: { south: 30, west: 129, north: 45.5, east: 146 },
          labelStyle: 'city',
          draftMeta: null,
          hidden: false,
          live: {
            easy: {
              reviewed: true,
              updatedAt: 1,
              places: [
                {
                  id: 'p1',
                  kind: 'city',
                  name: 'Osaka',
                  displayName: 'Osaka',
                  autoDisplayName: true,
                  fact: 'Home of the first instant noodles.',
                  lat: 34.69,
                  lng: 135.5,
                  coordsSource: 'wikidata',
                  wikidataId: 'Q35765',
                  countryId: 'Q17',
                  countryName: 'Japan',
                },
              ],
            },
          },
          draft: {},
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
    expect(categoriesFileSchema.safeParse(file).success).toBe(true);
    expect(categoriesFileSchema.safeParse({ ...file, schemaVersion: 2 }).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  CUSTOM_WORD_MAX,
  CUSTOM_WORDS_MAX,
  DOODLE_MAX_BYTES,
  GUESS_MAX,
  INK_BATCH_MAX_BYTES,
  INK_GRID,
  INK_POINTS_PER_OP_MAX,
  PLAYER_NAME_MAX,
} from './constants.js';
import {
  clientPayloadSchemas,
  createRoomBodySchema,
  inkAuthSchema,
  inkBatchSchema,
  inkOpSchema,
  inkPayloadSchemas,
  partialSettingsSchema,
  playerNameSchema,
  roomCodeSchema,
} from './schemas.js';
import type { ClientEvent, InkClientEvent } from './types.js';

const TOKEN = 'a'.repeat(43);
const KEY = 'V1StGXR8_Z5jdHi6B-myT';

function accepts(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) {
  return schema.safeParse(value).success;
}

/** For each event: valid examples, then payloads it must reject. */
const cases: { [E in ClientEvent]: { valid: unknown[]; invalid: unknown[] } } = {
  'screen:join': {
    valid: [{ code: 'ABCD' }, { code: 'abcd', hostToken: TOKEN }],
    invalid: [
      {},
      { code: 'ABC' },
      { code: 'ABIO' },
      { code: 'ABCD', hostToken: 'short' },
      { code: 'ABCD', hostToken: `${TOKEN}a` },
    ],
  },
  'player:join': {
    valid: [
      { code: 'ABCD', playerKey: KEY, name: 'Bea', avatar: '🦊' },
      { code: 'ABCD', playerKey: KEY, name: 'Jun', avatar: '🚀', takeOver: true },
      { code: 'ABCD', playerKey: KEY, name: 'Jun', avatar: '🐼', hidden: true },
      { code: 'ABCD', playerKey: KEY, name: 'x'.repeat(PLAYER_NAME_MAX), avatar: '🦊' },
    ],
    invalid: [
      { code: 'ABCD', name: 'Bea', avatar: '🦊' },
      { code: 'ABCD', playerKey: 'too-short', name: 'Bea', avatar: '🦊' },
      { code: 'ABCD', playerKey: `${KEY}x`, name: 'Bea', avatar: '🦊' },
      { code: 'ABCD', playerKey: 'V1StGXR8 Z5jdHi6B-myT', name: 'Bea', avatar: '🦊' },
      { code: 'ABCD', playerKey: KEY, name: '   ', avatar: '🦊' },
      { code: 'ABCD', playerKey: KEY, name: 'x'.repeat(PLAYER_NAME_MAX + 1), avatar: '🦊' },
      { code: 'ABCD', playerKey: KEY, name: 'Bea', avatar: '🦊', takeOver: 'yes' },
      { code: 'ABCD', playerKey: KEY, name: 'Bea', avatar: '🦊', hidden: 'yes' },
      // The avatar is required, and only one of the 24 (F53).
      { code: 'ABCD', playerKey: KEY, name: 'Bea' },
      { code: 'ABCD', playerKey: KEY, name: 'Bea', avatar: '💩' },
      { code: 'ABCD', playerKey: KEY, name: 'Bea', avatar: '🦊🐼' },
      { code: 'ABCD', playerKey: KEY, name: 'Bea', avatar: '👨‍🎨' },
      { code: 'ABCD', playerKey: KEY, name: 'Bea', avatar: '' },
    ],
  },
  ping: { valid: [{ t: 123.5 }], invalid: [{}, { t: '1' }, { t: Infinity }] },
  'player:guess': {
    valid: [{ text: 'payong' }, { text: 'x'.repeat(GUESS_MAX) }],
    invalid: [
      {},
      { text: '' },
      { text: '   ' },
      { text: 'x'.repeat(GUESS_MAX + 1) },
      { text: 4 },
      { text: 'pay\u0007ong' },
    ],
  },
  'player:react': {
    valid: [{ emoji: '😂' }, { emoji: '💀' }],
    invalid: [{ emoji: '🍕' }, { emoji: 'the word is kubo' }, {}],
  },
  'player:visibility': { valid: [{ hidden: true }], invalid: [{}, { hidden: 'true' }] },
  'player:rename': { valid: [{ name: 'Mika' }], invalid: [{}, { name: '' }, { name: 'a​b' }] },
  'player:avatar': {
    valid: [{ avatar: '🦊' }, { avatar: '🚀' }],
    invalid: [{}, { avatar: '💩' }, { avatar: '🦊🐼' }, { avatar: '👨‍🎨' }, { avatar: '' }],
  },
  'player:leave': { valid: [{}], invalid: [null, 'leave'] },
  'drawer:choose': {
    valid: [{ index: 0 }, { index: 1 }, { index: 2 }],
    invalid: [{}, { index: 3 }, { index: -1 }, { index: 1.5 }, { index: '0' }],
  },
  'host:start': { valid: [{}], invalid: [null] },
  'host:pause': { valid: [{}], invalid: [null] },
  'host:resume': { valid: [{}], invalid: [null] },
  'host:skip': { valid: [{}], invalid: [null] },
  'host:next': { valid: [{}], invalid: [null] },
  'host:kick': { valid: [{ pid: 'p_1' }], invalid: [{}, { pid: '' }, { pid: 'a b' }] },
  'host:crown': { valid: [{ pid: 'p-2' }], invalid: [{}, { pid: 'x'.repeat(65) }] },
  'host:settings': {
    valid: [{}, { drawSeconds: 80 }, { guessFeed: 'off', copy: 'taglish', cycles: 3 }],
    invalid: [
      { drawSeconds: 50 },
      { cycles: 4 },
      { guessFeed: 'loud' },
      { drawSecs: 60 },
      { drawSeconds: 80, cycles: 9 }, // one bad key rejects the whole payload
    ],
  },
  'host:customWords': {
    valid: [{ words: [] }, { words: ['lechon', 'jollibee'] }, { words: [], clear: true }],
    invalid: [
      {},
      { words: [], clear: false },
      { words: ['x'.repeat(CUSTOM_WORD_MAX + 1)] },
      { words: Array.from({ length: CUSTOM_WORDS_MAX + 1 }, (_, i) => `w${i}`) },
    ],
  },
  'host:end': { valid: [{}], invalid: [null] },
  'host:rematch': { valid: [{}], invalid: [null] },
  'host:rematchCancel': { valid: [{}], invalid: [null] },
  'host:backToLobby': { valid: [{}], invalid: [null] },
  'debug:rtt': { valid: [{}], invalid: [null, 'all'] },
};

describe('clientPayloadSchemas', () => {
  it('has a schema for every client event and a test case for every schema', () => {
    expect(Object.keys(clientPayloadSchemas).sort()).toEqual(Object.keys(cases).sort());
  });

  for (const [event, { valid, invalid }] of Object.entries(cases) as [
    ClientEvent,
    (typeof cases)[ClientEvent],
  ][]) {
    it(`${event} accepts valid payloads and rejects bad ones`, () => {
      const schema = clientPayloadSchemas[event];
      for (const v of valid) expect(accepts(schema, v), JSON.stringify(v)).toBe(true);
      for (const v of invalid) expect(accepts(schema, v), JSON.stringify(v)).toBe(false);
    });
  }

  it('trims a guess and strips unknown keys', () => {
    expect(clientPayloadSchemas['player:guess'].parse({ text: '  payong ', x: 1 })).toEqual({
      text: 'payong',
    });
  });

  it('drops blank custom words', () => {
    expect(clientPayloadSchemas['host:customWords'].parse({ words: ['lechon', ' ', ''] })).toEqual({
      words: ['lechon'],
    });
  });

  it('upper-cases a typed room code', () => {
    expect(roomCodeSchema.parse(' abcd ')).toBe('ABCD');
  });

  it('trims names', () => {
    expect(playerNameSchema.parse('  Bea  ')).toBe('Bea');
  });
});

describe('createRoomBodySchema', () => {
  it('accepts no settings or partial settings', () => {
    expect(accepts(createRoomBodySchema, {})).toBe(true);
    expect(accepts(createRoomBodySchema, { settings: { drawSeconds: 45, cycles: 1 } })).toBe(true);
  });

  it('rejects settings outside the allowed values', () => {
    expect(accepts(createRoomBodySchema, { settings: { drawSeconds: 30 } })).toBe(false);
    expect(accepts(createRoomBodySchema, { settings: { spicy: 'yes' } })).toBe(false);
    expect(accepts(partialSettingsSchema, { hints: true, cheat: true })).toBe(false);
  });
});

describe('inkOpSchema', () => {
  it('accepts every op kind', () => {
    for (const op of [
      ['b', 3, 0, 1, 412, 300],
      ['b', 1, 8, 2, 0, INK_GRID - 1],
      ['p', 3, 4, -1, 6, -2, 5, 0],
      ['e', 3],
      ['u'],
      ['c'],
    ]) {
      expect(accepts(inkOpSchema, op), JSON.stringify(op)).toBe(true);
    }
  });

  it('rejects bad ops', () => {
    for (const op of [
      ['x'],
      ['b', 0, 0, 1, 10, 10], // strokeId starts at 1
      ['b', 1, 9, 1, 10, 10], // colour past the eraser
      ['b', 1, 0, 3, 10, 10], // no size 3
      ['b', 1, 0, 1, INK_GRID, 10], // off the grid
      ['b', 1, 0, 1, 10.5, 10],
      ['b', 1, 0, 1, 10], // missing y
      ['p', 3], // no points
      ['p', 3, 4, -1, 6], // half a point
      ['p', 3, INK_GRID, 0],
      ['e'],
      ['u', 1],
      'c',
    ]) {
      expect(accepts(inkOpSchema, op), JSON.stringify(op)).toBe(false);
    }
  });

  it(`allows at most ${INK_POINTS_PER_OP_MAX} points in one "p" op`, () => {
    const points = (n: number) => ['p', 1, ...Array.from({ length: n * 2 }, () => 1)];
    expect(accepts(inkOpSchema, points(INK_POINTS_PER_OP_MAX))).toBe(true);
    expect(accepts(inkOpSchema, points(INK_POINTS_PER_OP_MAX + 1))).toBe(false);
  });
});

describe('inkPayloadSchemas', () => {
  const example = [
    7,
    118,
    [
      ['b', 3, 0, 1, 412, 300],
      ['p', 3, 4, -1, 6, -2, 5, 0],
      ['e', 3],
    ],
  ];

  const inkCases: { [E in InkClientEvent]: { valid: unknown[]; invalid: unknown[] } } = {
    'ink:batch': {
      // F16: `?debug=1` adds the drawer's send time in server time.
      valid: [example, [1, 1, [['u']]], [1, 1, [['u']], 1_800_000_000_123.5]],
      invalid: [
        [1, 1, [['u']], -1],
        [1, 1, [['u']], '1800000000000'],
        [1, 1, [['u']], 1, 2],
        [0, 1, [['u']]], // turnId starts at 1
        [1, 0, [['u']]], // seq starts at 1
        [1, 1, []],
        [1, 1, [['z']]],
        { turnId: 1, seq: 1, ops: [['u']] },
      ],
    },
    'ink:hello': { valid: [{ code: 'ABCD' }], invalid: [{}, { code: 'AB' }] },
    'ink:sync': {
      valid: [
        { turnId: 3, lastSentSeq: 0 },
        { turnId: 3, lastSentSeq: 41 },
      ],
      invalid: [{ turnId: 3 }, { turnId: 0, lastSentSeq: 1 }, { turnId: 3, lastSentSeq: -1 }],
    },
    'ink:get': { valid: [{ turnId: 2 }], invalid: [{}, { turnId: 'two' }] },
    'doodle:batch': {
      valid: [
        {
          ops: [
            ['b', 1, 2, 1, 10, 10],
            ['p', 1, 1, 1],
            ['e', 1],
          ],
        },
        { ops: [['c']] },
      ],
      invalid: [{}, { ops: [] }, { ops: [['b', 1]] }],
    },
  };

  it('has a schema for every /ink client event and a test case for every schema', () => {
    expect(Object.keys(inkPayloadSchemas).sort()).toEqual(Object.keys(inkCases).sort());
  });

  for (const [event, { valid, invalid }] of Object.entries(inkCases) as [
    InkClientEvent,
    (typeof inkCases)[InkClientEvent],
  ][]) {
    it(`${event} accepts valid payloads and rejects bad ones`, () => {
      const schema = inkPayloadSchemas[event];
      for (const v of valid) expect(accepts(schema, v), JSON.stringify(v)).toBe(true);
      for (const v of invalid) expect(accepts(schema, v), JSON.stringify(v)).toBe(false);
    });
  }

  /** A batch of `n` copies of a 7-point op, and its encoded size. */
  function batchOf(n: number) {
    const batch = [
      1,
      1,
      Array.from({ length: n }, () => ['p', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ];
    return { batch, bytes: JSON.stringify(batch).length };
  }

  it(`rejects a batch over ${INK_BATCH_MAX_BYTES} bytes`, () => {
    let n = 1;
    while (batchOf(n + 1).bytes <= INK_BATCH_MAX_BYTES) n++;
    expect(accepts(inkBatchSchema, batchOf(n).batch)).toBe(true);
    expect(accepts(inkBatchSchema, batchOf(n + 1).batch)).toBe(false);
  });

  it(`rejects a doodle batch over ${DOODLE_MAX_BYTES} bytes`, () => {
    const op = ['p', 1, ...Array.from({ length: INK_POINTS_PER_OP_MAX * 2 }, () => -9)];
    const ops = (n: number) => Array.from({ length: n }, () => op);
    let n = 1;
    while (JSON.stringify(ops(n + 1)).length <= DOODLE_MAX_BYTES) n++;
    expect(accepts(inkPayloadSchemas['doodle:batch'], { ops: ops(n) })).toBe(true);
    expect(accepts(inkPayloadSchemas['doodle:batch'], { ops: ops(n + 1) })).toBe(false);
  });
});

describe('inkAuthSchema', () => {
  it('accepts a phone with code and playerKey, and a Screen with nothing', () => {
    expect(accepts(inkAuthSchema, { code: 'ABCD', playerKey: 'k'.repeat(21) })).toBe(true);
    expect(accepts(inkAuthSchema, {})).toBe(true);
  });

  it('rejects a half-filled, malformed or padded handshake', () => {
    expect(accepts(inkAuthSchema, { code: 'ABCD' })).toBe(false);
    expect(accepts(inkAuthSchema, { playerKey: 'k'.repeat(21) })).toBe(false);
    expect(accepts(inkAuthSchema, { code: 'ABCD', playerKey: 'short' })).toBe(false);
    expect(accepts(inkAuthSchema, { code: 'ABCD', playerKey: 'k'.repeat(21), pid: 'p1' })).toBe(
      false,
    );
    expect(accepts(inkAuthSchema, { pid: 'p1' })).toBe(false);
    expect(accepts(inkAuthSchema, null)).toBe(false);
  });
});

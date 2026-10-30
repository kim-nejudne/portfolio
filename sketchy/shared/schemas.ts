// zod schemas for every HTTP body and client→server socket payload, on both namespaces. Limits
// come from constants.ts. Handlers parse with these before anything reaches the reducer.

import { z } from 'zod';
import {
  COPY_LANGUAGES,
  CUSTOM_WORD_MAX,
  CUSTOM_WORD_MIN,
  CUSTOM_WORDS_MAX,
  CYCLES_CHOICES,
  DIFFICULTY_CHOICES,
  DOODLE_MAX_BYTES,
  DRAW_COLORS,
  DRAW_SECONDS_CHOICES,
  ERASER_COLOR_INDEX,
  GUESS_FEED_CHOICES,
  GUESS_MAX,
  HOST_TOKEN_LENGTH,
  ID_MAX,
  INK_BATCH_MAX_BYTES,
  INK_GRID,
  INK_POINTS_PER_OP_MAX,
  INK_SIZES,
  PLAYER_KEY_LENGTH,
  PLAYER_NAME_MAX,
  PLAYER_NAME_MIN,
  REACTIONS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  WORDS_CHOICES,
} from './constants.js';
import type {
  ClientEvent,
  ClientPayloads,
  CreateRoomBody,
  InkAuth,
  InkBatch,
  InkClientEvent,
  InkClientPayloads,
  InkOp,
  RoomSettings,
} from './types.js';

// ---------- Building blocks ----------

/** Server-generated ids (pid): letters, digits, `_` and `-`. */
export const idSchema = z
  .string()
  .min(1)
  .max(ID_MAX)
  .regex(/^[\w-]+$/);

/** Accepts any case and surrounding spaces, as typed into the join form; outputs upper case. */
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`));

/** base64url of HOST_TOKEN_BYTES random bytes. */
export const hostTokenSchema = z.string().regex(new RegExp(`^[\\w-]{${HOST_TOKEN_LENGTH}}$`));

/** The device's private nanoid. Only its hash is stored. */
export const playerKeySchema = z.string().regex(new RegExp(`^[\\w-]{${PLAYER_KEY_LENGTH}}$`));

/** Trimmed, 1 to 16 characters, and no control or invisible format characters (zero-width space and the like). */
export const playerNameSchema = z
  .string()
  .trim()
  .min(PLAYER_NAME_MIN)
  .max(PLAYER_NAME_MAX)
  .regex(/^[^\p{Cc}\p{Cf}]+$/u, 'Name contains invisible characters');

/** Events without data. Unknown keys are stripped, not rejected: they carry nothing to misuse. */
const emptySchema = z.object({});

const positiveIntSchema = z.int().min(1);

// ---------- Settings ----------

export const roomSettingsSchema = z.object({
  drawSeconds: z.literal(DRAW_SECONDS_CHOICES),
  cycles: z.literal(CYCLES_CHOICES),
  hints: z.boolean(),
  difficulty: z.enum(DIFFICULTY_CHOICES),
  words: z.enum(WORDS_CHOICES),
  spicy: z.boolean(),
  guessFeed: z.enum(GUESS_FEED_CHOICES),
  copy: z.enum(COPY_LANGUAGES),
  autoAdvance: z.boolean(),
});

/** Strict, so a typo like `drawSecs` fails loudly instead of being dropped. */
export const partialSettingsSchema = z.strictObject(roomSettingsSchema.shape).partial();

// ---------- HTTP ----------

export const createRoomBodySchema = z.object({ settings: partialSettingsSchema.optional() });

// ---------- Ink ----------

const strokeIdSchema = positiveIntSchema;
const gridCoordSchema = z
  .int()
  .min(0)
  .max(INK_GRID - 1);
const deltaSchema = z
  .int()
  .min(-(INK_GRID - 1))
  .max(INK_GRID - 1);

export const inkOpSchema = z.union([
  z.tuple([
    z.literal('b'),
    strokeIdSchema,
    z.int().min(0).max(ERASER_COLOR_INDEX), // 0–7 palette, 8 eraser
    z
      .int()
      .min(0)
      .max(INK_SIZES.length - 1),
    gridCoordSchema,
    gridCoordSchema,
  ]),
  // At least one point, whole (dx, dy) pairs, at most INK_POINTS_PER_OP_MAX points.
  z.tuple([z.literal('p'), strokeIdSchema], deltaSchema).refine(
    (op) => {
      const deltas = op.length - 2;
      return deltas >= 2 && deltas % 2 === 0 && deltas / 2 <= INK_POINTS_PER_OP_MAX;
    },
    { message: `A "p" op needs 1 to ${INK_POINTS_PER_OP_MAX} whole points` },
  ),
  z.tuple([z.literal('e'), strokeIdSchema]),
  z.tuple([z.literal('u')]),
  z.tuple([z.literal('c')]),
]);

/** Batches hold only ASCII once valid, so the JSON string's length is its size in bytes. */
function encodedBytes(value: unknown): number {
  return JSON.stringify(value).length;
}

export const inkBatchSchema = z
  .tuple([
    positiveIntSchema,
    positiveIntSchema,
    z.array(inkOpSchema).min(1),
    // `?debug=1` only (F16): the drawer's send time in server time. Relayed, never trusted.
    z.number().min(0).optional(),
  ])
  .refine((batch) => encodedBytes(batch) <= INK_BATCH_MAX_BYTES, {
    message: `A batch is at most ${INK_BATCH_MAX_BYTES} bytes`,
  });

/** A phone's `{code, playerKey}`, or nothing for a Screen. Anything else refuses the connection. */
export const inkAuthSchema = z.union([
  z.strictObject({ code: roomCodeSchema, playerKey: playerKeySchema }),
  z.strictObject({}),
]) satisfies z.ZodType<InkAuth>;

export const inkPayloadSchemas = {
  'ink:batch': inkBatchSchema,
  'ink:hello': z.object({ code: roomCodeSchema }),
  'ink:sync': z.object({ turnId: positiveIntSchema, lastSentSeq: z.int().min(0) }),
  'ink:get': z.object({ turnId: positiveIntSchema }),
  // Sent on stroke end, undo and clear; the InkStore enforces the per-player total.
  'doodle:batch': z
    .object({ ops: z.array(inkOpSchema).min(1) })
    .refine((b) => encodedBytes(b.ops) <= DOODLE_MAX_BYTES, {
      message: `A doodle is at most ${DOODLE_MAX_BYTES} bytes`,
    }),
} satisfies { [E in InkClientEvent]: z.ZodType<InkClientPayloads[E]> };

// ---------- Client → server events (main namespace) ----------

export const clientPayloadSchemas = {
  'screen:join': z.object({ code: roomCodeSchema, hostToken: hostTokenSchema.optional() }),
  'player:join': z.object({
    code: roomCodeSchema,
    playerKey: playerKeySchema,
    name: playerNameSchema,
    takeOver: z.boolean().optional(),
    hidden: z.boolean().optional(), // the page is hidden as it joins (F40)
  }),
  ping: z.object({ t: z.number() }),
  'player:guess': z.object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(GUESS_MAX)
      .regex(/^[^\p{Cc}]+$/u, 'Guess contains control characters'),
  }),
  'player:react': z.object({ emoji: z.enum(REACTIONS) }),
  'player:visibility': z.object({ hidden: z.boolean() }),
  'player:rename': z.object({ name: playerNameSchema }),
  'player:leave': emptySchema,
  'drawer:choose': z.object({ index: z.literal([0, 1, 2]) }),
  'host:start': emptySchema,
  'host:pause': emptySchema,
  'host:resume': emptySchema,
  'host:skip': emptySchema,
  'host:next': emptySchema,
  'host:kick': z.object({ pid: idSchema }),
  'host:crown': z.object({ pid: idSchema }),
  'host:settings': partialSettingsSchema,
  // Duplicates (by normalised form) are removed by the reducer, which owns normalisation.
  // Blank entries (a trailing comma or newline) are dropped. Duplicates (by normalised form) are
  // removed by the reducer, which owns normalisation.
  'host:customWords': z.object({
    words: z
      .array(z.string().trim().max(CUSTOM_WORD_MAX))
      .max(CUSTOM_WORDS_MAX)
      .transform((words) => words.filter((w) => w.length >= CUSTOM_WORD_MIN)),
  }),
  'host:end': emptySchema,
  'host:rematch': emptySchema,
  'host:rematchCancel': emptySchema,
  'host:backToLobby': emptySchema,
  'debug:rtt': emptySchema,
} satisfies { [E in ClientEvent]: z.ZodType<ClientPayloads[E]> };

// ---------- Compile-time checks: schemas and types.ts agree both ways ----------

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type SchemaTypeChecks = [
  Assert<Equals<z.infer<typeof roomSettingsSchema>, RoomSettings>>,
  Assert<Equals<z.infer<typeof partialSettingsSchema>, Partial<RoomSettings>>>,
  Assert<Equals<z.infer<typeof createRoomBodySchema>, CreateRoomBody>>,
  Assert<Equals<z.infer<typeof inkOpSchema>, InkOp>>,
  Assert<Equals<z.infer<typeof inkBatchSchema>, InkBatch>>,
  // Every drawing colour and the eraser fit the op's colour range.
  Assert<Equals<(typeof DRAW_COLORS)['length'], typeof ERASER_COLOR_INDEX>>,
];

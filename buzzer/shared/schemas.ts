// zod schemas for every HTTP body and client→server socket payload. Limits come from constants.ts.

import { z } from 'zod';
import {
  ANSWER_MAX,
  ANSWER_SECONDS_CHOICES,
  HOST_NOTES_MAX,
  HOST_TOKEN_LENGTH,
  ID_MAX,
  MAX_QUESTIONS_PER_SET,
  PLAYER_NAME_MAX,
  PLAYER_NAME_MIN,
  POINTS_MAX,
  POINTS_MIN,
  QUESTION_TEXT_MAX,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SCORE_DELTA_MAX,
  SCOREBOARD_EVERY_MAX,
  SET_TITLE_MAX,
} from './constants.js';
import type {
  ClientEvent,
  ClientPayloads,
  CreateRoomBody,
  NewGameBody,
  Question,
  QuestionSet,
  RoomSettings,
} from './types.js';

// ---------- Building blocks ----------

/** nanoid-style id: letters, digits, `_` and `-`. */
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

/** Trimmed, 1 to 16 characters, and no control or invisible format characters (zero-width space and the like). */
export const playerNameSchema = z
  .string()
  .trim()
  .min(PLAYER_NAME_MIN)
  .max(PLAYER_NAME_MAX)
  .regex(/^[^\p{Cc}\p{Cf}]+$/u, 'Name contains invisible characters');

export const pointsSchema = z.int().min(POINTS_MIN).max(POINTS_MAX);

/** Events without data. Unknown keys are stripped, not rejected: they carry nothing to misuse. */
const emptySchema = z.object({});

// ---------- Question sets ----------

export const questionSchema = z
  .object({
    id: idSchema,
    text: z.string().trim().max(QUESTION_TEXT_MAX),
    imageId: idSchema.optional(),
    answer: z.string().trim().min(1).max(ANSWER_MAX),
    hostNotes: z.string().trim().max(HOST_NOTES_MAX).optional(),
    points: pointsSchema,
  })
  .refine((q) => q.text.length > 0 || q.imageId !== undefined, {
    message: 'A question needs text or an image',
    path: ['text'],
  });

/** A playable set: what room creation and import accept. Editor drafts may be incomplete. */
export const questionSetSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(SET_TITLE_MAX),
  questions: z
    .array(questionSchema)
    .min(1)
    .max(MAX_QUESTIONS_PER_SET)
    .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, {
      message: 'Question ids must be unique',
    }),
  createdAt: z.int().nonnegative(),
  updatedAt: z.int().nonnegative(),
  schemaVersion: z.literal(1),
});

export const roomSettingsSchema = z.object({
  wrongPenalty: z.boolean(),
  autoOpenBuzzers: z.boolean(),
  scoreboardEvery: z.int().min(0).max(SCOREBOARD_EVERY_MAX),
  answerSeconds: z.literal(ANSWER_SECONDS_CHOICES),
});

export const createRoomBodySchema = z.object({
  set: questionSetSchema,
  settings: roomSettingsSchema,
});

/** `PUT /api/rooms/:code/set`: a new game in the same room, after FINAL. */
export const newGameBodySchema = z.object({
  set: questionSetSchema,
  keepScores: z.boolean(),
});

// ---------- Client → server events ----------

export const clientPayloadSchemas = {
  'screen:join': z.object({ code: roomCodeSchema, hostToken: hostTokenSchema.optional() }),
  'host:join': z.object({ code: roomCodeSchema, hostToken: hostTokenSchema }),
  'player:join': z.object({ code: roomCodeSchema, playerId: idSchema, name: playerNameSchema }),
  ping: z.object({ t: z.number() }),
  'player:buzz': emptySchema,
  'host:start': emptySchema,
  'host:open': emptySchema,
  'host:judge': z.object({ result: z.enum(['correct', 'wrong']) }),
  'host:reveal': emptySchema,
  'host:next': emptySchema,
  'host:prev': emptySchema,
  'host:scoreboard': z.object({ show: z.boolean() }),
  'host:undo': emptySchema,
  'host:adjustScore': z.object({
    playerId: idSchema,
    delta: z.int().min(-SCORE_DELTA_MAX).max(SCORE_DELTA_MAX),
  }),
  'host:kick': z.object({ playerId: idSchema }),
  // Strict, so a typo like `wrongPenality` fails loudly instead of being dropped.
  'host:settings': z.strictObject(roomSettingsSchema.shape).partial(),
  'host:end': emptySchema,
} satisfies { [E in ClientEvent]: z.ZodType<ClientPayloads[E]> };

// ---------- Compile-time checks: schemas and types.ts agree both ways ----------

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type SchemaTypeChecks = [
  Assert<Equals<z.infer<typeof questionSchema>, Question>>,
  Assert<Equals<z.infer<typeof questionSetSchema>, QuestionSet>>,
  Assert<Equals<z.infer<typeof roomSettingsSchema>, RoomSettings>>,
  Assert<Equals<z.infer<typeof createRoomBodySchema>, CreateRoomBody>>,
  Assert<Equals<z.infer<typeof newGameBodySchema>, NewGameBody>>,
];

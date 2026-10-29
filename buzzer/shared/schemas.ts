// zod schemas for every HTTP body and client→server socket payload. Limits come from constants.ts.

import { z } from 'zod';
import {
  ANSWER_MAX,
  ANSWER_SECONDS_CHOICES,
  AVATARS,
  BUZZ_SECONDS_CHOICES,
  CHOICE_SECONDS_MAX,
  CHOICE_SECONDS_MIN,
  CHOICE_TEXT_MAX,
  CHOICES_MAX,
  CHOICES_MIN,
  FALSE_START_MS_CHOICES,
  DIFFICULTIES,
  HOST_NOTES_MAX,
  HOST_TOKEN_LENGTH,
  ID_MAX,
  MAX_PLAYERS_PER_ROOM,
  MAX_QUESTIONS_PER_SET,
  PAIRING_PIN_LENGTH,
  PLAYER_NAME_MAX,
  PLAYER_NAME_MIN,
  POINTS_MAX,
  POINTS_MIN,
  QUESTION_MODES,
  QUESTION_TEXT_MAX,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SCORE_DELTA_MAX,
  SCOREBOARD_EVERY_MAX,
  SET_CATEGORY_MAX,
  SET_TITLE_MAX,
  TEAM_COUNT_CHOICES,
  TEAMS,
  TYPED_ANSWER_MAX,
} from './constants.js';
import type {
  ClientEvent,
  ClientPayloads,
  CreateRoomBody,
  NewGameBody,
  PairBody,
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

/**
 * A choice question needs 2–4 choices and the index of the correct one; its `answer` is set to that
 * choice's text, so a file may leave it blank. Other questions need an answer, and any choices left
 * over from the editor (a question switched back from Choice) are dropped.
 */
export const questionSchema = z
  .object({
    id: idSchema,
    text: z.string().trim().max(QUESTION_TEXT_MAX),
    imageId: idSchema.optional(),
    answer: z.string().trim().max(ANSWER_MAX),
    hostNotes: z.string().trim().max(HOST_NOTES_MAX).optional(),
    points: pointsSchema,
    mode: z.enum(QUESTION_MODES).optional(),
    choices: z
      .array(z.string().trim().min(1).max(CHOICE_TEXT_MAX))
      .min(CHOICES_MIN)
      .max(CHOICES_MAX)
      .optional(),
    correctChoice: z
      .int()
      .min(0)
      .max(CHOICES_MAX - 1)
      .optional(),
  })
  .superRefine((q, ctx) => {
    if (q.text.length === 0 && q.imageId === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'A question needs text or an image',
        path: ['text'],
      });
    }
    if (q.mode !== 'choice') {
      if (q.answer.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The answer is required', path: ['answer'] });
      }
      return;
    }
    if (q.choices === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `A choice question needs ${CHOICES_MIN} to ${CHOICES_MAX} choices`,
        path: ['choices'],
      });
    }
    if (q.correctChoice === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'A choice question needs a correct choice',
        path: ['correctChoice'],
      });
    } else if (
      q.choices !== undefined &&
      // An index past the last possible choice already failed `max`; zod 4 still runs this check.
      q.correctChoice < CHOICES_MAX &&
      q.correctChoice >= q.choices.length
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `The correct choice must be one of the ${q.choices.length} choices`,
        path: ['correctChoice'],
      });
    }
  })
  .transform((q): Question => {
    if (q.mode === 'choice') return { ...q, answer: q.choices![q.correctChoice!]! };
    const rest = { ...q };
    delete rest.choices;
    delete rest.correctChoice;
    return rest;
  });

/** A playable set: what room creation and import accept. Editor drafts may be incomplete. */
export const questionSetSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(SET_TITLE_MAX),
  // Optional, so files from before F53 still import; schemaVersion stays 1 (DECISIONS F53).
  category: z.string().trim().min(1).max(SET_CATEGORY_MAX).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
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
  buzzSeconds: z.literal(BUZZ_SECONDS_CHOICES),
  falseStartMs: z.literal(FALSE_START_MS_CHOICES),
  showStandings: z.boolean(),
  teams: z.literal(TEAM_COUNT_CHOICES),
  choiceSeconds: z.int().min(CHOICE_SECONDS_MIN).max(CHOICE_SECONDS_MAX),
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

/** `POST /api/rooms/:code/pair`: the digits of a pairing PIN, nothing else (F70). */
export const pairBodySchema = z.object({
  pin: z.string().regex(new RegExp(`^\\d{${PAIRING_PIN_LENGTH}}$`)),
});

// ---------- Client → server events ----------

export const clientPayloadSchemas = {
  'screen:join': z.object({ code: roomCodeSchema, hostToken: hostTokenSchema.optional() }),
  'host:join': z.object({ code: roomCodeSchema, hostToken: hostTokenSchema }),
  'player:join': z.object({
    code: roomCodeSchema,
    playerId: idSchema,
    name: playerNameSchema,
    avatar: z.enum(AVATARS).optional(),
  }),
  ping: z.object({ t: z.number() }),
  'player:buzz': emptySchema,
  'player:practice': emptySchema,
  'player:rename': z.object({ name: playerNameSchema }),
  'player:leave': emptySchema,
  // A choice for a choice question, text for a typed one; the reducer checks which applies.
  'player:answer': z.union([
    z.object({
      choice: z
        .int()
        .min(0)
        .max(CHOICES_MAX - 1),
    }),
    z.object({ text: z.string().trim().min(1).max(TYPED_ANSWER_MAX) }),
  ]),
  'host:start': emptySchema,
  'host:open': emptySchema,
  'host:judge': z.object({ result: z.enum(['correct', 'half', 'wrong']) }),
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
  // The reducer checks the team against the room's `settings.teams`.
  // Group keys as the host view gives them; the reducer normalises them again.
  'host:markTyped': z.object({
    groups: z.array(z.string().max(TYPED_ANSWER_MAX)).max(MAX_PLAYERS_PER_ROOM),
  }),
  'host:setTeam': z.object({
    playerId: idSchema,
    team: z
      .int()
      .min(0)
      .max(TEAMS.length - 1),
  }),
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
  Assert<Equals<z.infer<typeof pairBodySchema>, PairBody>>,
];

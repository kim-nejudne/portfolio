// zod schemas for every socket payload, HTTP body and stored file (spec: Realtime events and HTTP
// API; Data model). The server parses every incoming payload with these; nothing is trusted raw.
// Unknown keys are stripped, not rejected: they carry nothing to misuse.

import { z } from 'zod';
import {
  ADMIN_PASSWORD_MAX,
  CATEGORY_EMOJI_MAX,
  CATEGORY_NAME_MAX,
  DIFFICULTIES,
  DIFFICULTY_CHOICES,
  DISPLAY_NAME_MAX,
  EMOJI,
  FACT_MAX,
  GUIDANCE_MAX,
  HISTORY_LIMIT_MAX,
  HISTORY_TEXT_MAX,
  ID_MAX,
  LEVEL_COUNT_MAX,
  LEVEL_COUNT_MIN,
  MAX_LAT,
  MODES,
  NAME_MAX,
  NAME_MIN,
  NOTE_MAX,
  PHOTO_AUTHOR_MAX,
  PHOTO_CANDIDATES_MAX,
  PLACE_NAME_MAX,
  PLAYER_KEY_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROUND_OPTIONS,
  TIMER_OPTIONS,
  WIKIDATA_QUERY_MAX,
} from './constants.js';
import { normalizeLng } from './geo.js';
import type { Ack, CategoriesFile, GameSettings, GenerationHistoryEntry } from './types.js';

// ---- Building blocks ----

export { normalizeLng }; // lives in geo.ts so the client's map code needs no zod

export const latSchema = z.number().min(-MAX_LAT).max(MAX_LAT);
/** zod 4's `number()` already refuses NaN and ±Infinity. */
export const lngSchema = z.number().transform(normalizeLng);

/** A guess: `lat` in [−85.0511, 85.0511], `lng` finite and normalised to [−180, 180). */
export const latLngSchema = z.object({ lat: latSchema, lng: lngSchema });

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

export const playerKeySchema = z.string().regex(new RegExp(`^[\\w-]{${PLAYER_KEY_LENGTH}}$`));

/** Trimmed, 1 to 16 characters, and no control or invisible format characters. */
export const playerNameSchema = z
  .string()
  .trim()
  .min(NAME_MIN)
  .max(NAME_MAX)
  .regex(/^[^\p{Cc}\p{Cf}]+$/u, 'Name contains invisible characters');

export const playerEmojiSchema = z.enum(EMOJI);

export const difficultySchema = z.enum(DIFFICULTIES);
export const modeSchema = z.enum(MODES);
export const labelStyleSchema = z.enum(['city', 'cityCountry']);
export const placeKindSchema = z.enum(['city', 'landmark']);

export const gameSettingsSchema = z.object({
  categoryId: idSchema,
  mode: modeSchema,
  difficulty: z.enum(DIFFICULTY_CHOICES),
  rounds: z.literal(ROUND_OPTIONS),
  timerSeconds: z.literal(TIMER_OPTIONS),
}) satisfies z.ZodType<GameSettings>;

const emptySchema = z.object({});

// ---- Client to server ----

export const screenJoinSchema = z.object({ code: roomCodeSchema });
export const playerJoinSchema = z.object({
  code: roomCodeSchema,
  playerKey: playerKeySchema,
  name: playerNameSchema,
  emoji: playerEmojiSchema,
});
export const playerRenameSchema = z.object({
  name: playerNameSchema,
  emoji: playerEmojiSchema.optional(),
});
export const vipKickSchema = z.object({ playerId: idSchema });
export const vipRoundSettingsSchema = gameSettingsSchema
  .pick({ timerSeconds: true, rounds: true })
  .partial();

/** One schema per client event; the gateway parses each payload with its event's schema. */
export const clientEventSchemas = {
  'screen:join': screenJoinSchema,
  'player:join': playerJoinSchema,
  'player:rename': playerRenameSchema,
  'player:leave': emptySchema,
  'player:practice': latLngSchema,
  'player:aim': latLngSchema,
  'player:lockIn': latLngSchema,
  'vip:settings': gameSettingsSchema.partial(),
  'vip:start': emptySchema,
  'vip:next': emptySchema,
  'vip:pause': emptySchema,
  'vip:resume': emptySchema,
  'vip:skipRound': emptySchema,
  'vip:kick': vipKickSchema,
  'vip:roundSettings': vipRoundSettingsSchema,
  'vip:end': emptySchema,
  'vip:rematch': emptySchema,
  'vip:rematchCancel': emptySchema,
  'vip:backToLobby': emptySchema,
} as const;

export type ClientEvent = keyof typeof clientEventSchemas;
export type ClientPayload<E extends ClientEvent> = z.output<(typeof clientEventSchemas)[E]>;

/** Socket.IO's typing of the client events: each sends its schema's input and gets an `Ack`. */
export type ClientToServerEvents = {
  [E in ClientEvent]: (
    payload: z.input<(typeof clientEventSchemas)[E]>,
    ack: (res: Ack) => void,
  ) => void;
};

// ---- Stored categories ----

/** `east` may exceed 180 to cross the antimeridian; `east − west` is in (0, 360]. */
export const boxSchema = z
  .object({
    south: latSchema,
    west: z.number().min(-180).max(180),
    north: latSchema,
    east: z.number().max(540),
  })
  .refine((b) => b.south < b.north, { message: 'South must be below north' })
  .refine((b) => b.east > b.west && b.east - b.west <= 360, {
    message: 'East must be east of west, at most 360° away',
  });

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const EMOJI_PATTERN = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[#*0-9]️?⃣)/u;

/** A category's emoji: exactly one grapheme that is an emoji or emoji sequence (as in Buzzr). */
export const categoryEmojiSchema = z
  .string()
  .trim()
  .refine(
    // `.length` itself: zod's `max` counts code points, and the limit is in UTF-16 units.
    (s) =>
      s.length >= 1 &&
      s.length <= CATEGORY_EMOJI_MAX &&
      [...graphemes.segment(s)].length === 1 &&
      EMOJI_PATTERN.test(s),
    { message: 'Must be a single emoji' },
  );

export const wikidataIdSchema = z.string().regex(/^Q\d{1,12}$/);
const commonsFileSchema = z.string().min(6).max(300).startsWith('File:');
const urlSchema = z.url({ protocol: /^https$/ }).max(2000);
const timestampSchema = z.int().nonnegative();

export const photoSchema = z.object({
  id: idSchema,
  width: z.int().positive(),
  height: z.int().positive(),
  author: z.string().max(PHOTO_AUTHOR_MAX),
  licence: z.string().min(1).max(60),
  licenceUrl: urlSchema,
  commonsFile: commonsFileSchema,
  sourceUrl: urlSchema,
  commonsThumbUrl: urlSchema.optional(),
  signCheck: z.enum(['passed', 'flagged']).optional(),
});

export const photoCandidateSchema = z.object({
  commonsFile: commonsFileSchema,
  thumbUrl: urlSchema,
  author: z.string().max(PHOTO_AUTHOR_MAX),
  licence: z.string().min(1).max(60),
  licenceUrl: urlSchema,
  width: z.int().positive(),
  height: z.int().positive(),
  namesPlace: z.literal(true).optional(),
});

const placeNameSchema = z.string().trim().min(1).max(PLACE_NAME_MAX);
const displayNameSchema = z.string().trim().min(1).max(DISPLAY_NAME_MAX);
const factSchema = z.string().trim().min(1).max(FACT_MAX);

export const placeSchema = z.object({
  id: idSchema,
  kind: placeKindSchema,
  name: placeNameSchema,
  displayName: displayNameSchema,
  autoDisplayName: z.boolean(),
  fact: factSchema,
  lat: latSchema,
  lng: z.number().min(-180).max(180),
  coordsSource: z.enum(['wikidata', 'admin']),
  wikidataId: wikidataIdSchema,
  countryId: wikidataIdSchema,
  countryName: z.string().min(1).max(60),
  photo: photoSchema.optional(),
  photoCandidates: z.array(photoCandidateSchema).max(PHOTO_CANDIDATES_MAX).optional(),
});

const levelContentSchema = z.object({
  places: z.array(placeSchema),
  reviewed: z.boolean(),
  short: z.object({ city: z.int().optional(), landmark: z.int().optional() }).optional(),
  updatedAt: timestampSchema,
});

const levelsSchema = z.partialRecord(difficultySchema, levelContentSchema);
const categoryNameSchema = z.string().trim().min(1).max(CATEGORY_NAME_MAX);

export const categorySchema = z.object({
  id: idSchema,
  name: categoryNameSchema,
  emoji: categoryEmojiSchema.nullable(),
  box: boxSchema,
  labelStyle: labelStyleSchema,
  draftMeta: z.object({ box: boxSchema, labelStyle: labelStyleSchema }).nullable(),
  hidden: z.boolean(),
  live: levelsSchema,
  draft: levelsSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/** `DATA_DIR/categories.json`. */
export const categoriesFileSchema = z.object({
  schemaVersion: z.literal(1),
  categories: z.array(categorySchema),
}) satisfies z.ZodType<CategoriesFile, unknown>;

// ---- HTTP bodies and parameters ----

/** A line of `DATA_DIR/generation-history.jsonl`, checked when read back. */
export const generationHistoryEntrySchema = z.object({
  startedAt: z.number().int().nonnegative(),
  endedAt: z.number().int().nonnegative(),
  kind: z.enum(['generate', 'regenerate', 'replace', 'add']),
  categoryId: idSchema,
  category: z.string().max(CATEGORY_NAME_MAX),
  levels: z.array(difficultySchema).max(DIFFICULTIES.length),
  saved: z.object({
    city: z.number().int().nonnegative(),
    landmark: z.number().int().nonnegative(),
  }),
  dropped: z.array(
    z.object({ reason: z.string().max(HISTORY_TEXT_MAX), count: z.number().int().positive() }),
  ),
  costUsd: z.number().nonnegative().finite(),
  outcome: z.enum(['done', 'failed', 'cancelled']),
  error: z.string().max(HISTORY_TEXT_MAX).optional(),
}) satisfies z.ZodType<GenerationHistoryEntry>;

/** `GET /api/admin/history?limit=`: 0 answers the totals alone (the dashboard's spend). */
export const historyQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d{1,9}$/)
    .transform(Number)
    .pipe(z.int().min(0).max(HISTORY_LIMIT_MAX))
    .default(HISTORY_LIMIT_MAX),
});

export const roomCodeParamSchema = z.object({ code: roomCodeSchema });
export const levelParamSchema = z.object({ id: idSchema, level: difficultySchema });
export const placeParamSchema = levelParamSchema.extend({ placeId: idSchema });

export const adminLoginBodySchema = z.object({
  password: z.string().min(1).max(ADMIN_PASSWORD_MAX),
});

const levelCountSchema = z.int().min(LEVEL_COUNT_MIN).max(LEVEL_COUNT_MAX);
const guidanceSchema = z.string().trim().max(GUIDANCE_MAX);
const noteSchema = z.string().trim().max(NOTE_MAX);

/** `POST /api/admin/categories/generate`: at least one level. */
export const generateBodySchema = z.object({
  name: categoryNameSchema,
  guidance: guidanceSchema,
  levels: z
    .partialRecord(difficultySchema, z.object({ count: levelCountSchema }))
    .refine((l) => Object.keys(l).length > 0, { message: 'Pick at least one level' }),
});

/** `POST /api/admin/categories/:id/generate`: more levels for an existing category. */
export const generateMoreBodySchema = generateBodySchema.omit({ name: true });

export const regenerateBodySchema = z.object({
  guidance: guidanceSchema.optional(),
  count: levelCountSchema,
});

export const categoryMetaBodySchema = z.object({
  box: boxSchema.optional(),
  labelStyle: labelStyleSchema.optional(),
});

/**
 * `PUT …/places/:placeId`. `photoCandidate` names one of the place's stored candidates by its
 * Commons file (DECISIONS 9); `lat` and `lng` come together.
 */
export const placeEditBodySchema = z
  .object({
    name: placeNameSchema.optional(),
    displayName: displayNameSchema.optional(),
    fact: factSchema.optional(),
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    photoCandidate: commonsFileSchema.optional(),
  })
  .refine((b) => (b.lat === undefined) === (b.lng === undefined), {
    message: 'Send lat and lng together',
  });

export const placeReplaceBodySchema = z.object({ note: noteSchema.optional() });
export const placeAddBodySchema = z.object({
  kind: placeKindSchema,
  note: noteSchema.optional(),
});
export const placeAddByIdBodySchema = z.object({
  kind: placeKindSchema,
  wikidataId: wikidataIdSchema,
  fact: factSchema,
});
export const wikidataSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(WIKIDATA_QUERY_MAX),
  categoryId: idSchema,
});
export const reviewedBodySchema = z.object({ reviewed: z.boolean() });
export const hiddenBodySchema = z.object({ hidden: z.boolean() });
export const categoryEmojiBodySchema = z.object({ emoji: categoryEmojiSchema.nullable() });
export const jobsQuerySchema = z.object({ categoryId: idSchema.optional() });

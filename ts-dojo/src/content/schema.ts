// The Zod schemas for the §3 content files: roadmap.yaml, module.yaml, exercise.yaml,
// renames.yaml and the lesson.mdx frontmatter (§1), plus the props of an inline `<Predict>`.
// They check shape and types; the counts §3's lint owns (hints, options, exercises per
// lesson, lessons per module) stay out of the schemas so the lint can report them as its own
// conditions. The loader (src/content/build-registry.ts) applies these at build time, in Node
// and in the browser over the same data.
import { z } from 'zod';
import { RULE_IDS } from '@/verify/rules';

/** `m03-unions`, `m03-unions/03-narrowing`, `m03-unions/03-narrowing/01-first-union`. */
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const segment = z
  .string()
  .regex(SEGMENT, 'a lowercase slug such as m03-unions');
const moduleId = segment;
const lessonId = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'a lesson id such as m03-unions/03-narrowing',
  );
const exerciseId = z
  .string()
  .regex(
    /^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/){2}[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'an exercise id such as m03-unions/03-narrowing/01-first-union',
  );
const minutes = z.number().int().positive();

export const roadmapSchema = z.object({
  tiers: z
    .array(
      z.object({
        id: segment,
        title: z.string().min(1),
        modules: z.array(moduleId),
      }),
    )
    .min(1),
});
export type RoadmapYaml = z.infer<typeof roadmapSchema>;

export const moduleSchema = z.object({
  id: moduleId,
  title: z.string().min(1),
  summary: z.string().min(1),
  prerequisites: z.array(moduleId).default([]),
  /** Folder names, in order. */
  lessons: z.array(segment),
});
export type ModuleYaml = z.infer<typeof moduleSchema>;

export const lessonFrontmatterSchema = z.object({
  id: lessonId,
  title: z.string().min(1),
  minutes,
  objectives: z.array(z.string().min(1)).min(2).max(5),
  prerequisites: z.array(lessonId).default([]),
  tags: z.array(z.string().min(1)).default([]),
  ts7: z.string().min(1).optional(),
});
export type LessonFrontmatter = z.infer<typeof lessonFrontmatterSchema>;

export const EDITOR_KINDS = ['fix', 'implement', 'type-challenge'] as const;
export type EditorKind = (typeof EDITOR_KINDS)[number];
export type ExerciseKind = EditorKind | 'predict';

/** tsconfig-shaped values, as exercise.yaml writes them (§3). */
const compilerOptionsJson = z.record(
  z.string(),
  z.union([z.boolean(), z.number(), z.string(), z.array(z.string())]),
);

const exerciseBase = {
  title: z.string().min(1),
  minutes,
  challenge: z.boolean().default(false),
};

export const editorExerciseSchema = z.object({
  id: exerciseId,
  kind: z.enum(EDITOR_KINDS),
  ...exerciseBase,
  prompt: z.string().min(1),
  entry: z
    .string()
    .regex(/^[A-Za-z0-9._-]+\.ts$/)
    .default('index.ts'),
  tests: z
    .string()
    .regex(/^[A-Za-z0-9._-]+\.ts$/)
    .optional(),
  compilerOptions: compilerOptionsJson.default({}),
  libs: z.array(z.string().min(1)).default([]),
  forbid: z.array(z.enum(RULE_IDS)).default([]),
  // Optional (F10): when omitted, the run's deadline is the Settings default timeout (§7
  // `defaultTimeoutMs`), else 5 s; `timeoutFor` in src/store/settings.ts.
  timeoutMs: z.number().int().positive().optional(),
  hints: z.array(z.string().min(1)).default([]),
});
export type EditorExerciseYaml = z.infer<typeof editorExerciseSchema>;

const predictFields = {
  code: z.string().optional(),
  question: z.string().min(1),
  options: z.array(z.string().min(1)),
  answer: z.number().int().nonnegative(),
  explanation: z.string().min(1),
};

export const predictExerciseSchema = z.object({
  id: exerciseId,
  kind: z.literal('predict'),
  ...exerciseBase,
  ...predictFields,
});
export type PredictExerciseYaml = z.infer<typeof predictExerciseSchema>;

export const exerciseSchema = z.discriminatedUnion('kind', [
  editorExerciseSchema,
  predictExerciseSchema,
]);
export type ExerciseYaml = z.infer<typeof exerciseSchema>;

/** The props of an inline `<Predict>` (§3): the predict exercise fields with an id unique in the lesson. */
export const predictPropsSchema = z.object({
  id: z.string().min(1),
  ...predictFields,
});
export type PredictProps = z.infer<typeof predictPropsSchema>;

/** The two kinds of id a rename may name (§7 "lesson and exercise ids are stable"). */
export function contentIdKind(id: string): 'lesson' | 'exercise' {
  return id.split('/').length === 2 ? 'lesson' : 'exercise';
}

/**
 * renames.yaml (§3, §7): `old: new`, one pair per line, lesson ids or exercise ids, each pair
 * of one kind; an empty file is no renames. The output is the mapping itself, so the plugin's
 * JSON module parses again unchanged; the registry reads it as a list in file order.
 */
export const renamesSchema = z
  .record(z.union([lessonId, exerciseId]), z.union([lessonId, exerciseId]))
  .nullable()
  .transform((map) => map ?? {})
  .superRefine((map, context) => {
    for (const [from, to] of Object.entries(map)) {
      if (contentIdKind(from) !== contentIdKind(to)) {
        context.addIssue({
          code: 'custom',
          path: [from],
          message: `renames a ${contentIdKind(from)} to a ${contentIdKind(to)} id`,
        });
      }
    }
  });
export type RenamesYaml = z.infer<typeof renamesSchema>;

/** One line per issue: `tiers[0].modules: expected array, received string`. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const where = issue.path.map(String).join('.');
      return where === '' ? issue.message : `${where}: ${issue.message}`;
    })
    .join('; ');
}

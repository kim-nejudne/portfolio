// One level of a generated category (F109): a writer drafts the questions, a fact checker passes,
// fixes or drops each one, and dropped questions are replaced for at most GENERATE_EXTRA_ROUNDS
// more rounds. The models sit behind two interfaces, so this file is pure orchestration and the
// tests drive it with fakes. Every model output is parsed here with zod; anything malformed counts
// as a drop rather than failing the level.

import { z } from 'zod';
import {
  ANSWER_MAX,
  GENERATE_EXTRA_ROUNDS,
  GENERATE_SEARCHES_MAX,
  HOST_NOTES_MAX,
  QUESTION_TEXT_MAX,
} from '../../shared/constants.js';
import type { Difficulty } from '../../shared/types.js';
import { type Usage, addUsage, emptyUsage } from './pricing.js';

export interface LevelRequest {
  /** The category's name, such as "Rivers". */
  category: string;
  /** The admin's optional guidance; '' when none. */
  guidance: string;
  difficulty: Difficulty;
  /** Questions wanted. */
  count: number;
  /** Question texts already in the category, never to be repeated. */
  avoid: readonly string[];
}

/** One writing round: `count` is what this round still needs, `avoid` grows with each round. */
export type WriteRequest = LevelRequest;

export interface QuestionWriter {
  /** Raw items, parsed by the generator. Throws a GenerationError on a refusal or API error. */
  write(request: WriteRequest): Promise<{ questions: unknown[]; usage: Usage }>;
}

/** A question as the checker sees it, with an id to answer by. */
export interface CheckItem {
  id: string;
  text: string;
  answer: string;
  hostNotes?: string;
}

export interface FactChecker {
  /** Raw verdicts, parsed by the generator. Throws a GenerationError on a refusal or API error. */
  check(
    items: CheckItem[],
    options: { maxSearches: number },
  ): Promise<{ verdicts: unknown[]; usage: Usage }>;
}

export interface GeneratedQuestion {
  text: string;
  answer: string;
  hostNotes?: string;
}

/** Where a level is: the first round's writing and checking, then any top-up rounds (F110). */
export type LevelStage = 'writing' | 'checking' | 'topping up';

export interface LevelResult {
  questions: GeneratedQuestion[];
  /** Fewer questions than asked for, after every round. */
  short: boolean;
  usage: Usage;
}

/**
 * A failed level, with a message fit to show the admin and the usage spent before it failed.
 * Show or log only `message`: `cause` may hold the SDK's error and the API's own text.
 */
export class GenerationError extends Error {
  override name = 'GenerationError';
  readonly usage: Usage;

  constructor(message: string, usage: Usage = emptyUsage(), options?: ErrorOptions) {
    super(message, options);
    this.usage = usage;
  }
}

/**
 * The admin cancelled the job (F113): thrown before the next API call once `signal` is aborted,
 * with the usage spent so far.
 */
export class GenerationCancelled extends GenerationError {
  override name = 'GenerationCancelled';

  constructor(usage: Usage = emptyUsage()) {
    super('Cancelled.', usage);
  }
}

/** A written question, held to the same limits as a set's questions (`shared/schemas.ts`). */
export const generatedQuestionSchema = z
  .object({
    text: z.string().trim().min(1).max(QUESTION_TEXT_MAX),
    answer: z.string().trim().min(1).max(ANSWER_MAX),
    hostNotes: z.string().trim().max(HOST_NOTES_MAX).nullish(),
  })
  .transform(({ text, answer, hostNotes }): GeneratedQuestion =>
    hostNotes ? { text, answer, hostNotes } : { text, answer },
  );

export const verdictSchema = z.object({
  id: z.string(),
  verdict: z.enum(['ok', 'fix', 'drop']),
  answer: z.string().nullish(),
  hostNotes: z.string().nullish(),
  reason: z.string(),
});
type Verdict = z.infer<typeof verdictSchema>;

/** Case, accents, punctuation and spacing don't make a question new. */
function sameQuestionKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function verdictsById(raw: unknown[]): Map<string, Verdict> {
  const byId = new Map<string, Verdict>();
  for (const item of raw) {
    const parsed = verdictSchema.safeParse(item);
    if (parsed.success && !byId.has(parsed.data.id)) byId.set(parsed.data.id, parsed.data);
  }
  return byId;
}

/** The question after its verdict, or null when it is dropped (or its fix is malformed). */
function judged(item: CheckItem, verdict: Verdict | undefined): GeneratedQuestion | null {
  if (verdict === undefined || verdict.verdict === 'drop') return null;
  const fixed =
    verdict.verdict === 'fix'
      ? {
          text: item.text,
          answer: verdict.answer ?? item.answer,
          hostNotes: verdict.hostNotes ?? item.hostNotes,
        }
      : item;
  const parsed = generatedQuestionSchema.safeParse(fixed);
  return parsed.success ? parsed.data : null;
}

export async function generateLevel(
  request: LevelRequest,
  deps: {
    writer: QuestionWriter;
    checker: FactChecker;
    /** Told as each stage starts, for a job's progress. */
    onStage?: (stage: LevelStage) => void;
    /** Aborted by a cancel: the level stops before its next API call (F113). */
    signal?: AbortSignal;
  },
): Promise<LevelResult> {
  if (!Number.isInteger(request.count) || request.count < 1) {
    throw new RangeError(`count must be a whole number of at least 1, got ${request.count}`);
  }
  const accepted: GeneratedQuestion[] = [];
  const written: string[] = [];
  const seen = new Set(request.avoid.map(sameQuestionKey));
  let usage = emptyUsage();
  let nextId = 1;
  const stopIfCancelled = () => {
    if (deps.signal?.aborted) throw new GenerationCancelled(usage);
  };

  try {
    for (let round = 0; round <= GENERATE_EXTRA_ROUNDS; round++) {
      const need = request.count - accepted.length;
      if (need <= 0) break;

      stopIfCancelled();
      deps.onStage?.(round === 0 ? 'writing' : 'topping up');
      const draft = await deps.writer.write({
        ...request,
        count: need,
        avoid: [...request.avoid, ...written],
      });
      usage = addUsage(usage, draft.usage);

      const items: CheckItem[] = [];
      for (const raw of draft.questions) {
        if (items.length === need) break;
        const parsed = generatedQuestionSchema.safeParse(raw);
        if (!parsed.success) continue;
        const key = sameQuestionKey(parsed.data.text);
        if (seen.has(key)) continue;
        seen.add(key);
        written.push(parsed.data.text);
        items.push({ id: `q${nextId++}`, ...parsed.data });
      }
      if (items.length === 0) continue;

      stopIfCancelled();
      if (round === 0) deps.onStage?.('checking');
      const checked = await deps.checker.check(items, {
        maxSearches: Math.max(0, GENERATE_SEARCHES_MAX - usage.searches),
      });
      usage = addUsage(usage, checked.usage);
      const verdicts = verdictsById(checked.verdicts);
      for (const item of items) {
        const question = judged(item, verdicts.get(item.id));
        if (question) accepted.push(question);
      }
    }
  } catch (err) {
    // Its usage is already the level's total.
    if (err instanceof GenerationCancelled) throw err;
    if (err instanceof GenerationError) {
      throw new GenerationError(err.message, addUsage(usage, err.usage), { cause: err });
    }
    throw new GenerationError('Question generation failed unexpectedly. Try again.', usage, {
      cause: err,
    });
  }

  return { questions: accepted, short: accepted.length < request.count, usage };
}

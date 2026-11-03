// One word generation (F83; spec: Admin, Word generation). Ported and adapted from Buzzr
// (buzzer/server/generate/generator.ts): a writer drafts the words, a checker keeps or drops each
// one, and the pack rules run last. The models sit behind two interfaces, so this file is pure
// orchestration and the tests drive it with fakes. Every model output is parsed here with zod;
// anything malformed counts as a drop rather than failing the generation.
//
// Drafts are admin-only: nothing here logs a word, and nothing reaches a room or socket.

import { z } from 'zod';
import { WORD_ALT_MAX } from '../../shared/constants.js';
import { emojiSchema } from '../../shared/schemas.js';
import type { AdminDraftWord, AdminGenerateStage, WordLevel } from '../../shared/types.js';
import { normalize } from '../match.js';
import { packFormSchema } from '../packs.js';

/** One request's token counts, by model, for the spend log (F84 prices them). */
export interface RequestUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface WordRequest {
  /** The category's title, such as "Kitchen". */
  title: string;
  /** Words wanted. */
  count: number;
  /** Words and alternates already in the category, never to be repeated. */
  avoid: readonly string[];
  /** Ask for the category's emoji too (a new category). */
  wantEmoji: boolean;
}

export interface WordWriter {
  /** Raw items, parsed here. Throws a GenerationError on a refusal, timeout or API error. */
  write(
    request: WordRequest,
  ): Promise<{ words: unknown[]; emoji?: unknown; usage: RequestUsage[] }>;
}

/** A word as the checker sees it, with an id to answer by. */
export interface CheckItem {
  id: string;
  word: string;
  alt: string[];
  level: LevelName;
}

export interface WordChecker {
  /** Raw verdicts, parsed here. Throws a GenerationError on a refusal, timeout or API error. */
  check(
    title: string,
    items: readonly CheckItem[],
  ): Promise<{ verdicts: unknown[]; usage: RequestUsage[] }>;
}

export interface GenerationResult {
  words: AdminDraftWord[];
  /** The category's emoji, when one was asked for and the writer gave a valid one. */
  emoji?: string;
  usage: RequestUsage[];
}

/**
 * A failed generation, with a message fit to show the admin and the usage spent before it failed.
 * Show or log only `message`: `cause` may hold the SDK's error and the API's own text.
 */
export class GenerationError extends Error {
  override name = 'GenerationError';
  readonly usage: RequestUsage[];

  constructor(message: string, usage: RequestUsage[] = [], options?: ErrorOptions) {
    super(message, options);
    this.usage = usage;
  }
}

export const UNEXPECTED_ERROR = 'Word generation failed unexpectedly. Try again.';

type LevelName = 'easy' | 'medium' | 'hard';
const LEVEL: Record<LevelName, WordLevel> = { easy: 1, medium: 2, hard: 3 };

/** A written word as the writer sends it: the shape only, the pack rules come last. */
const writtenWordSchema = z.object({
  word: z.string().trim().min(1),
  level: z.enum(['easy', 'medium', 'hard']),
  alt: z.array(z.string()).nullish(),
});

const verdictSchema = z.object({ id: z.string(), keep: z.boolean(), reason: z.string() });

/** The first verdict for each id; a malformed one is no verdict, so its word is dropped. */
function keptIds(raw: readonly unknown[]): Set<string> {
  const seen = new Set<string>();
  const kept = new Set<string>();
  for (const item of raw) {
    const parsed = verdictSchema.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    if (parsed.data.keep) kept.add(parsed.data.id);
  }
  return kept;
}

/**
 * The pack rules (`packFormSchema`, the same as the store's): a word that breaks them is dropped,
 * an alternate that breaks them is left out, and at most 6 alternates are kept.
 */
function packChecked(item: CheckItem): AdminDraftWord | null {
  if (!packFormSchema.safeParse(item.word).success) return null;
  const alt = item.alt.filter((a) => packFormSchema.safeParse(a).success).slice(0, WORD_ALT_MAX);
  return { word: item.word, alt, difficulty: LEVEL[item.level] };
}

export async function generateWords(
  request: WordRequest,
  deps: {
    writer: WordWriter;
    checker: WordChecker;
    /** Told as each stage starts, for the job's progress. */
    onStage?: (stage: AdminGenerateStage) => void;
  },
): Promise<GenerationResult> {
  if (!Number.isInteger(request.count) || request.count < 1) {
    throw new RangeError(`count must be a whole number of at least 1, got ${request.count}`);
  }
  let usage: RequestUsage[] = [];

  try {
    deps.onStage?.('writing');
    const draft = await deps.writer.write(request);
    usage = [...usage, ...draft.usage];
    const emoji = request.wantEmoji ? emojiSchema.safeParse(draft.emoji) : null;

    // Every word and alternate taken so far, by `normalize` (as guesses are matched): the avoid
    // list, then each kept word with its alternates. A word that is already taken (a repeat, or
    // another word's alternate) is dropped; an alternate that is taken is left out.
    const taken = new Set(request.avoid.map(normalize).filter((form) => form !== ''));
    const items: CheckItem[] = [];
    for (const raw of draft.words) {
      if (items.length === request.count) break;
      const parsed = writtenWordSchema.safeParse(raw);
      if (!parsed.success) continue;
      const word = parsed.data.word;
      const form = normalize(word);
      if (form === '' || taken.has(form)) continue;
      taken.add(form);
      const alt: string[] = [];
      for (const a of parsed.data.alt ?? []) {
        const text = a.trim();
        const altForm = normalize(text);
        if (altForm === '' || taken.has(altForm)) continue;
        taken.add(altForm);
        alt.push(text);
      }
      items.push({ id: `w${items.length + 1}`, word, alt, level: parsed.data.level });
    }

    let words: AdminDraftWord[] = [];
    if (items.length > 0) {
      deps.onStage?.('checking');
      const checked = await deps.checker.check(request.title, items);
      usage = [...usage, ...checked.usage];
      const kept = keptIds(checked.verdicts);
      // The pack rules run last, on what the checker kept.
      words = items
        .filter((item) => kept.has(item.id))
        .map(packChecked)
        .filter((w): w is AdminDraftWord => w !== null);
    }
    return { words, ...(emoji?.success ? { emoji: emoji.data } : {}), usage };
  } catch (err) {
    if (err instanceof GenerationError) {
      throw new GenerationError(err.message, [...usage, ...err.usage], { cause: err });
    }
    throw new GenerationError(UNEXPECTED_ERROR, usage, { cause: err });
  }
}

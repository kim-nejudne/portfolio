// Word packs (spec: Word pack format). One JSON file per pack in `data/packs/`, checked here when
// the server starts and by `npm run packs:check`, with the same schema and rules.
// Server state only: no word, alternate or gloss is ever sent to a Screen or guesser.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { WordEntry } from '../shared/types.js';
import { normalize } from './match.js';

export const PACK_WORD_MAX = 30;
export const PACK_ALT_MAX = 6;
export const PACK_GLOSS_MAX = 40;
export const PACK_ID_MAX = 40;
export const PACK_TITLE_MAX = 40;
/** A form shorter than this, once normalised, is "close" to almost any short guess (DECISIONS 37). */
export const PACK_FORM_MIN_LETTERS = 3;

const idSchema = z
  .string()
  .max(PACK_ID_MAX)
  .regex(/^[a-z0-9-]+$/, 'use only a-z, 0-9 and -');

/** A word or alternate: 1–30 characters that still leave 3 letters or digits once normalised. */
const formSchema = z
  .string()
  .min(1)
  .max(PACK_WORD_MAX)
  .refine((s) => [...normalize(s)].length >= PACK_FORM_MIN_LETTERS, {
    error: (issue) =>
      `must keep at least ${PACK_FORM_MIN_LETTERS} letters once fillers and punctuation are dropped (${JSON.stringify(issue.input)})`,
  });

const wordSchema = z.strictObject({
  id: idSchema,
  word: formSchema,
  alt: z.array(formSchema).max(PACK_ALT_MAX).default([]),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  gloss: z.string().min(1).max(PACK_GLOSS_MAX).optional(),
});

export const packFileSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: idSchema,
    title: z.string().min(1).max(PACK_TITLE_MAX),
    language: z.enum(['en', 'tl']),
    rating: z.enum(['family', 'spicy']),
    words: z.array(wordSchema).min(1),
  })
  .superRefine((pack, ctx) => {
    const seen = new Set<string>();
    pack.words.forEach((w, i) => {
      if (seen.has(w.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['words', i, 'id'],
          message: `duplicate word id ${JSON.stringify(w.id)}`,
        });
      }
      seen.add(w.id);
      if (pack.language === 'tl' && w.difficulty >= 2 && w.gloss === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['words', i, 'gloss'],
          message: `required for 'tl' words of difficulty 2–3 (${JSON.stringify(w.word)})`,
        });
      }
    });
  });

export interface Pack {
  id: string;
  title: string;
  language: 'en' | 'tl';
  rating: 'family' | 'spicy';
  words: readonly WordEntry[];
}

/** A pack that can't be used. The message names the file, the field and the word, one per line. */
export class PackError extends Error {
  override name = 'PackError';
}

/** The word a problem at `words.<i>…` belongs to, for messages: `("tsinelas")`. */
function wordLabel(raw: unknown, path: readonly PropertyKey[]): string {
  if (path[0] !== 'words' || typeof path[1] !== 'number') return '';
  const words = (raw as { words?: unknown } | null)?.words;
  const word = Array.isArray(words) ? (words[path[1]] as { word?: unknown } | null)?.word : null;
  return typeof word === 'string' ? ` (${JSON.stringify(word)})` : '';
}

/** Checks one pack file's parsed JSON and returns it with full ids, frozen. Throws `PackError`. */
export function parsePack(raw: unknown, source: string): Pack {
  const result = packFileSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      const where = issue.path.length > 0 ? issue.path.join('.') : '(pack)';
      // Our own refinements already quote the value they refuse.
      const label = issue.code === 'custom' ? '' : wordLabel(raw, issue.path);
      return `  ${source}: ${where}: ${issue.message}${label}`;
    });
    throw new PackError([`${source} is not a valid word pack:`, ...lines].join('\n'));
  }
  const { id, title, language, rating, words } = result.data;
  return Object.freeze({
    id,
    title,
    language,
    rating,
    words: Object.freeze(
      words.map((w) => {
        const entry: WordEntry = {
          id: `${id}/${w.id}`,
          word: w.word,
          alt: Object.freeze([...w.alt]) as string[],
          difficulty: w.difficulty,
          lang: language,
          ...(w.gloss !== undefined && { gloss: w.gloss }),
        };
        return Object.freeze(entry);
      }),
    ),
  });
}

/**
 * `data/packs` for a module in `server/` (run by tsx) or in `dist/server` (production build): both
 * sit inside the project, one and two levels down.
 */
export function packsDirFor(moduleUrl: string, production: boolean): string {
  return fileURLToPath(new URL(production ? '../../data/packs' : '../data/packs', moduleUrl));
}

/**
 * What the server does at start: the packs and a one-line summary, or the message it prints
 * before exiting. Errors other than `PackError` are bugs and still throw.
 */
export function loadPacksForStart(
  dir: string,
): { ok: true; packs: Pack[]; summary: string } | { ok: false; message: string } {
  try {
    const packs = loadPacks(dir);
    const words = packs.reduce((n, p) => n + p.words.length, 0);
    return { ok: true, packs, summary: `Loaded ${packs.length} word packs (${words} words)` };
  } catch (err) {
    if (!(err instanceof PackError)) throw err;
    return { ok: false, message: `Sketchy can't start.\n${err.message}` };
  }
}

/**
 * Loads every `*.json` in `dir`, in name order. Throws `PackError` for a missing or empty
 * directory, a file that isn't JSON, an invalid pack, or a pack id used twice.
 */
export function loadPacks(dir: string): Pack[] {
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort();
  } catch (err) {
    throw new PackError(`Can't read the word packs in ${dir}: ${(err as Error).message}`);
  }
  if (files.length === 0) throw new PackError(`There are no word packs (*.json) in ${dir}.`);

  const packs: Pack[] = [];
  const fileOf = new Map<string, string>();
  for (const file of files) {
    // Relative to where the server or check runs, so messages stay short: data/packs/x.json.
    const path = relative(process.cwd(), join(dir, file)) || join(dir, file);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      throw new PackError(`${path}: not valid JSON (${(err as Error).message})`);
    }
    const pack = parsePack(raw, path);
    const other = fileOf.get(pack.id);
    if (other !== undefined) {
      throw new PackError(
        `${path}: id: pack id ${JSON.stringify(pack.id)} is also used by ${other}`,
      );
    }
    fileOf.set(pack.id, path);
    packs.push(pack);
  }
  return packs;
}

export interface DuplicateWord {
  form: string; // the normalised word they share
  ids: string[]; // full word ids, in pack order
}

/** Words that normalise the same ("halo-halo", "Halo halo"), across packs or within one. */
export function findDuplicateWords(packs: readonly Pack[]): DuplicateWord[] {
  const byForm = new Map<string, string[]>();
  for (const pack of packs) {
    for (const w of pack.words) {
      const form = normalize(w.word);
      byForm.set(form, [...(byForm.get(form) ?? []), w.id]);
    }
  }
  return [...byForm]
    .filter(([, ids]) => ids.length > 1)
    .map(([form, ids]) => ({ form, ids }))
    .sort((a, b) => a.form.localeCompare(b.form));
}

export interface AltClash {
  alt: string; // the alternate as written
  id: string; // the word it belongs to
  otherId: string; // the word whose main form it equals
}

/**
 * Alternates that normalise to another word's main form: guessing "chicken" for "fried chicken"
 * would win if "chicken" were also a word of its own. `packs:check` warns; matching is unaffected.
 */
export function findAltClashes(packs: readonly Pack[]): AltClash[] {
  const idOf = new Map<string, string>();
  for (const w of packs.flatMap((p) => p.words))
    idOf.set(normalize(w.word), idOf.get(normalize(w.word)) ?? w.id);
  const clashes: AltClash[] = [];
  for (const w of packs.flatMap((p) => p.words)) {
    for (const alt of w.alt) {
      const otherId = idOf.get(normalize(alt));
      if (otherId !== undefined && otherId !== w.id) clashes.push({ alt, id: w.id, otherId });
    }
  }
  return clashes;
}

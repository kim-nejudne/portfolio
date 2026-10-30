// **Export JSON** and **Import JSON** on the set list (Set list; Images). One file carries a whole
// set: the set's own fields plus `images`, each referenced image once as a base64 data URL.
// **Export all** writes `{sets: [...]}`, each entry such a set file, and import accepts either, or a
// bare array of set files (the starter file shape, F102).

import { z } from 'zod';
import { IMAGE_MAX_BYTES, MAX_QUESTIONS_PER_SET } from '../../../shared/constants.js';
import { idSchema, questionSetSchema } from '../../../shared/schemas.js';
import { describePath, entryLabel, fillFromTitle } from '../../../shared/setFile.js';
import type { QuestionSet } from '../../../shared/types.js';
import type { StoredImage } from './db.js';
import { checkPlayable } from './hostRoom.js';

// The title rule now lives in `shared/`, so the server's built-in import uses it too (F106).
export { fillFromTitle };

/** Import lists at most this many errors, then "…and N more." */
export const IMPORT_ERRORS_SHOWN = 10;

/** The image types the editor accepts (Images). */
const IMAGE_TYPES = /^image\/(?:png|jpeg|webp|gif)$/;
const DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/;

/**
 * The largest file import reads: a full set whose every question has its own largest image (base64
 * grows bytes by 4/3), plus 1 MB for the text. A bigger file cannot be valid, and reading it whole
 * could freeze the tab.
 */
export const IMPORT_FILE_MAX_BYTES =
  MAX_QUESTIONS_PER_SET * Math.ceil((IMAGE_MAX_BYTES * 4) / 3) + 1024 * 1024;

const dataUrlSchema = z.string().superRefine((value, ctx) => {
  const match = DATA_URL.exec(value);
  if (!match || match[2]!.length % 4 !== 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Must be a PNG, JPEG, WebP or GIF data URL (data:image/…;base64,…)',
    });
  } else if (decodedLength(match[2]!) > IMAGE_MAX_BYTES) {
    ctx.addIssue({
      code: 'custom',
      message: `The image is larger than ${IMAGE_MAX_BYTES / 1024 / 1024} MB`,
    });
  }
});

/**
 * A file must hold a playable set (DECISIONS F02), with `images` optional for text-only sets.
 * `safeExtend` keeps the set's board check (F89).
 */
const setFileSchema = questionSetSchema.safeExtend({
  images: z.record(idSchema, dataUrlSchema).optional(),
});

export type ParsedSetFile =
  { ok: true; set: QuestionSet; images: StoredImage[] } | { ok: false; errors: string[] };

function decodedLength(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Chunked, so a large image does not overflow the argument limit of `fromCharCode`.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

/** Decodes a data URL that `setFileSchema` accepted. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [, type, base64] = DATA_URL.exec(dataUrl)!;
  const binary = atob(base64!);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

/** "Pub quiz: Round 2!" → "pub-quiz-round-2.json". */
export function exportFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'question-set'}.json`;
}

/**
 * One set as its file object: the set's fields plus `images`. Throws a readable Error for a draft
 * (import accepts only playable sets, so a draft's file could not come back) or for an image gone
 * from this browser.
 */
async function setFileEntry(
  set: QuestionSet,
  loadImage: (id: string) => Promise<Blob | undefined>,
): Promise<QuestionSet & { images: Record<string, string> }> {
  const checked = checkPlayable(set);
  if (!checked.ok) throw new Error(checked.error);

  const images = new Map<string, string>();
  for (const [index, { imageId }] of checked.set.questions.entries()) {
    if (imageId === undefined || images.has(imageId)) continue;
    const blob = await loadImage(imageId);
    if (!blob) throw new Error(`Question ${index + 1}'s image is missing from this browser.`);
    // Import would refuse any other type, so the file could not come back.
    if (!IMAGE_TYPES.test(blob.type)) {
      throw new Error(`Question ${index + 1}'s image is not a PNG, JPEG, WebP or GIF.`);
    }
    images.set(imageId, await blobToDataUrl(blob));
  }
  return { ...checked.set, images: Object.fromEntries(images) };
}

/** The JSON text of one export file. Throws as `setFileEntry`. */
export async function exportSetFile(
  set: QuestionSet,
  loadImage: (id: string) => Promise<Blob | undefined>,
): Promise<string> {
  return JSON.stringify(await setFileEntry(set, loadImage), null, 2);
}

/** "buzzr-sets-2026-10-29.json", in the browser's own date. */
export function exportAllFileName(now = Date.now()): string {
  const date = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `buzzr-sets-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

export interface ExportAll {
  /** The file's text; meaningful only when `exported` is above 0. */
  text: string;
  exported: number;
  skipped: { title: string; reason: string }[];
}

/**
 * **Export all**: every set that `exportSetFile` would write, in order, as `{sets: [...]}` (the
 * same text as `JSON.stringify(..., null, 2)`). A draft or a set with a missing image is skipped
 * with its reason, and so is a set that would take the file over `maxBytes`, which import refuses.
 */
export async function exportAllFile(
  sets: readonly QuestionSet[],
  loadImage: (id: string) => Promise<Blob | undefined>,
  maxBytes = IMPORT_FILE_MAX_BYTES,
): Promise<ExportAll> {
  const encoder = new TextEncoder();
  const head = '{\n  "sets": [\n';
  const tail = '\n  ]\n}';
  let size = encoder.encode(head + tail).length;
  const entries: string[] = [];
  const skipped: ExportAll['skipped'] = [];
  for (const set of sets) {
    let entry: string;
    try {
      // Indented as `JSON.stringify` nests it; JSON strings hold no raw line breaks.
      entry = JSON.stringify(await setFileEntry(set, loadImage), null, 2).replace(/^/gm, '    ');
    } catch (caught) {
      skipped.push({ title: set.title, reason: (caught as Error).message });
      continue;
    }
    const bytes = encoder.encode(entry).length + (entries.length > 0 ? 2 : 0);
    if (size + bytes > maxBytes) {
      const limit = Math.round(maxBytes / 1024 / 1024);
      skipped.push({
        title: set.title,
        reason: `It would take the file over ${limit} MB. Export it on its own.`,
      });
      continue;
    }
    size += bytes;
    entries.push(entry);
  }
  return { text: head + entries.join(',\n') + tail, exported: entries.length, skipped };
}

/** The first `IMPORT_ERRORS_SHOWN` errors, then "…and N more." */
function capErrors(errors: string[]): string[] {
  const shown = errors.slice(0, IMPORT_ERRORS_SHOWN);
  if (errors.length > shown.length) shown.push(`…and ${errors.length - shown.length} more.`);
  return shown;
}

function refuse(errors: string[]): ParsedSetFile {
  return { ok: false, errors: capErrors(errors) };
}

function parseJson(text: string): { ok: true; json: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, json: JSON.parse(text) };
  } catch (caught) {
    return { ok: false, error: `This file isn't valid JSON (${(caught as Error).message}).` };
  }
}

/** Reads an import file. Never throws: a bad file gives readable errors, each a path and message. */
export function parseSetFile(text: string): ParsedSetFile {
  const parsed = parseJson(text);
  return parsed.ok ? parseSetValue(parsed.json) : refuse([parsed.error]);
}

function parseSetValue(json: unknown): ParsedSetFile {
  const result = setFileSchema.safeParse(json);
  if (!result.success) {
    return refuse(result.error.issues.map((i) => `${describePath(i.path)}: ${i.message}`));
  }

  const { images: dataUrls = {}, ...parsed } = result.data;
  const set = fillFromTitle(parsed);
  const errors: string[] = [];
  const images = new Map<string, StoredImage>();
  for (const [index, { imageId }] of set.questions.entries()) {
    if (imageId === undefined || images.has(imageId)) continue;
    // `Object.hasOwn`, so an id like "constructor" is not found on the prototype.
    if (!Object.hasOwn(dataUrls, imageId)) {
      errors.push(`Question ${index + 1} › imageId: The image ${imageId} is not in the file`);
      continue;
    }
    images.set(imageId, { id: imageId, blob: dataUrlToBlob(dataUrls[imageId]!) });
  }
  if (errors.length > 0) return refuse(errors);
  // Images no question references are dropped.
  return { ok: true, set, images: [...images.values()] };
}

const manyFileSchema = z.object({
  sets: z.array(z.unknown()).min(1, 'The file has no sets'),
});

export type ParsedImportFile =
  | { kind: 'one'; parsed: ParsedSetFile }
  | { kind: 'many'; sets: { label: string; parsed: ParsedSetFile }[] }
  | { kind: 'bad'; errors: string[] };

/**
 * Reads a single-set file, an **Export all** file (an object with `sets` and no `questions`), or a
 * bare array of sets (F102). Each set of a many-set file is checked on its own, so the good ones can
 * still be imported.
 */
export function parseImportFile(text: string): ParsedImportFile {
  const parsed = parseJson(text);
  if (!parsed.ok) return { kind: 'bad', errors: [parsed.error] };
  const { json } = parsed;
  if (Array.isArray(json)) {
    if (json.length === 0) return { kind: 'bad', errors: ['The file has no sets'] };
    return { kind: 'many', sets: parseEntries(json) };
  }
  const isMany =
    typeof json === 'object' &&
    json !== null &&
    !Array.isArray(json) &&
    Object.hasOwn(json, 'sets') &&
    !Object.hasOwn(json, 'questions');
  if (!isMany) return { kind: 'one', parsed: parseSetValue(json) };

  const result = manyFileSchema.safeParse(json);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `${describePath(i.path)}: ${i.message}`);
    return { kind: 'bad', errors: capErrors(errors) };
  }
  return { kind: 'many', sets: parseEntries(result.data.sets) };
}

function parseEntries(entries: unknown[]): { label: string; parsed: ParsedSetFile }[] {
  return entries.map((entry, index) => ({
    label: entryLabel(entry, index),
    parsed: parseSetValue(entry),
  }));
}

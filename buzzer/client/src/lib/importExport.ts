// **Export JSON** and **Import JSON** on the set list (Set list; Images). One file carries a whole
// set: the set's own fields plus `images`, each referenced image once as a base64 data URL.

import { z } from 'zod';
import { IMAGE_MAX_BYTES, MAX_QUESTIONS_PER_SET } from '../../../shared/constants.js';
import { idSchema, questionSetSchema } from '../../../shared/schemas.js';
import type { QuestionSet } from '../../../shared/types.js';
import type { StoredImage } from './db.js';
import { checkPlayable } from './hostRoom.js';

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

/** A file must hold a playable set (DECISIONS F02), with `images` optional for text-only sets. */
const setFileSchema = questionSetSchema.extend({
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
 * The JSON text of one export file. Throws a readable Error for a draft (import accepts only
 * playable sets, so a draft's file could not come back) or for an image gone from this browser.
 */
export async function exportSetFile(
  set: QuestionSet,
  loadImage: (id: string) => Promise<Blob | undefined>,
): Promise<string> {
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
  return JSON.stringify({ ...checked.set, images: Object.fromEntries(images) }, null, 2);
}

/** "schemaVersion" → "Schema version". */
function sentenceCase(key: string): string {
  const words = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A zod issue path as the host reads it: "Question 3 › answer", "Image img-1", "Title". */
function describePath(path: readonly PropertyKey[]): string {
  const [first, second, ...rest] = path.map(String);
  if (first === undefined) return 'File';
  if (first === 'questions' && typeof path[1] === 'number') {
    return [`Question ${(path[1] as number) + 1}`, ...rest].join(' › ');
  }
  if (first === 'images' && second !== undefined) return [`Image ${second}`, ...rest].join(' › ');
  return [sentenceCase(first), ...(second === undefined ? [] : [second]), ...rest].join(' › ');
}

function refuse(errors: string[]): ParsedSetFile {
  const shown = errors.slice(0, IMPORT_ERRORS_SHOWN);
  if (errors.length > shown.length) shown.push(`…and ${errors.length - shown.length} more.`);
  return { ok: false, errors: shown };
}

/** Reads an import file. Never throws: a bad file gives readable errors, each a path and message. */
export function parseSetFile(text: string): ParsedSetFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (caught) {
    return refuse([`This file isn't valid JSON (${(caught as Error).message}).`]);
  }

  const result = setFileSchema.safeParse(json);
  if (!result.success) {
    return refuse(result.error.issues.map((i) => `${describePath(i.path)}: ${i.message}`));
  }

  const { images: dataUrls = {}, ...set } = result.data;
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

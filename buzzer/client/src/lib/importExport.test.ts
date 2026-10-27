import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_MAX_BYTES } from '../../../shared/constants.js';
import type { QuestionSet } from '../../../shared/types.js';
import { db, getImage, getSet, importSet } from './db.js';
import {
  dataUrlToBlob,
  exportFileName,
  exportSetFile,
  IMPORT_ERRORS_SHOWN,
  parseSetFile,
} from './importExport.js';

const NOW = 1_700_000_000_000;

// Every byte value, so a base64 slip on high or non-ASCII bytes shows.
const PNG_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i);
const GIF_BYTES = new TextEncoder().encode('GIF89a frame');

const SET: QuestionSet = {
  id: 'quiz',
  title: 'Pub quiz',
  questions: [
    { id: 'q1', text: 'Capital of France?', answer: 'Paris', hostNotes: 'Not Lyon', points: 100 },
    { id: 'q2', text: '', imageId: 'img-1', answer: 'Eiffel Tower', points: 200 },
    { id: 'q3', text: 'Which animal?', imageId: 'img-2', answer: 'Cat', points: 0 },
    { id: 'q4', text: 'Same picture again?', imageId: 'img-1', answer: 'Yes', points: 50 },
  ],
  createdAt: 1,
  updatedAt: 2,
  schemaVersion: 1,
};

const blobs = new Map([
  ['img-1', new Blob([PNG_BYTES], { type: 'image/png' })],
  ['img-2', new Blob([GIF_BYTES], { type: 'image/gif' })],
]);
const loadImage = (id: string) => Promise.resolve(blobs.get(id));

async function bytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

/** A valid exported file as an object, for the malformed-file tests to break. */
async function exported() {
  return JSON.parse(await exportSetFile(SET, loadImage)) as Record<string, unknown> & {
    questions: Record<string, unknown>[];
    images: Record<string, string>;
  };
}

function errorsOf(text: string): string[] {
  const parsed = parseSetFile(text);
  if (parsed.ok) throw new Error('Expected the file to be refused');
  return parsed.errors;
}

beforeEach(async () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Export JSON', () => {
  it('writes one file that embeds each image once as a base64 data URL', async () => {
    const file = await exported();
    expect(Object.keys(file.images).sort()).toEqual(['img-1', 'img-2']);
    expect(file.images['img-1']).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
    expect(file.images['img-2']).toBe(`data:image/gif;base64,${btoa('GIF89a frame')}`);
    expect(await bytes(dataUrlToBlob(file.images['img-1']!))).toEqual(PNG_BYTES);
    expect(file.questions[1]).toMatchObject({ imageId: 'img-1', answer: 'Eiffel Tower' });
    expect(file.title).toBe('Pub quiz');
  });

  it('refuses a draft with the same reason hosting gives', async () => {
    const draft = { ...SET, questions: [{ ...SET.questions[0]!, answer: '' }] };
    await expect(exportSetFile(draft, loadImage)).rejects.toThrow('Question 1 needs an answer.');
  });

  it('refuses a set whose image is gone from this browser', async () => {
    await expect(exportSetFile(SET, () => Promise.resolve(undefined))).rejects.toThrow(
      "Question 2's image is missing from this browser.",
    );
  });

  it('refuses an image type that import would refuse', async () => {
    const svg = () => Promise.resolve(new Blob(['<svg/>'], { type: 'image/svg+xml' }));
    await expect(exportSetFile(SET, svg)).rejects.toThrow(
      "Question 2's image is not a PNG, JPEG, WebP or GIF.",
    );
  });

  it('names the file after the title', () => {
    expect(exportFileName('Pub quiz: Round 2!')).toBe('pub-quiz-round-2.json');
    expect(exportFileName('???')).toBe('question-set.json');
  });
});

describe('Import JSON', () => {
  it('round-trips a set with its images through a file', async () => {
    const parsed = parseSetFile(await exportSetFile(SET, loadImage));
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));

    const stored = await importSet(parsed.set, parsed.images);
    const saved = await getSet(stored.id);
    expect(saved).toEqual(stored);

    // New set and image ids, so importing never overwrites; everything else is equal.
    expect(stored.id).not.toBe(SET.id);
    const [, q2, q3, q4] = stored.questions;
    expect(q2!.imageId).not.toBe('img-1');
    expect(q4!.imageId).toBe(q2!.imageId);
    const withOldIds = stored.questions.map((q, i) => ({
      ...q,
      imageId: SET.questions[i]!.imageId,
    }));
    expect({ ...stored, id: SET.id, questions: withOldIds }).toEqual({
      ...SET,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const png = (await getImage(q2!.imageId!))!.blob;
    const gif = (await getImage(q3!.imageId!))!.blob;
    expect(png.type).toBe('image/png');
    expect(await bytes(png)).toEqual(PNG_BYTES);
    expect(gif.type).toBe('image/gif');
    expect(await bytes(gif)).toEqual(GIF_BYTES);
    expect(await db.images.count()).toBe(2);
  });

  it('accepts a text-only file without an images field', () => {
    const textOnly = { ...SET, questions: [SET.questions[0]] };
    const parsed = parseSetFile(JSON.stringify(textOnly));
    expect(parsed).toEqual({ ok: true, set: textOnly, images: [] });
  });

  it('refuses a file that is not JSON', () => {
    expect(errorsOf('{"title": "Pub quiz",')).toEqual([
      expect.stringMatching(/^This file isn't valid JSON/),
    ]);
    expect(errorsOf('')).toEqual([expect.stringMatching(/^This file isn't valid JSON/)]);
  });

  it('lists each schema error with its path and message', async () => {
    const file = await exported();
    file.title = '';
    file.questions[0]!.answer = '';
    file.questions[2]!.points = 'lots';
    delete file.schemaVersion;

    expect(errorsOf(JSON.stringify(file))).toEqual([
      'Title: Too small: expected string to have >=1 characters',
      'Question 1 › answer: Too small: expected string to have >=1 characters',
      'Question 3 › points: Invalid input: expected number, received string',
      'Schema version: Invalid input: expected 1',
    ]);
  });

  it('refuses a file that is not a question set at all', () => {
    expect(errorsOf('[1, 2, 3]')).toEqual(['File: Invalid input: expected object, received array']);
  });

  it('refuses missing, unsupported and oversized images', async () => {
    const file = await exported();
    delete file.images['img-2'];
    file.images['img-1'] = 'data:text/html;base64,PGI+aGk8L2I+';
    file.images['extra'] =
      `data:image/png;base64,${'A'.repeat(Math.ceil((IMAGE_MAX_BYTES * 4) / 3) + 4)}`;

    expect(errorsOf(JSON.stringify(file))).toEqual([
      'Image img-1: Must be a PNG, JPEG, WebP or GIF data URL (data:image/…;base64,…)',
      'Image extra: The image is larger than 1.5 MB',
    ]);
    // With the images fixed, the missing one is reported against its question.
    file.images['img-1'] = 'data:image/png;base64,AAAA';
    delete file.images['extra'];
    expect(errorsOf(JSON.stringify(file))).toEqual([
      'Question 3 › imageId: The image img-2 is not in the file',
    ]);
  });

  it(`shows at most ${IMPORT_ERRORS_SHOWN} errors and counts the rest`, async () => {
    const file = await exported();
    for (const question of file.questions) question.answer = '';
    file.questions = Array.from({ length: 15 }, (_, i) => ({ ...file.questions[0], id: `q${i}` }));

    const errors = errorsOf(JSON.stringify(file));
    expect(errors).toHaveLength(IMPORT_ERRORS_SHOWN + 1);
    expect(errors.at(-1)).toBe('…and 5 more.');
  });
});

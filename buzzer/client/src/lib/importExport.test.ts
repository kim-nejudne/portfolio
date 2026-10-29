import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_MAX_BYTES } from '../../../shared/constants.js';
import type { QuestionSet } from '../../../shared/types.js';
import { db, getImage, getSet, importSet } from './db.js';
import {
  dataUrlToBlob,
  exportAllFile,
  exportAllFileName,
  exportFileName,
  exportSetFile,
  IMPORT_ERRORS_SHOWN,
  IMPORT_FILE_MAX_BYTES,
  parseImportFile,
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
    const imagesBefore = await db.images.count();
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
    expect(await db.images.count()).toBe(imagesBefore + 2);
  });

  it('round-trips category and difficulty: export writes them, import keeps them', async () => {
    const tagged: QuestionSet = { ...SET, category: 'Geography', difficulty: 'medium' };
    const file = JSON.parse(await exportSetFile(tagged, loadImage)) as QuestionSet;
    expect([file.category, file.difficulty]).toEqual(['Geography', 'medium']);

    const parsed = parseSetFile(JSON.stringify(file));
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    const stored = await importSet(parsed.set, parsed.images);
    expect(await getSet(stored.id)).toMatchObject({ category: 'Geography', difficulty: 'medium' });
  });

  it('exports a trimmed category, and imports a file without either field', async () => {
    const file = JSON.parse(
      await exportSetFile({ ...SET, category: '  Geography ' }, loadImage),
    ) as QuestionSet;
    expect(file.category).toBe('Geography');

    const parsed = parseSetFile(await exportSetFile(SET, loadImage));
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    expect(parsed.set).not.toHaveProperty('category');
    expect(parsed.set).not.toHaveProperty('difficulty');
  });

  it('round-trips choice questions: export writes mode, choices and the correct one, import keeps them', async () => {
    const choice = {
      id: 'q5',
      text: 'Largest planet?',
      answer: 'Jupiter',
      points: 100,
      mode: 'choice' as const,
      choices: ['Mars', 'Jupiter', 'Venus'],
      correctChoice: 1,
    };
    const mixed: QuestionSet = { ...SET, questions: [...SET.questions, choice] };
    const file = JSON.parse(await exportSetFile(mixed, loadImage)) as QuestionSet;
    expect(file.questions[4]).toEqual(choice);

    const parsed = parseSetFile(JSON.stringify(file));
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    const stored = await importSet(parsed.set, parsed.images);
    expect((await getSet(stored.id))!.questions[4]).toEqual(choice);
  });

  it('imports a choice question whose answer is blank, setting it to the correct choice', async () => {
    const file = await exported();
    file.questions[0] = {
      ...file.questions[0],
      answer: '',
      mode: 'choice',
      choices: ['Lyon', 'Paris'],
      correctChoice: 1,
    };
    const parsed = parseSetFile(JSON.stringify(file));
    expect(parsed.ok && parsed.set.questions[0]!.answer).toBe('Paris');
  });

  it('refuses a choice question without a correct choice, or with one out of range', async () => {
    const file = await exported();
    file.questions[0] = { ...file.questions[0], mode: 'choice', choices: ['Lyon', 'Paris'] };
    file.questions[2] = {
      ...file.questions[2],
      mode: 'choice',
      choices: ['Dog', 'Cat'],
      correctChoice: 2,
    };
    expect(errorsOf(JSON.stringify(file))).toEqual([
      'Question 1 › correctChoice: A choice question needs a correct choice',
      'Question 3 › correctChoice: The correct choice must be one of the 2 choices',
    ]);
  });

  it('refuses a bad category or difficulty with its path', async () => {
    const file = await exported();
    expect(errorsOf(JSON.stringify({ ...file, category: '', difficulty: 'extreme' }))).toEqual([
      expect.stringMatching(/^Category: /),
      expect.stringMatching(/^Difficulty: /),
    ]);
  });

  it('accepts a text-only file without an images field', () => {
    const textOnly = { ...SET, questions: [SET.questions[0]] };
    const parsed = parseSetFile(JSON.stringify(textOnly));
    expect(parsed).toEqual({ ok: true, set: textOnly, images: [] });
  });

  it('keeps a category board through import, and refuses a board tile not in the set (F89)', () => {
    const questions = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((id) => ({
      ...SET.questions[0]!,
      id,
    }));
    const board = {
      columns: [
        { title: 'A', questionIds: ['a1', 'a2', 'a3'] },
        { title: 'B', questionIds: ['b1', 'b2', 'b3'] },
      ],
    };
    const boardSet = { ...SET, questions, board };
    expect(parseSetFile(JSON.stringify(boardSet))).toEqual({ ok: true, set: boardSet, images: [] });
    const broken = {
      ...boardSet,
      board: { columns: [board.columns[0], { title: 'B', questionIds: ['b1', 'b2', 'zz'] }] },
    };
    expect(errorsOf(JSON.stringify(broken))).toEqual([
      expect.stringContaining('A board tile must be a question of the set'),
    ]);
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
      'Question 1 › answer: The answer is required',
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

describe('Export all and import many', () => {
  const TEXT_ONLY: QuestionSet = {
    ...SET,
    id: 'text',
    title: 'Text only',
    questions: [SET.questions[0]!],
  };
  const DRAFT: QuestionSet = { ...SET, id: 'draft', title: 'Half done', questions: [] };

  it('writes {sets: [...]} of every playable set with its images, and skips drafts', async () => {
    const result = await exportAllFile([SET, DRAFT, TEXT_ONLY], loadImage);

    expect(result.exported).toBe(2);
    expect(result.skipped).toEqual([
      { title: 'Half done', reason: 'This set has no questions yet.' },
    ]);
    const file = JSON.parse(result.text) as { sets: (QuestionSet & { images: object })[] };
    expect(result.text).toBe(JSON.stringify(file, null, 2));
    expect(file.sets.map((set) => set.title)).toEqual(['Pub quiz', 'Text only']);
    expect(JSON.parse(await exportSetFile(SET, loadImage))).toEqual(file.sets[0]);
    expect(file.sets[1]!.images).toEqual({});
  });

  it('skips a set whose image is gone, with the reason', async () => {
    const result = await exportAllFile([SET, TEXT_ONLY], (id) =>
      Promise.resolve(id === 'img-2' ? undefined : blobs.get(id)),
    );
    expect(result.exported).toBe(1);
    expect(result.skipped).toEqual([
      { title: 'Pub quiz', reason: "Question 3's image is missing from this browser." },
    ]);
  });

  it('round-trips many sets with their images through one file', async () => {
    const { text } = await exportAllFile([SET, TEXT_ONLY], loadImage);
    const parsed = parseImportFile(text);
    if (parsed.kind !== 'many') throw new Error('Expected a many-set file');
    expect(parsed.sets.map((entry) => entry.label)).toEqual([
      'Set 1 “Pub quiz”',
      'Set 2 “Text only”',
    ]);

    for (const { parsed: entry } of parsed.sets) {
      if (!entry.ok) throw new Error(entry.errors.join('\n'));
      await importSet(entry.set, entry.images);
    }
    const stored = await db.sets.toArray();
    expect(stored.map((set) => set.title).sort()).toEqual(['Pub quiz', 'Text only']);
    const quiz = stored.find((set) => set.title === 'Pub quiz')!;
    expect(quiz.questions.map(({ text, answer, points }) => ({ text, answer, points }))).toEqual(
      SET.questions.map(({ text, answer, points }) => ({ text, answer, points })),
    );
    const flag = await getImage(quiz.questions[1]!.imageId!);
    expect(await bytes(flag!.blob)).toEqual(PNG_BYTES);
    expect(flag!.blob.type).toBe('image/png');
    expect(quiz.questions[3]!.imageId).toBe(quiz.questions[1]!.imageId);
  });

  it('checks each set on its own: good sets parse, bad ones carry their own errors', async () => {
    const file = JSON.parse((await exportAllFile([SET, TEXT_ONLY], loadImage)).text) as {
      sets: Record<string, unknown>[];
    };
    file.sets.push({ ...file.sets[1], title: '' }, { nope: true });
    file.sets[1] = { ...file.sets[1], questions: [{ ...SET.questions[0], answer: '' }] };

    const parsed = parseImportFile(JSON.stringify(file));
    if (parsed.kind !== 'many') throw new Error('Expected a many-set file');
    expect(parsed.sets.map(({ label, parsed: entry }) => [label, entry.ok])).toEqual([
      ['Set 1 “Pub quiz”', true],
      ['Set 2 “Text only”', false],
      ['Set 3', false],
      ['Set 4', false],
    ]);
    expect(parsed.sets[1]!.parsed).toEqual({
      ok: false,
      errors: ['Question 1 › answer: The answer is required'],
    });
    expect(parsed.sets[2]!.parsed).toEqual({
      ok: false,
      errors: ['Title: Too small: expected string to have >=1 characters'],
    });
  });

  it('reads a single-set file as one set, and refuses an empty or malformed sets list', async () => {
    const one = parseImportFile(await exportSetFile(SET, loadImage));
    expect(one.kind === 'one' && one.parsed.ok && one.parsed.set.title).toBe('Pub quiz');

    expect(parseImportFile('{"sets": []}')).toEqual({
      kind: 'bad',
      errors: ['Sets: The file has no sets'],
    });
    expect(parseImportFile('{"sets": {}}')).toEqual({
      kind: 'bad',
      errors: ['Sets: Invalid input: expected array, received object'],
    });
    expect(parseImportFile('{"sets": [')).toMatchObject({
      kind: 'bad',
      errors: [expect.stringMatching(/^This file isn't valid JSON/)],
    });
  });

  it('skips a set that would take the file over the size limit import accepts', async () => {
    const small = await exportAllFile([TEXT_ONLY], loadImage);
    const limit = new TextEncoder().encode(small.text).length;
    const result = await exportAllFile([TEXT_ONLY, SET], loadImage, limit);

    expect(result.exported).toBe(1);
    expect(result.text).toBe(small.text);
    expect(result.skipped).toEqual([
      { title: 'Pub quiz', reason: expect.stringMatching(/^It would take the file over/) },
    ]);
  });

  it('names the limit in MB when a set with a large picture does not fit', async () => {
    const large = new Blob([new Uint8Array(1024 * 1024)], { type: 'image/png' });
    const result = await exportAllFile([TEXT_ONLY, SET], () => Promise.resolve(large), 1024 * 1024);
    expect(result.exported).toBe(1);
    expect(result.skipped).toEqual([
      { title: 'Pub quiz', reason: 'It would take the file over 1 MB. Export it on its own.' },
    ]);
    // By default the limit is the one import checks before reading a file.
    const fits = await exportAllFile([TEXT_ONLY, SET], () => Promise.resolve(large));
    expect([fits.exported, Math.round(IMPORT_FILE_MAX_BYTES / 1024 / 1024)]).toEqual([2, 201]);
  });

  it('names the file after the local date', () => {
    expect(exportAllFileName(new Date(2026, 9, 29, 23, 30).getTime())).toBe(
      'buzzr-sets-2026-10-29.json',
    );
    expect(exportAllFileName(new Date(2027, 0, 5, 0, 5).getTime())).toBe(
      'buzzr-sets-2027-01-05.json',
    );
  });
});

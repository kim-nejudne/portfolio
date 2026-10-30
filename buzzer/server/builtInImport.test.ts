import { describe, expect, it } from 'vitest';
import { BUILT_IN_SETS_MAX } from '../shared/constants.js';
import { SAMPLE_SET_ID } from '../shared/sampleSet.js';
import type { QuestionSet } from '../shared/types.js';
import { fileEntries, importBuiltIns } from './builtInImport.js';
import type { BuiltInData } from './builtInStore.js';
import { makeQuestion, makeSet } from './test/rooms.js';

const set = (id: string, title = `Set ${id}`): QuestionSet => ({ ...makeSet(2), id, title });

function data(sets: QuestionSet[], drafts: Record<string, QuestionSet> = {}): BuiltInData {
  return { version: 1, sets, drafts, sampleHidden: false };
}

describe('fileEntries', () => {
  it('reads a single set, {sets} and a bare array, as Import JSON does (F102)', () => {
    const a = set('a');
    expect(fileEntries(a)).toEqual({ ok: true, entries: [a] });
    expect(fileEntries({ sets: [a, a] })).toEqual({ ok: true, entries: [a, a] });
    expect(fileEntries([a])).toEqual({ ok: true, entries: [a] });
  });

  it('reads an object with both sets and questions as one set', () => {
    const odd = { ...set('a'), sets: [] };
    expect(fileEntries(odd)).toEqual({ ok: true, entries: [odd] });
  });

  it('refuses a file with no sets, or sets that are not a list', () => {
    expect(fileEntries([])).toEqual({ ok: false, error: 'The file has no sets' });
    expect(fileEntries({ sets: [] })).toEqual({ ok: false, error: 'The file has no sets' });
    expect(fileEntries({ sets: 'x' })).toEqual({
      ok: false,
      error: 'Sets: must be a list of sets',
    });
  });
});

describe('importBuiltIns', () => {
  it('appends a new id and replaces a live id in place', () => {
    const before = data([set('a', 'Old A'), set('b')]);
    const { data: after, result } = importBuiltIns(before, [set('c'), set('a', 'New A')]);
    expect(result).toEqual({ added: 1, replaced: 1, rejected: [] });
    expect(after.sets.map((s) => [s.id, s.title])).toEqual([
      ['a', 'New A'],
      ['b', 'Set b'],
      ['c', 'Set c'],
    ]);
    // The store's copy is not changed under it.
    expect(before.sets.map((s) => s.title)).toEqual(['Old A', 'Set b']);
  });

  it('keeps drafts and sampleHidden', () => {
    const before = { ...data([set('a')], { a: set('a', 'draft') }), sampleHidden: true };
    const { data: after } = importBuiltIns(before, [set('a', 'New A')]);
    expect(after.drafts).toEqual({ a: set('a', 'draft') });
    expect(after.sampleHidden).toBe(true);
  });

  it('refuses a set with a picture, naming the questions, and imports the rest', () => {
    const pictured: QuestionSet = {
      ...set('p', 'Pictures'),
      questions: [
        makeQuestion(1, { imageId: 'img-1' }),
        makeQuestion(2),
        makeQuestion(3, { imageId: 'img-2' }),
      ],
    };
    const { data: after, result } = importBuiltIns(data([]), [pictured, set('ok')]);
    expect(result).toEqual({
      added: 1,
      replaced: 0,
      rejected: [
        {
          label: 'Set 1 “Pictures”',
          errors: ['Built-in sets cannot have pictures (questions 1, 3)'],
        },
      ],
    });
    expect(after.sets.map((s) => s.id)).toEqual(['ok']);
  });

  it('refuses a set that is not a valid set, with readable reasons', () => {
    const bad = { ...set('bad', 'Broken'), questions: [{ ...makeQuestion(1), text: '' }] };
    const { result } = importBuiltIns(data([]), [bad, 42]);
    expect(result.rejected).toEqual([
      { label: 'Set 1 “Broken”', errors: [expect.stringMatching(/^Question 1 › text: /)] },
      { label: 'Set 2', errors: [expect.stringMatching(/^File: /)] },
    ]);
  });

  it("refuses the bundled sample's id", () => {
    const { result } = importBuiltIns(data([]), [set(SAMPLE_SET_ID, 'Fake sample')]);
    expect(result.rejected).toEqual([
      { label: 'Set 1 “Fake sample”', errors: ['Id: this id belongs to the bundled sample set'] },
    ]);
  });

  it('refuses a second set with an id already used in the same file', () => {
    const { data: after, result } = importBuiltIns(data([]), [
      set('a', 'First'),
      set('a', 'Second'),
    ]);
    expect(result).toEqual({
      added: 1,
      replaced: 0,
      rejected: [
        { label: 'Set 2 “Second”', errors: ['Id: another set in this file has the same id'] },
      ],
    });
    expect(after.sets.map((s) => s.title)).toEqual(['First']);
  });

  it(`refuses a new set past ${BUILT_IN_SETS_MAX}, but still replaces a live one`, () => {
    const full = data(Array.from({ length: BUILT_IN_SETS_MAX - 1 }, (_, i) => set(`s${i}`)));
    const { data: after, result } = importBuiltIns(full, [
      set('new1'),
      set('new2', 'One too many'),
      set('s0', 'Replaced'),
    ]);
    expect(result).toEqual({
      added: 1,
      replaced: 1,
      rejected: [
        {
          label: 'Set 2 “One too many”',
          errors: [`The built-ins are full (${BUILT_IN_SETS_MAX} sets). Delete some first.`],
        },
      ],
    });
    expect(after.sets).toHaveLength(BUILT_IN_SETS_MAX);
    expect(after.sets[0]!.title).toBe('Replaced');
  });

  it('fills category and difficulty from a "<topic> – <level>" title, as Import JSON does', () => {
    const { data: after } = importBuiltIns(data([]), [set('a', 'Animals – Hard')]);
    expect(after.sets[0]).toMatchObject({ category: 'Animals', difficulty: 'hard' });
  });
});

import { describe, expect, it } from 'vitest';
import {
  ANSWER_MAX,
  DEFAULT_POINTS,
  HOST_NOTES_MAX,
  MAX_QUESTIONS_PER_SET,
  POINTS_MAX,
  QUESTION_TEXT_MAX,
  SET_TITLE_MAX,
} from '../../../shared/constants.js';
import type { Question } from '../../../shared/types.js';
import {
  addQuestion,
  canAddQuestion,
  duplicateQuestion,
  moveQuestion,
  newQuestion,
  parsePoints,
  questionErrors,
  removeQuestion,
  titleError,
} from './setEditor.js';

function q(id: string, overrides: Partial<Question> = {}): Question {
  return { id, text: `Q ${id}`, answer: `A ${id}`, points: 100, ...overrides };
}

const ids = (questions: Question[]) => questions.map((question) => question.id);
const full = Array.from({ length: MAX_QUESTIONS_PER_SET }, (_, i) => q(`q${i}`));

describe('set editor edits', () => {
  it('a new question is empty and worth the default points', () => {
    expect(newQuestion('n')).toEqual({ id: 'n', text: '', answer: '', points: DEFAULT_POINTS });
  });

  it('adds a question at the end, up to the 100-question cap', () => {
    expect(ids(addQuestion([q('a')], 'n'))).toEqual(['a', 'n']);
    expect(canAddQuestion(full.slice(1))).toBe(true);
    expect(canAddQuestion(full)).toBe(false);
    expect(addQuestion(full, 'n')).toHaveLength(MAX_QUESTIONS_PER_SET);
  });

  it('moves a question up or down one place, and not past either end', () => {
    const list = [q('a'), q('b'), q('c')];
    expect(ids(moveQuestion(list, 1, -1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveQuestion(list, 1, 1))).toEqual(['a', 'c', 'b']);
    expect(ids(moveQuestion(list, 0, -1))).toEqual(['a', 'b', 'c']);
    expect(ids(moveQuestion(list, 2, 1))).toEqual(['a', 'b', 'c']);
  });

  it('duplicates a question right after the original under a new id', () => {
    const list = [q('a', { hostNotes: 'n' }), q('b')];
    const next = duplicateQuestion(list, 0, 'copy');
    expect(ids(next)).toEqual(['a', 'copy', 'b']);
    expect(next[1]).toEqual({ ...list[0], id: 'copy' });
  });

  it('refuses to duplicate at the cap', () => {
    expect(duplicateQuestion(full, 0, 'copy')).toHaveLength(MAX_QUESTIONS_PER_SET);
  });

  it('deletes only the question at the index', () => {
    expect(ids(removeQuestion([q('a'), q('b'), q('c')], 1))).toEqual(['a', 'c']);
  });
});

describe('set editor field checks', () => {
  it('a complete question has no errors', () => {
    expect(questionErrors(q('a', { hostNotes: 'Also: B' }))).toEqual({});
  });

  it('requires question text unless an image is present', () => {
    expect(questionErrors(q('a', { text: '  ' })).text).toBe(
      'Write the question, or add an image.',
    );
    expect(questionErrors(q('a', { text: '', imageId: 'img' })).text).toBeUndefined();
  });

  it('requires an answer', () => {
    expect(questionErrors(q('a', { answer: ' ' })).answer).toBe('The answer is required.');
  });

  it('applies the spec limits after trimming', () => {
    const errors = questionErrors(
      q('a', {
        text: 'x'.repeat(QUESTION_TEXT_MAX + 1),
        answer: 'x'.repeat(ANSWER_MAX + 1),
        hostNotes: 'x'.repeat(HOST_NOTES_MAX + 1),
      }),
    );
    expect(errors).toEqual({
      text: `Up to ${QUESTION_TEXT_MAX} characters.`,
      answer: `Up to ${ANSWER_MAX} characters.`,
      hostNotes: `Up to ${HOST_NOTES_MAX} characters.`,
    });
    expect(questionErrors(q('a', { text: ` ${'x'.repeat(QUESTION_TEXT_MAX)} ` }))).toEqual({});
  });

  it('requires a set title of at most 100 characters', () => {
    expect(titleError(' ')).toBe('The set needs a title.');
    expect(titleError('x'.repeat(SET_TITLE_MAX + 1))).toBe(`Up to ${SET_TITLE_MAX} characters.`);
    expect(titleError('Quiz')).toBeUndefined();
  });

  it('accepts points only as a whole number from 0 to 10000', () => {
    expect(parsePoints('250')).toEqual({ ok: true, points: 250 });
    expect(parsePoints('0')).toEqual({ ok: true, points: 0 });
    expect(parsePoints(String(POINTS_MAX))).toEqual({ ok: true, points: POINTS_MAX });
    for (const raw of ['', '-5', '2.5', '1e3', 'abc', String(POINTS_MAX + 1)]) {
      expect(parsePoints(raw)).toEqual({ ok: false });
    }
  });
});

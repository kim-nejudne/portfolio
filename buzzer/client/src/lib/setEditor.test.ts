import { describe, expect, it } from 'vitest';
import {
  ANSWER_MAX,
  CHOICE_TEXT_MAX,
  DEFAULT_POINTS,
  HOST_NOTES_MAX,
  MAX_QUESTIONS_PER_SET,
  POINTS_MAX,
  QUESTION_TEXT_MAX,
  SET_TITLE_MAX,
} from '../../../shared/constants.js';
import type { Question, QuestionSet } from '../../../shared/types.js';
import {
  addChoice,
  addQuestion,
  canAddChoice,
  canRemoveChoice,
  canAddQuestion,
  categoriesInUse,
  duplicateQuestion,
  moveQuestion,
  newQuestion,
  parsePoints,
  previewView,
  questionErrors,
  removeChoice,
  removeQuestion,
  reorderQuestions,
  setChoiceText,
  setCorrectChoice,
  setMode,
  setQuestionImage,
  titleError,
  unusedImageIds,
  withCategory,
  withDifficulty,
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

  it('a drag drop moves the dragged question to the place of the one it was dropped on', () => {
    const list = [q('a'), q('b'), q('c'), q('d')];
    expect(ids(reorderQuestions(list, 'a', 'c'))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(reorderQuestions(list, 'd', 'b'))).toEqual(['a', 'd', 'b', 'c']);
    expect(ids(reorderQuestions(list, 'b', 'b'))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(reorderQuestions(list, 'gone', 'b'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sets, replaces and clears the image of one question only', () => {
    const list = [q('a'), q('b', { imageId: 'img-b' })];
    expect(setQuestionImage(list, 'a', 'img-a')[0]).toEqual(q('a', { imageId: 'img-a' }));
    expect(setQuestionImage(list, 'b', 'img-new')[1]!.imageId).toBe('img-new');
    expect(setQuestionImage(list, 'b')[1]).toEqual(q('b'));
    expect(setQuestionImage(list, 'b')[1]).not.toHaveProperty('imageId');
    expect(setQuestionImage(list, 'gone', 'img-x')).toEqual(list);
  });

  it('an image no question uses any more is unused: removed, replaced or its question deleted', () => {
    const before = [q('a', { imageId: 'img-a' }), q('b', { imageId: 'img-b' }), q('c')];
    expect(unusedImageIds(before, before)).toEqual([]);
    expect(unusedImageIds(before, [q('a'), before[1]!, before[2]!])).toEqual(['img-a']);
    expect(unusedImageIds(before, [q('a', { imageId: 'img-new' }), before[1]!])).toEqual(['img-a']);
    expect(unusedImageIds(before, removeQuestion(before, 1))).toEqual(['img-b']);
  });

  it('an image a duplicated question still shares stays in use until both let go of it', () => {
    const before = duplicateQuestion([q('a', { imageId: 'img-a' })], 0, 'copy');
    expect(unusedImageIds(before, removeQuestion(before, 0))).toEqual([]);
    expect(unusedImageIds(before, [])).toEqual(['img-a']);
  });
});

describe('set editor preview', () => {
  const set: QuestionSet = {
    id: 's',
    title: 'Quiz',
    questions: [q('a', { hostNotes: 'Secret notes' }), q('b', { imageId: 'img', points: 300 })],
    createdAt: 1,
    updatedAt: 2,
    schemaVersion: 1,
  };

  it('shows the question as the Screen gets it when shown: number, count and buzzers locked', () => {
    const view = previewView(set, 1);
    expect(view).toMatchObject({ role: 'screen', phase: 'QUESTION', questionIndex: 1 });
    expect(view.questionCount).toBe(2);
    expect(view.question).toEqual({ id: 'b', text: 'Q b', imageId: 'img', points: 300 });
  });

  it('never carries the answer or host notes', () => {
    const json = JSON.stringify(previewView(set, 0));
    expect(json).not.toContain('A a');
    expect(json).not.toContain('Secret notes');
  });

  it('the reveal variant is the Screen at REVEAL: the answer, no notes and no scorer', () => {
    const view = previewView(set, 0, true);
    expect(view).toMatchObject({ phase: 'REVEAL', questionIndex: 0, scorerId: null, players: [] });
    expect(view.question).toEqual({ id: 'a', text: 'Q a', points: 100, answer: 'A a' });
    expect(JSON.stringify(view)).not.toContain('Secret notes');
  });
});

describe('set editor preview of a choice question (F86)', () => {
  const set: QuestionSet = {
    id: 's',
    title: 'Quiz',
    questions: [
      q('a', {
        mode: 'choice',
        choices: ['Paris', 'Rome', 'Oslo'],
        correctChoice: 2,
        answer: 'Oslo',
      }),
      q('b'),
    ],
    createdAt: 1,
    updatedAt: 2,
    schemaVersion: 1,
  };

  it('carries the choices without the correct one when shown', () => {
    const view = previewView(set, 0);
    expect(view.choice).toEqual({
      choices: ['Paris', 'Rome', 'Oslo'],
      answered: 0,
      expected: 0,
      timer: null,
    });
    expect(JSON.stringify(view)).not.toContain('correctChoice');
  });

  it('marks the correct choice, with no picks, in the reveal variant', () => {
    expect(previewView(set, 0, true).choice).toMatchObject({ correctChoice: 2, counts: [0, 0, 0] });
  });

  it('has no choice for a buzz question', () => {
    expect(previewView(set, 1).choice).toBeNull();
  });

  it('a typed question has progress with nobody answering, groups only in the reveal (F87)', () => {
    const typed: QuestionSet = {
      ...set,
      questions: [q('t', { mode: 'typed', answer: 'Lyon', hostNotes: 'Lugdunum' })],
    };
    const view = previewView(typed, 0);
    expect(view.typed).toEqual({ answered: 0, expected: 0, timer: null, closed: false });
    expect(JSON.stringify(view)).not.toContain('Lugdunum');
    expect(previewView(typed, 0, true).typed?.groups).toEqual([]);
    expect(previewView(set, 0).typed).toBeNull();
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

describe('category and difficulty', () => {
  const base: QuestionSet = {
    id: 's',
    title: 'Quiz',
    questions: [],
    createdAt: 1,
    updatedAt: 1,
    schemaVersion: 1,
  };

  it('withCategory keeps what was typed and drops a blank category', () => {
    expect(withCategory(base, 'Science ').category).toBe('Science ');
    const tagged = withCategory(base, 'Science');
    expect(withCategory(tagged, '   ')).toEqual(base);
    expect(withCategory(tagged, '')).not.toHaveProperty('category');
  });

  it('withDifficulty sets a level and None removes it', () => {
    const hard = withDifficulty(base, 'hard');
    expect(hard.difficulty).toBe('hard');
    expect(withDifficulty(hard, '')).toEqual(base);
  });

  it('categoriesInUse lists each saved category once, trimmed, alphabetically', () => {
    const sets = [
      { ...base, category: 'Science' },
      { ...base, category: ' animals ' },
      { ...base, category: 'science' },
      base,
      { ...base, category: '   ' },
    ];
    expect(categoriesInUse(sets)).toEqual(['animals', 'Science']);
  });
});

describe('choice questions in the editor', () => {
  const choice = (choices: string[], correctChoice?: number) =>
    q('a', {
      mode: 'choice',
      choices,
      answer: correctChoice === undefined ? '' : choices[correctChoice]!,
      ...(correctChoice === undefined ? {} : { correctChoice }),
    });

  it('switching to Choice starts with the answer as choice A, marked correct, and a blank B', () => {
    expect(setMode(q('a', { answer: 'Paris' }), 'choice')).toEqual(
      q('a', { answer: 'Paris', mode: 'choice', choices: ['Paris', ''], correctChoice: 0 }),
    );
  });

  it('switching to Buzz stores no mode and keeps the choices, which come back on Choice', () => {
    const asChoice = choice(['Lyon', 'Paris', 'Nice'], 1);
    const asBuzz = setMode(asChoice, 'buzz');
    expect(asBuzz).not.toHaveProperty('mode');
    expect(asBuzz.answer).toBe('Paris');
    expect(setMode(asBuzz, 'choice')).toEqual(asChoice);
  });

  it('keeps the answer equal to the correct choice as it is typed or re-marked', () => {
    const typed = setChoiceText(choice(['Lyon', 'Paris'], 1), 1, 'Paris, France');
    expect(typed).toMatchObject({ choices: ['Lyon', 'Paris, France'], answer: 'Paris, France' });
    expect(setChoiceText(typed, 0, 'Lille').answer).toBe('Paris, France');
    expect(setCorrectChoice(typed, 0)).toMatchObject({ correctChoice: 0, answer: 'Lyon' });
  });

  it('adds blank choices up to 4', () => {
    const three = addChoice(choice(['A', 'B'], 0));
    expect(three.choices).toEqual(['A', 'B', '']);
    const four = addChoice(three);
    expect(canAddChoice(four)).toBe(false);
    expect(addChoice(four)).toEqual(four);
  });

  it('removes choices down to 2, and the correct one keeps its mark as later ones move up', () => {
    const four = choice(['A', 'B', 'C', 'D'], 2);
    expect(removeChoice(four, 0)).toMatchObject({ choices: ['B', 'C', 'D'], correctChoice: 1 });
    expect(removeChoice(four, 3)).toMatchObject({ choices: ['A', 'B', 'C'], correctChoice: 2 });
    const two = choice(['A', 'B'], 0);
    expect(canRemoveChoice(two)).toBe(false);
    expect(removeChoice(two, 1)).toEqual(two);
  });

  it('removing the correct choice leaves none marked and no answer', () => {
    const removed = removeChoice(choice(['A', 'B', 'C'], 1), 1);
    expect(removed.choices).toEqual(['A', 'C']);
    expect(removed).not.toHaveProperty('correctChoice');
    expect(removed.answer).toBe('');
    expect(questionErrors(removed)).toEqual({ correctChoice: 'Pick the correct choice.' });
  });

  it('flags blank and over-long choices by letter, and never asks for a separate answer', () => {
    const errors = questionErrors(choice(['Paris', ' ', 'x'.repeat(CHOICE_TEXT_MAX + 1)], 0));
    expect(errors).toEqual({
      choice1: 'Write choice B.',
      choice2: `Up to ${CHOICE_TEXT_MAX} characters.`,
    });
    expect(questionErrors(choice(['', 'B'], 1))).toEqual({ choice0: 'Write choice A.' });
  });
});

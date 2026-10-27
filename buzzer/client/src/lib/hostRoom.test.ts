import { describe, expect, it } from 'vitest';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import type { Question, QuestionSet } from '../../../shared/types.js';
import { checkPlayable } from './hostRoom.js';

const good: Question = { id: 'q1', text: 'What?', answer: 'Yes', points: 100 };

function withQuestions(questions: Question[], title = 'Quiz'): QuestionSet {
  return { ...SAMPLE_SET, title, questions };
}

function errorOf(set: QuestionSet) {
  const checked = checkPlayable(set);
  return checked.ok ? null : checked.error;
}

describe('checkPlayable', () => {
  it('accepts a playable set and returns it trimmed', () => {
    const checked = checkPlayable(withQuestions([{ ...good, answer: '  Yes ' }]));
    expect(checked).toEqual({ ok: true, set: withQuestions([good]) });
  });

  it('says a set with no questions has none yet', () => {
    expect(errorOf(withQuestions([]))).toBe('This set has no questions yet.');
  });

  it('says a blank title needs a title', () => {
    expect(errorOf(withQuestions([good], '   '))).toBe('This set needs a title.');
  });

  it('names the question that has no answer', () => {
    const blank = { ...good, id: 'q2', answer: '' };
    expect(errorOf(withQuestions([good, blank]))).toBe('Question 2 needs an answer.');
  });

  it('names the question that has neither text nor image', () => {
    expect(errorOf(withQuestions([{ ...good, text: '' }]))).toBe(
      'Question 1 needs text or an image.',
    );
  });

  it('names the question and field for any other problem', () => {
    expect(errorOf(withQuestions([{ ...good, points: 1.5 }]))).toMatch(/^Question 1 \(points\): /);
  });
});

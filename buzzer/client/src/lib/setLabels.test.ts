import { describe, expect, it } from 'vitest';
import type { QuestionSet } from '../../../shared/types.js';
import { setDetail } from './setLabels.js';

const set = (difficulty?: QuestionSet['difficulty']): QuestionSet => ({
  schemaVersion: 1,
  id: 's',
  title: 'Quiz',
  difficulty,
  createdAt: 0,
  updatedAt: 0,
  questions: [{ id: 'q', text: 'Q?', answer: 'A', points: 100 }],
});

describe('setDetail joins at most two items with a dot (F160)', () => {
  it('reads the count and the level', () => {
    expect(setDetail(set('easy'))).toBe('1 question · Easy');
    expect(setDetail(set())).toBe('1 question');
  });

  it('puts "Not playable yet" in the level’s place on a draft', () => {
    expect(setDetail(set('hard'), false)).toBe('1 question · Not playable yet');
  });
});

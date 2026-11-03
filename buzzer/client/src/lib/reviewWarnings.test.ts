import { describe, expect, it } from 'vitest';
import { QUESTION_LONG_TEXT } from '../../../shared/constants.js';
import {
  foldText,
  isLongText,
  nearlySame,
  reviewWarnings,
  warningCount,
  type ReviewLevel,
} from './reviewWarnings.js';

const q = (id: string, text: string, answer: string) => ({ id, text, answer });
const lvl = (name: string, ...questions: ReturnType<typeof q>[]): ReviewLevel => ({
  name,
  questions,
});

describe('foldText', () => {
  it('trims and folds case, accents, punctuation and runs of spaces', () => {
    expect(foldText('  The   Nîle! ')).toBe('the nile');
    expect(foldText('São Paulo.')).toBe(foldText('sao paulo'));
    expect(foldText('Rock, paper; scissors?')).toBe('rock paper scissors');
  });

  it('folds punctuation-only text to empty', () => {
    expect(foldText(' ?! ')).toBe('');
  });
});

describe('nearlySame', () => {
  it('matches equal text', () => {
    expect(nearlySame('which river is longest', 'which river is longest')).toBe(true);
  });

  it('matches a text inside another when it is at least 80% of its length', () => {
    const long = 'which river is the longest'; // 26
    expect(nearlySame('which river is the longe', long)).toBe(true); // 24, 92%
    expect(nearlySame(long, 'river is the longest')).toBe(false); // 20, 77%
  });

  it('needs containment, not just similar length', () => {
    expect(nearlySame('which river is longest', 'which river is shortest')).toBe(false);
  });

  it('never matches empty text', () => {
    expect(nearlySame('', '')).toBe(false);
    expect(nearlySame('', 'a')).toBe(false);
  });
});

describe('isLongText', () => {
  it('flags text past QUESTION_LONG_TEXT characters, trimmed', () => {
    expect(isLongText('x'.repeat(QUESTION_LONG_TEXT))).toBe(false);
    expect(isLongText(`  ${'x'.repeat(QUESTION_LONG_TEXT)}  `)).toBe(false);
    expect(isLongText('x'.repeat(QUESTION_LONG_TEXT + 1))).toBe(true);
  });

  it('is 150 characters (screenQuestion.test.ts ties it to the Screen size step)', () => {
    expect(QUESTION_LONG_TEXT).toBe(150);
  });
});

describe('reviewWarnings', () => {
  it('names a repeated answer within the level by its number', () => {
    const level = lvl(
      'Easy',
      q('a', 'Longest river in Africa?', 'The Nile'),
      q('b', 'Which river flows through Cairo?', 'the nile.'),
      q('c', 'Which river forms the Grand Canyon?', 'Colorado'),
    );
    const warnings = reviewWarnings(level, []);
    expect(warnings.get('a')).toEqual(['Same answer as Q2']);
    expect(warnings.get('b')).toEqual(['Same answer as Q1']);
    expect(warnings.has('c')).toBe(false);
  });

  it('names a match in another level by that level and number', () => {
    const level = lvl('Easy', q('a', 'Longest river in Africa?', 'Nile'));
    const medium = lvl(
      'Medium',
      q('a', 'Which river flows through Baghdad?', 'Tigris'),
      q('b', 'Which river flows through Khartoum?', 'Nile'),
    );
    expect(reviewWarnings(level, [medium]).get('a')).toEqual(['Same answer as Medium Q2']);
  });

  it('lists every match, this level first', () => {
    const level = lvl(
      'Easy',
      q('a', 'One?', 'Nile'),
      q('b', 'Two?', 'Nile'),
      q('c', 'Three?', 'Nile'),
    );
    const hard = lvl('Hard', q('x', 'Four?', 'NILE'));
    expect(reviewWarnings(level, [hard]).get('a')).toEqual(['Same answer as Q2, Q3 and Hard Q1']);
  });

  it('never matches a question with itself, even when another level reuses its id', () => {
    const level = lvl('Easy', q('q1', 'Longest river in Africa?', 'Nile'));
    const medium = lvl('Medium', q('q1', 'Which river flows through Baghdad?', 'Tigris'));
    expect(reviewWarnings(level, [medium]).size).toBe(0);
  });

  it('flags the same question text after folding', () => {
    const level = lvl('Easy', q('a', 'Which river is the longest?', 'Nile'));
    const hard = lvl('Hard', q('x', 'which  river is the LONGEST', 'Amazon'));
    expect(reviewWarnings(level, [hard]).get('a')).toEqual(['Same question as Hard Q1']);
  });

  it('flags a question that holds another, or is held by one, at 80% of its length', () => {
    const level = lvl(
      'Easy',
      q('a', 'Which river is the longest in Africa?', 'Nile'),
      q('b', 'Which river is the longest in Africa today?', 'Still the Nile'),
      q('c', 'Which river?', 'Any'),
    );
    const warnings = reviewWarnings(level, []);
    expect(warnings.get('a')).toEqual(['Nearly the same question as Q2']);
    expect(warnings.get('b')).toEqual(['Nearly the same question as Q1']);
    // Contained, but far shorter.
    expect(warnings.has('c')).toBe(false);
  });

  it('does not match picture-only questions on their empty text', () => {
    const level = lvl('Easy', q('a', '', 'Nile'), q('b', '  ', 'Amazon'));
    expect(reviewWarnings(level, []).size).toBe(0);
  });

  it('does not match answers that fold to empty', () => {
    const level = lvl('Easy', q('a', 'First?', '?!'), q('b', 'Second?', '…'));
    expect(reviewWarnings(level, []).size).toBe(0);
  });

  it('flags long question text with its length', () => {
    const text = 'x'.repeat(QUESTION_LONG_TEXT + 30);
    const level = lvl('Easy', q('a', text, 'Nile'), q('b', 'y'.repeat(QUESTION_LONG_TEXT), 'Po'));
    const warnings = reviewWarnings(level, []);
    expect(warnings.get('a')).toEqual([
      `Long question (${QUESTION_LONG_TEXT + 30} characters): it shows small on the Screen`,
    ]);
    expect(warnings.has('b')).toBe(false);
  });

  it('only warns about the level under review, not the others', () => {
    const level = lvl('Easy', q('a', 'One?', 'Nile'));
    const medium = lvl('Medium', q('m', 'Two?', 'Po'), q('n', 'Three?', 'Po'));
    expect([...reviewWarnings(level, [medium]).keys()]).toEqual([]);
  });

  it('counts every line', () => {
    const level = lvl(
      'Easy',
      q('a', 'Which river is the longest?', 'Nile'),
      q('b', 'Which river is the longest?', 'Nile'),
    );
    const warnings = reviewWarnings(level, []);
    expect(warnings.get('a')).toEqual(['Same answer as Q2', 'Same question as Q2']);
    expect(warningCount(warnings)).toBe(4);
  });
});

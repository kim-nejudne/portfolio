import { describe, expect, it } from 'vitest';
import {
  ANSWER_MAX,
  DEFAULT_POINTS,
  MAX_QUESTIONS_PER_SET,
  QUESTION_TEXT_MAX,
} from '../../../shared/constants.js';
import type { Question } from '../../../shared/types.js';
import {
  addPasted,
  MISSING_ANSWER,
  MISSING_QUESTION,
  parsePaste,
  PIPE_IN_TAB_PASTE,
  TOO_MANY_CELLS,
} from './bulkPaste.js';
import { POINTS_ERROR } from './setEditor.js';

function existing(count: number): Question[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i}`,
    text: `Q${i}`,
    answer: `A${i}`,
    points: 100,
  }));
}

describe('parsePaste', () => {
  it('reads Question | Answer | points lines, points defaulting to 100', () => {
    const parsed = parsePaste('Capital of France? | Paris | 200\nLargest planet? | Jupiter');
    expect(parsed.questions).toEqual([
      { line: 1, text: 'Capital of France?', answer: 'Paris', points: 200 },
      { line: 2, text: 'Largest planet?', answer: 'Jupiter', points: DEFAULT_POINTS },
    ]);
    expect(parsed.bad).toEqual([]);
  });

  it('reads tab-separated cells from a spreadsheet, with Windows line ends', () => {
    const parsed = parsePaste('Who wrote Hamlet?\tShakespeare\t300\r\n2 + 2?\t4\t\r\n');
    expect(parsed.questions).toEqual([
      { line: 1, text: 'Who wrote Hamlet?', answer: 'Shakespeare', points: 300 },
      { line: 2, text: '2 + 2?', answer: '4', points: DEFAULT_POINTS },
    ]);
  });

  it('keeps a pipe inside a spreadsheet cell, since tabs decide the format', () => {
    const parsed = parsePaste('Which key is | ?\tPipe\t100');
    expect(parsed.questions).toEqual([
      { line: 1, text: 'Which key is | ?', answer: 'Pipe', points: 100 },
    ]);
  });

  it('trims stray spaces and skips blank lines, keeping the line numbers', () => {
    const parsed = parsePaste('\n   \n  Spaced out?   |   Yes   |  50  \n\n');
    expect(parsed.questions).toEqual([{ line: 3, text: 'Spaced out?', answer: 'Yes', points: 50 }]);
    expect(parsed.bad).toEqual([]);
  });

  it('unquotes spreadsheet cells: doubled quotes, a tab, and a line break inside quotes', () => {
    const parsed = parsePaste(
      '"Who said ""Hi""?"\tBob\t100\n"Two\nlines"\t"a\tb"\t200\nNext?\tYes\t',
    );
    expect(parsed.questions).toEqual([
      { line: 1, text: 'Who said "Hi"?', answer: 'Bob', points: 100 },
      { line: 2, text: 'Two lines', answer: 'a\tb', points: 200 },
      { line: 4, text: 'Next?', answer: 'Yes', points: DEFAULT_POINTS },
    ]);
  });

  it('unquotes a quoted cell in the pipe format too, and keeps a quote that does not wrap a cell', () => {
    const parsed = parsePaste(
      '"A | B?" | "C" | 100\n"To be" is from which play? | Hamlet\nHe said "no" | ok',
    );
    expect(parsed.questions).toEqual([
      { line: 1, text: 'A | B?', answer: 'C', points: 100 },
      { line: 2, text: '"To be" is from which play?', answer: 'Hamlet', points: DEFAULT_POINTS },
      { line: 3, text: 'He said "no"', answer: 'ok', points: DEFAULT_POINTS },
    ]);
  });

  it('an unclosed quote is read literally to the end of its line', () => {
    const parsed = parsePaste('"Open quote? | Yes\nNext? | No');
    expect(parsed.questions).toEqual([
      { line: 1, text: '"Open quote?', answer: 'Yes', points: DEFAULT_POINTS },
      { line: 2, text: 'Next?', answer: 'No', points: DEFAULT_POINTS },
    ]);
  });

  it('lists each bad line with its reasons', () => {
    const long = 'x'.repeat(QUESTION_TEXT_MAX + 1);
    const longAnswer = 'y'.repeat(ANSWER_MAX + 1);
    const parsed = parsePaste(
      [
        'No answer here',
        'Empty answer? |   | 100',
        ' | Orphan answer',
        `${long} | ok`,
        `ok? | ${longAnswer}`,
        'Half? | yes | 12.5',
        'Words? | yes | lots',
        'Negative? | yes | -5',
        'Huge? | yes | 10001',
        'Extra? | yes | 100 | notes',
        'Fine? | yes',
      ].join('\n'),
    );
    expect(parsed.questions).toEqual([
      { line: 11, text: 'Fine?', answer: 'yes', points: DEFAULT_POINTS },
    ]);
    expect(parsed.bad).toEqual([
      { line: 1, source: 'No answer here', reasons: [MISSING_ANSWER] },
      { line: 2, source: 'Empty answer? |   | 100', reasons: [MISSING_ANSWER] },
      { line: 3, source: ' | Orphan answer', reasons: [MISSING_QUESTION] },
      {
        line: 4,
        source: `${long} | ok`,
        reasons: [`The question is over ${QUESTION_TEXT_MAX} characters.`],
      },
      {
        line: 5,
        source: `ok? | ${longAnswer}`,
        reasons: [`The answer is over ${ANSWER_MAX} characters.`],
      },
      { line: 6, source: 'Half? | yes | 12.5', reasons: [POINTS_ERROR] },
      { line: 7, source: 'Words? | yes | lots', reasons: [POINTS_ERROR] },
      { line: 8, source: 'Negative? | yes | -5', reasons: [POINTS_ERROR] },
      { line: 9, source: 'Huge? | yes | 10001', reasons: [POINTS_ERROR] },
      { line: 10, source: 'Extra? | yes | 100 | notes', reasons: [TOO_MANY_CELLS] },
    ]);
  });

  it('gives every reason a line has', () => {
    const parsed = parsePaste(` | | x`);
    expect(parsed.bad).toEqual([
      { line: 1, source: ' | | x', reasons: [MISSING_QUESTION, MISSING_ANSWER, POINTS_ERROR] },
    ]);
  });

  it('reads a paste mixing both formats as cells, and says why a pipe line was skipped', () => {
    const parsed = parsePaste('Sheet?\tYes\nTyped? | No\nStray tab? | ok |\t');
    expect(parsed.questions).toEqual([
      { line: 1, text: 'Sheet?', answer: 'Yes', points: DEFAULT_POINTS },
    ]);
    expect(parsed.bad).toEqual([
      { line: 2, source: 'Typed? | No', reasons: [MISSING_ANSWER, PIPE_IN_TAB_PASTE] },
      { line: 3, source: 'Stray tab? | ok |\t', reasons: [MISSING_ANSWER, PIPE_IN_TAB_PASTE] },
    ]);
  });

  it('ignores empty trailing cells from a wider spreadsheet selection', () => {
    const parsed = parsePaste('Wide?\tYes\t100\t\t\n');
    expect(parsed.questions).toEqual([{ line: 1, text: 'Wide?', answer: 'Yes', points: 100 }]);
    expect(parsed.bad).toEqual([]);
  });

  it('a multi-line quoted cell is reported on the line it starts', () => {
    const parsed = parsePaste('"Two\nlines"\t\t100');
    expect(parsed.bad).toEqual([
      { line: 1, source: '"Two\nlines"\t\t100', reasons: [MISSING_ANSWER] },
    ]);
  });

  it('reads nothing from an empty paste', () => {
    expect(parsePaste('')).toEqual({ questions: [], bad: [] });
    expect(parsePaste(' \n\t\n')).toEqual({ questions: [], bad: [] });
  });
});

describe('addPasted', () => {
  const pasted = parsePaste('One? | 1\nTwo? | 2 | 200\nThree? | 3').questions;

  it('appends the good questions with fresh ids after the existing ones', () => {
    let n = 0;
    const next = addPasted(existing(2), pasted, () => `new${n++}`);
    expect(next).toEqual([
      ...existing(2),
      { id: 'new0', text: 'One?', answer: '1', points: 100 },
      { id: 'new1', text: 'Two?', answer: '2', points: 200 },
      { id: 'new2', text: 'Three?', answer: '3', points: 100 },
    ]);
  });

  it('adds only as many as fit within the 100-question limit', () => {
    const start = existing(MAX_QUESTIONS_PER_SET - 2);
    const next = addPasted(start, pasted);
    expect(next).toHaveLength(MAX_QUESTIONS_PER_SET);
    expect(next.slice(-2).map((q) => q.text)).toEqual(['One?', 'Two?']);
    expect(new Set(next.map((q) => q.id)).size).toBe(MAX_QUESTIONS_PER_SET);
    expect(addPasted(existing(MAX_QUESTIONS_PER_SET), pasted)).toEqual(
      existing(MAX_QUESTIONS_PER_SET),
    );
  });
});

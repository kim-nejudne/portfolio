// **Paste questions** in the set editor (Set editor `/sets/:setId`): one question per line as
// `Question | Answer | points`, or tab-separated cells pasted from a spreadsheet.

import { nanoid } from 'nanoid';
import {
  ANSWER_MAX,
  DEFAULT_POINTS,
  MAX_QUESTIONS_PER_SET,
  QUESTION_TEXT_MAX,
} from '../../../shared/constants.js';
import type { Question } from '../../../shared/types.js';
import { parsePoints, POINTS_ERROR } from './setEditor.js';

export const MISSING_QUESTION = 'The question is missing.';
export const MISSING_ANSWER = 'The answer is missing.';
export const TOO_MANY_CELLS = 'Too many cells. Use Question | Answer | points.';
export const PIPE_IN_TAB_PASTE = "This paste has tabs, so | doesn't split cells.";

/** A good line, numbered from 1 by where it starts in the paste. */
export interface PastedQuestion {
  line: number;
  text: string;
  answer: string;
  points: number;
}

/** A line that adds nothing, as it was pasted, with every reason. */
export interface BadLine {
  line: number;
  source: string;
  reasons: string[];
}

export interface ParsedPaste {
  questions: PastedQuestion[];
  bad: BadLine[];
}

interface Row {
  line: number;
  source: string;
  cells: string[];
}

const isLineEnd = (char: string | undefined) => char === '\n' || char === '\r';

/**
 * Splits the paste into rows of cells. A cell that starts with a quote and closes with one right
 * before its delimiter or the line end is a spreadsheet's quoted cell: `""` is a quote, and it may
 * hold the delimiter or a line break. Any other quote is plain text.
 */
function rows(text: string, delimiter: string): Row[] {
  const out: Row[] = [];
  let i = 0;
  let line = 1;
  while (i < text.length) {
    const start = i;
    const startLine = line;
    const cells: string[] = [];
    for (;;) {
      let j = i;
      while (text[j] === ' ') j++;
      const quoted = text[j] === '"' ? readQuoted(text, j + 1, delimiter) : null;
      if (quoted) {
        cells.push(quoted.value);
        line += quoted.lineBreaks;
        i = quoted.end;
      } else {
        let end = i;
        while (end < text.length && text[end] !== delimiter && !isLineEnd(text[end])) end++;
        cells.push(text.slice(i, end));
        i = end;
      }
      if (text[i] !== delimiter) break;
      i++;
    }
    const source = text.slice(start, i);
    if (text[i] === '\r' && text[i + 1] === '\n') i++;
    if (i < text.length) {
      i++;
      line++;
    }
    out.push({ line: startLine, source, cells });
  }
  return out;
}

/** The quoted cell whose text starts at `from`, or null when its quotes do not wrap the cell. */
function readQuoted(text: string, from: number, delimiter: string) {
  let value = '';
  for (let i = from; i < text.length; i++) {
    if (text[i] !== '"') {
      value += text[i];
      continue;
    }
    if (text[i + 1] === '"') {
      value += '"';
      i++;
      continue;
    }
    let end = i + 1;
    while (text[end] === ' ') end++;
    if (end < text.length && text[end] !== delimiter && !isLineEnd(text[end])) return null;
    const lineBreaks = value.match(/\r\n|\n|\r/g)?.length ?? 0;
    // A line break inside a cell becomes a space: answers are one line, and so is a pasted question.
    return { value: value.replace(/\s*(\r\n|\n|\r)\s*/g, ' '), end, lineBreaks };
  }
  return null;
}

function reasonsFor(text: string, answer: string, points: string): string[] {
  const reasons: string[] = [];
  if (text === '') reasons.push(MISSING_QUESTION);
  else if (text.length > QUESTION_TEXT_MAX) {
    reasons.push(`The question is over ${QUESTION_TEXT_MAX} characters.`);
  }
  if (answer === '') reasons.push(MISSING_ANSWER);
  else if (answer.length > ANSWER_MAX) reasons.push(`The answer is over ${ANSWER_MAX} characters.`);
  if (points !== '' && !parsePoints(points).ok) reasons.push(POINTS_ERROR);
  return reasons;
}

/**
 * Reads a paste. Any tab makes it a spreadsheet paste, read by tabs; otherwise cells split on `|`.
 * Cells are trimmed, blank lines and empty trailing cells are skipped, and blank points are 100.
 */
export function parsePaste(text: string): ParsedPaste {
  const parsed: ParsedPaste = { questions: [], bad: [] };
  // SPEC-QUESTION: the spec doesn't say how a paste mixing both formats is read (DECISIONS F79).
  const tabs = text.includes('\t');
  for (const { line, source, cells: raw } of rows(text, tabs ? '\t' : '|')) {
    const cells = raw.map((cell) => cell.trim());
    while (cells.at(-1) === '') cells.pop();
    if (cells.length === 0) continue;
    if (cells.length > 3) {
      parsed.bad.push({ line, source, reasons: [TOO_MANY_CELLS] });
      continue;
    }
    const [questionText = '', answer = '', points = ''] = cells;
    const reasons = reasonsFor(questionText, answer, points);
    if (reasons.length > 0 && tabs && cells.length === 1 && questionText.includes('|')) {
      reasons.push(PIPE_IN_TAB_PASTE);
    }
    if (reasons.length > 0) {
      parsed.bad.push({ line, source, reasons });
      continue;
    }
    const value = points === '' ? DEFAULT_POINTS : Number(points);
    parsed.questions.push({ line, text: questionText, answer, points: value });
  }
  return parsed;
}

/** How many pasted questions still fit in a set with `count` questions. */
export function pasteRoom(count: number): number {
  return Math.max(0, MAX_QUESTIONS_PER_SET - count);
}

/** Appends the pasted questions with fresh ids, as many as fit within the question limit. */
export function addPasted(
  questions: readonly Question[],
  pasted: readonly PastedQuestion[],
  makeId: () => string = nanoid,
): Question[] {
  const added = pasted
    .slice(0, pasteRoom(questions.length))
    .map(({ text, answer, points }): Question => ({ id: makeId(), text, answer, points }));
  return [...questions, ...added];
}

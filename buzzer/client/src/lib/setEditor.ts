// Pure edits and field checks for the set editor (Set editor `/sets/:setId`). Drafts may break these
// rules and are still saved (DECISIONS F02); the errors only tell the host what to fix.

import { nanoid } from 'nanoid';
import {
  ANSWER_MAX,
  DEFAULT_POINTS,
  HOST_NOTES_MAX,
  MAX_QUESTIONS_PER_SET,
  POINTS_MAX,
  POINTS_MIN,
  QUESTION_TEXT_MAX,
  SET_TITLE_MAX,
} from '../../../shared/constants.js';
import type { Question } from '../../../shared/types.js';

export type QuestionField = 'text' | 'answer' | 'hostNotes';
export type QuestionErrors = Partial<Record<QuestionField, string>>;

export const QUESTION_CAP_MESSAGE = `A set holds up to ${MAX_QUESTIONS_PER_SET} questions.`;
export const POINTS_ERROR = `Points must be a whole number from ${POINTS_MIN} to ${POINTS_MAX}.`;

export function newQuestion(id = nanoid()): Question {
  return { id, text: '', answer: '', points: DEFAULT_POINTS };
}

export function canAddQuestion(questions: readonly Question[]): boolean {
  return questions.length < MAX_QUESTIONS_PER_SET;
}

export function addQuestion(questions: readonly Question[], id = nanoid()): Question[] {
  return canAddQuestion(questions) ? [...questions, newQuestion(id)] : [...questions];
}

/** Moves the question at `index` one place up (-1) or down (+1); no change at either end. */
export function moveQuestion(questions: readonly Question[], index: number, delta: -1 | 1) {
  const target = index + delta;
  const next = [...questions];
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Inserts a copy with a fresh id right after the original. Refused at the cap. */
export function duplicateQuestion(
  questions: readonly Question[],
  index: number,
  id = nanoid(),
): Question[] {
  const source = questions[index];
  const next = [...questions];
  if (!source || !canAddQuestion(questions)) return next;
  next.splice(index + 1, 0, { ...source, id });
  return next;
}

export function removeQuestion(questions: readonly Question[], index: number): Question[] {
  return questions.filter((_, i) => i !== index);
}

function tooLong(value: string, max: number): string | undefined {
  return value.length > max ? `Up to ${max} characters.` : undefined;
}

/** The inline errors for one question card, after trimming as play would. */
export function questionErrors(question: Question): QuestionErrors {
  const errors: QuestionErrors = {};
  const text = question.text.trim();
  const answer = question.answer.trim();

  if (text.length === 0 && question.imageId === undefined) {
    errors.text = 'Write the question, or add an image.';
  } else {
    const long = tooLong(text, QUESTION_TEXT_MAX);
    if (long) errors.text = long;
  }

  if (answer.length === 0) errors.answer = 'The answer is required.';
  else {
    const long = tooLong(answer, ANSWER_MAX);
    if (long) errors.answer = long;
  }

  const notes = tooLong((question.hostNotes ?? '').trim(), HOST_NOTES_MAX);
  if (notes) errors.hostNotes = notes;
  return errors;
}

export function titleError(title: string): string | undefined {
  const trimmed = title.trim();
  if (trimmed.length === 0) return 'The set needs a title.';
  return tooLong(trimmed, SET_TITLE_MAX);
}

/** Reads the points field. Anything but a whole number in range is refused and not saved. */
export function parsePoints(raw: string): { ok: true; points: number } | { ok: false } {
  if (!/^\d+$/.test(raw.trim())) return { ok: false };
  const points = Number(raw.trim());
  return points >= POINTS_MIN && points <= POINTS_MAX ? { ok: true, points } : { ok: false };
}

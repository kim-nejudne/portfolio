// Labels for a saved set on the set list, the pickers and the set editor.

import type { Difficulty, QuestionSet } from '../../../shared/types.js';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/** "1 question", "10 questions". */
export function questionCount(count: number): string {
  return `${count} ${count === 1 ? 'question' : 'questions'}`;
}

/** A set's last-edited time in the browser's locale, for example "28 Oct 2026, 14:05". */
export function formatEdited(updatedAt: number): string {
  return new Date(updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * A picker row's line: "15 questions · Easy", or "15 questions · Not playable yet" for a draft.
 * Never more than two items on a dot (F160).
 */
export function setDetail(set: QuestionSet, playable = true): string {
  const second = playable
    ? set.difficulty && DIFFICULTY_LABELS[set.difficulty]
    : 'Not playable yet';
  return [questionCount(set.questions.length), second].filter(Boolean).join(' · ');
}

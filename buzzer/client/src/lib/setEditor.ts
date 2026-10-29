// Pure edits and field checks for the set editor (Set editor `/sets/:setId`). Drafts may break these
// rules and are still saved (DECISIONS F02); the errors only tell the host what to fix.

import { nanoid } from 'nanoid';
import {
  ANSWER_MAX,
  CHOICE_LETTERS,
  CHOICE_TEXT_MAX,
  CHOICES_MAX,
  CHOICES_MIN,
  DEFAULT_POINTS,
  DEFAULT_SETTINGS,
  HOST_NOTES_MAX,
  MAX_QUESTIONS_PER_SET,
  POINTS_MAX,
  POINTS_MIN,
  QUESTION_TEXT_MAX,
  SET_TITLE_MAX,
} from '../../../shared/constants.js';
import type {
  Difficulty,
  Question,
  QuestionMode,
  QuestionSet,
  ScreenView,
} from '../../../shared/types.js';

/** `choice0`…`choice3` are the choice fields of a choice question. */
export type QuestionField = 'text' | 'answer' | 'hostNotes' | 'correctChoice' | `choice${number}`;
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

/** A drag drop: moves the question `activeId` to where `overId` is. Unknown ids change nothing. */
export function reorderQuestions(
  questions: readonly Question[],
  activeId: string,
  overId: string,
): Question[] {
  const from = questions.findIndex((q) => q.id === activeId);
  const to = questions.findIndex((q) => q.id === overId);
  const next = [...questions];
  if (from === -1 || to === -1 || from === to) return next;
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/**
 * **Preview**: the Screen's view of question `index` just after it is shown, with buzzers locked
 * and nobody in the room. It carries no answer or host notes, as the Screen gets none before reveal.
 * With `reveal`, it is the Screen's REVEAL view instead: the answer, still no notes, and no scorer.
 */
export function previewView(set: QuestionSet, index: number, reveal = false): ScreenView {
  const source = set.questions[index];
  return {
    role: 'screen',
    code: '',
    title: set.title,
    phase: reveal ? 'REVEAL' : 'QUESTION',
    questionIndex: index,
    questionCount: set.questions.length,
    openingCounter: 0,
    players: [],
    winnerId: null,
    alsoBuzzed: [],
    lockedOut: [],
    falseStarts: [],
    session: null,
    teams: null,
    showScoreboard: false,
    settings: DEFAULT_SETTINGS,
    canJudge: false,
    canUndo: false,
    canChangeTeams: reveal,
    scorerId: null,
    answerTimer: null,
    buzzTimer: null,
    nextImageId: null,
    category: null,
    difficulty: null,
    hostDevices: 0,
    question: source
      ? {
          id: source.id,
          text: source.text,
          points: source.points,
          ...(source.imageId === undefined ? {} : { imageId: source.imageId }),
          ...(reveal ? { answer: source.answer } : {}),
        }
      : null,
  };
}

export function removeQuestion(questions: readonly Question[], index: number): Question[] {
  return questions.filter((_, i) => i !== index);
}

/** Sets, replaces or (with no `imageId`) clears the image of question `id`. */
export function setQuestionImage(
  questions: readonly Question[],
  id: string,
  imageId?: string,
): Question[] {
  return questions.map((question) => {
    if (question.id !== id) return question;
    if (imageId !== undefined) return { ...question, imageId };
    const next = { ...question };
    delete next.imageId;
    return next;
  });
}

/**
 * The images `before` referenced that no question in `after` does: a removed or replaced image, or
 * one whose question was deleted. A duplicated question shares its original's image, so that image
 * stays while either still uses it.
 */
export function unusedImageIds(before: readonly Question[], after: readonly Question[]): string[] {
  const kept = new Set(after.flatMap((q) => (q.imageId === undefined ? [] : [q.imageId])));
  const dropped = before.flatMap((q) =>
    q.imageId === undefined || kept.has(q.imageId) ? [] : [q.imageId],
  );
  return [...new Set(dropped)];
}

/**
 * Changes a question's mode (Buzz is stored as no mode). Choice starts from the answer as choice A,
 * marked correct, and a blank B. Leaving Choice keeps the choices in the draft, so switching back
 * brings them back; play drops them from a question that is not a choice question (DECISIONS F84).
 */
export function setMode(question: Question, mode: QuestionMode): Question {
  const next = { ...question };
  if (mode === 'buzz') delete next.mode;
  else next.mode = mode;
  if (mode !== 'choice') return next;
  if (question.choices === undefined) return withChoices(next, [question.answer, ''], 0);
  return withChoices(next, question.choices, question.correctChoice);
}

/** Choices and the correct one, with `answer` kept equal to the correct choice's text. */
function withChoices(
  question: Question,
  choices: string[],
  correctChoice: number | undefined,
): Question {
  const next: Question = { ...question, choices, answer: '' };
  delete next.correctChoice;
  if (correctChoice === undefined) return next;
  return { ...next, correctChoice, answer: choices[correctChoice] ?? '' };
}

export function setChoiceText(question: Question, index: number, text: string): Question {
  const choices = (question.choices ?? []).map((choice, i) => (i === index ? text : choice));
  return withChoices(question, choices, question.correctChoice);
}

export function setCorrectChoice(question: Question, index: number): Question {
  return withChoices(question, question.choices ?? [], index);
}

export function canAddChoice(question: Question): boolean {
  return (question.choices?.length ?? 0) < CHOICES_MAX;
}

export function canRemoveChoice(question: Question): boolean {
  return (question.choices?.length ?? 0) > CHOICES_MIN;
}

/** Appends a blank choice, up to 4. */
export function addChoice(question: Question): Question {
  if (!canAddChoice(question)) return question;
  return withChoices(question, [...(question.choices ?? []), ''], question.correctChoice);
}

/**
 * Removes a choice, down to 2. The correct one keeps its mark as later choices move up; removing
 * the correct choice leaves none marked, for the host to pick again.
 */
export function removeChoice(question: Question, index: number): Question {
  if (!canRemoveChoice(question)) return question;
  const choices = question.choices!.filter((_, i) => i !== index);
  const correct = question.correctChoice;
  if (correct === undefined || correct === index) return withChoices(question, choices, undefined);
  return withChoices(question, choices, correct > index ? correct - 1 : correct);
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

  if (question.mode === 'choice') {
    for (const [index, choice] of (question.choices ?? []).entries()) {
      const trimmed = choice.trim();
      const error =
        trimmed.length === 0
          ? `Write choice ${CHOICE_LETTERS[index]}.`
          : tooLong(trimmed, CHOICE_TEXT_MAX);
      if (error) errors[`choice${index}`] = error;
    }
    if (question.correctChoice === undefined) errors.correctChoice = 'Pick the correct choice.';
  } else if (answer.length === 0) errors.answer = 'The answer is required.';
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

/** The set with the typed category, or without one when the field is blank. */
export function withCategory(set: QuestionSet, category: string): QuestionSet {
  if (category.trim() !== '') return { ...set, category };
  const rest = { ...set };
  delete rest.category;
  return rest;
}

/** The set with a difficulty, or without one for None (''). */
export function withDifficulty(set: QuestionSet, difficulty: Difficulty | ''): QuestionSet {
  if (difficulty !== '') return { ...set, difficulty };
  const rest = { ...set };
  delete rest.difficulty;
  return rest;
}

/** The categories saved sets already use, each once ignoring case (the first spelling wins), A–Z. */
export function categoriesInUse(sets: readonly QuestionSet[]): string[] {
  const byKey = new Map<string, string>();
  for (const { category } of sets) {
    const trimmed = category?.trim();
    if (trimmed && !byKey.has(trimmed.toLowerCase())) byKey.set(trimmed.toLowerCase(), trimmed);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/** Reads the points field. Anything but a whole number in range is refused and not saved. */
export function parsePoints(raw: string): { ok: true; points: number } | { ok: false } {
  if (!/^\d+$/.test(raw.trim())) return { ok: false };
  const points = Number(raw.trim());
  return points >= POINTS_MIN && points <= POINTS_MAX ? { ok: true, points } : { ok: false };
}

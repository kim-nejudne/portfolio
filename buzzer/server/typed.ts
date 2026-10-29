// Typed answers (F87): grouping by normalised text and pre-marking against the accepted answers.
// Pure helpers shared by the reducer (scoring) and the views (groups).

import type { Question, Room, TypedAnswers } from '../shared/types.js';

/** A group of players whose answers normalise alike, as the reducer and views see it. */
export interface Group {
  key: string;
  text: string;
  playerIds: string[];
  preMarked: boolean;
  correct: boolean;
}

/**
 * The key two answers share when they should count as the same: case, accents and spacing are
 * ignored, so "  Beyoncé " and "beyonce" match. Punctuation still counts.
 */
export function normaliseAnswer(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The keys a typed question accepts: its answer, and each line of its host notes. */
export function acceptedKeys(question: Question): Set<string> {
  const lines = [question.answer, ...(question.hostNotes ?? '').split('\n')];
  return new Set(lines.map(normaliseAnswer).filter((key) => key.length > 0));
}

/**
 * A group's verdict: the host's mark when there is one, else its pre-mark. Own keys only, so an
 * answer like "constructor" never reads a value off the object's prototype.
 */
export function isCorrectKey(typed: TypedAnswers, accepted: Set<string>, key: string): boolean {
  return Object.hasOwn(typed.marks, key) ? typed.marks[key] === true : accepted.has(key);
}

/**
 * The current typed question's answers in groups, largest first, then by key. Answers of players
 * no longer in the room are left out. A group's `text` is its commonest spelling, the first in
 * alphabetical order on a tie.
 */
export function typedGroups(room: Room): Group[] {
  const question = room.set.questions[room.questionIndex];
  const { typed } = room;
  if (!question || !typed) return [];
  const accepted = acceptedKeys(question);
  const byKey = new Map<string, { playerIds: string[]; spellings: Map<string, number> }>();
  for (const [playerId, text] of Object.entries(typed.answers)) {
    if (!room.players[playerId]) continue;
    const key = normaliseAnswer(text);
    const group = byKey.get(key) ?? { playerIds: [], spellings: new Map<string, number>() };
    group.playerIds.push(playerId);
    group.spellings.set(text, (group.spellings.get(text) ?? 0) + 1);
    byKey.set(key, group);
  }
  return [...byKey.entries()]
    .map(([key, { playerIds, spellings }]) => ({
      key,
      text: commonest(spellings),
      playerIds,
      preMarked: accepted.has(key),
      correct: isCorrectKey(typed, accepted, key),
    }))
    .sort((a, b) => b.playerIds.length - a.playerIds.length || compare(a.key, b.key));
}

function commonest(spellings: Map<string, number>): string {
  return [...spellings.entries()].sort((a, b) => b[1] - a[1] || compare(a[0], b[0]))[0]![0];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

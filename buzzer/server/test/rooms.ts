// Fixtures shared by the server tests. Not imported by production code, and left out of the build.

import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import type { Player, Question, QuestionSet, Room } from '../../shared/types.js';
import { createRoom } from '../room.js';

export const T0 = 1_800_000_000_000;

export function makeQuestion(n: number, overrides: Partial<Question> = {}): Question {
  return {
    id: `q${n}`,
    text: `Question ${n} text`,
    answer: `Answer-${n}-secret`,
    hostNotes: `Notes-${n}-secret`,
    points: 100,
    ...overrides,
  };
}

export function makeSet(questionCount = 3): QuestionSet {
  return {
    id: 'set1',
    title: 'Pub Quiz',
    questions: Array.from({ length: questionCount }, (_, i) => makeQuestion(i + 1)),
    createdAt: T0,
    updatedAt: T0,
    schemaVersion: 1,
  };
}

export function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    ...createRoom({
      code: 'ABCD',
      hostTokenHash: 'host-token-hash-secret',
      set: makeSet(),
      settings: DEFAULT_SETTINGS,
      now: T0,
    }),
    ...overrides,
  };
}

export function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    color: '#EF4444',
    score: 0,
    connected: true,
    rttMs: 0,
    joinedAt: T0,
    joinedAtOpening: 0,
    team: null,
    ...overrides,
  };
}

/** A room whose players are keyed by id, as the reducer stores them. */
export function withPlayers(room: Room, players: Player[]): Room {
  return { ...room, players: Object.fromEntries(players.map((p) => [p.id, p])) };
}

/**
 * A category board set (F89): `columns` columns of 3 questions, Easy, Medium, Hard at 100, 200
 * and 300 points. Column c holds q(3c+1) to q(3c+3); `offBoard` more questions follow, on no tile.
 */
export function makeBoardSet(columns = 2, offBoard = 0): QuestionSet {
  const onBoard = columns * 3;
  return {
    ...makeSet(onBoard + offBoard),
    questions: Array.from({ length: onBoard + offBoard }, (_, i) =>
      makeQuestion(i + 1, { points: i < onBoard ? ((i % 3) + 1) * 100 : 100 }),
    ),
    board: {
      columns: Array.from({ length: columns }, (_, c) => ({
        title: `Category ${c + 1}`,
        questionIds: [`q${3 * c + 1}`, `q${3 * c + 2}`, `q${3 * c + 3}`],
      })),
    },
  };
}

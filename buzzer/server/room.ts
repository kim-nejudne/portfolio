import type { QuestionSet, Room, RoomSettings } from '../shared/types.js';

export interface NewRoom {
  code: string;
  hostTokenHash: string;
  set: QuestionSet;
  settings: RoomSettings;
  /** Wall-clock ms (`Date.now`), so the sweeper can compare `lastActivityAt`. */
  now: number;
}

/** A fresh room in LOBBY with no players. Pure: the code and token hash come from the caller. */
export function createRoom({ code, hostTokenHash, set, settings, now }: NewRoom): Room {
  return {
    code,
    hostTokenHash,
    set,
    settings: { ...settings },
    players: {},
    kickedIds: [],
    phase: 'LOBBY',
    questionIndex: -1,
    openingCounter: 0,
    buzzes: [],
    windowStartedAt: null,
    winnerId: null,
    lockedOut: [],
    judgements: [],
    reopenAt: null,
    undo: null,
    answerTimer: null,
    showScoreboard: false,
    createdAt: now,
    lastActivityAt: now,
  };
}

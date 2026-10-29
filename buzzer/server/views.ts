// Role-filtered views. The only way room state leaves the server: never emit `room` itself.
// Screen and Player views never carry host notes, token data or an answer before reveal
// (DECISIONS #2: this holds even for a Screen that holds the hostToken).

import type {
  AnswerTimerView,
  BuzzGap,
  BuzzTimerView,
  HostView,
  LobbyPlayer,
  Player,
  PlayerView,
  Question,
  RankedPlayer,
  RankedTotal,
  Role,
  Room,
  ScreenQuestion,
  ScreenView,
  SessionView,
  View,
} from '../shared/types.js';
import { buzzGaps, rankOpening } from './fairness.js';
import { canBuzz, canJudge, canUndo } from './reducer.js';
import { rankPlayers, type Ranked } from './ranking.js';

export function toView(room: Room, role: 'screen'): ScreenView;
export function toView(room: Room, role: 'host'): HostView;
export function toView(room: Room, role: 'player', playerId: string): PlayerView;
export function toView(room: Room, role: Role, playerId?: string): View;
export function toView(room: Room, role: Role, playerId?: string): View {
  switch (role) {
    case 'screen':
      return screenView(room);
    case 'host':
      return hostView(room);
    case 'player':
      if (playerId === undefined) throw new Error('A player view needs a playerId');
      return playerView(room, playerId);
  }
}

function screenView(room: Room): ScreenView {
  const ranked = rankPlayers(Object.values(room.players));
  const current = currentQuestion(room);
  return {
    role: 'screen',
    ...shared(room),
    players: ranked.map(publicPlayer),
    question: current ? screenQuestion(current, isRevealed(room)) : null,
    nextImageId: room.set.questions[room.questionIndex + 1]?.imageId ?? null,
    category: room.set.category ?? null,
    difficulty: room.set.difficulty ?? null,
    hostDevices: room.hostDevices,
  };
}

function hostView(room: Room): HostView {
  // Join order, so a ± tap or a judgement never moves the row under the host's thumb (DECISIONS F40).
  const joined = byJoinOrder(rankPlayers(Object.values(room.players)));
  return {
    role: 'host',
    ...shared(room),
    players: joined.map((p) => ({ ...publicPlayer(p), rttMs: p.rttMs })),
    question: currentQuestion(room),
    nextQuestion: room.set.questions[room.questionIndex + 1] ?? null,
    buzzes: room.buzzes,
    judgements: room.judgements,
  };
}

function playerView(room: Room, playerId: string): PlayerView {
  const ranked = rankPlayers(Object.values(room.players));
  const me = ranked.find((p) => p.id === playerId);
  if (!me) throw new Error(`No player ${playerId} in room ${room.code}`);
  const answer = isRevealed(room) ? currentQuestion(room)?.answer : undefined;
  return {
    role: 'player',
    code: room.code,
    phase: room.phase,
    questionIndex: room.questionIndex,
    questionCount: room.set.questions.length,
    openingCounter: room.openingCounter,
    me: {
      id: me.id,
      name: me.name,
      color: me.color,
      ...avatarOf(me),
      score: me.score,
      rank: me.rank,
    },
    playerCount: ranked.length,
    hasBuzzed: room.buzzes.some((b) => b.playerId === playerId),
    canBuzz: canBuzz(room, playerId),
    lockedOut: room.lockedOut.includes(playerId),
    falseStart: room.falseStarts.includes(playerId),
    falseStartMs: room.settings.falseStartMs,
    winnerId: room.winnerId,
    winnerName: room.winnerId ? (room.players[room.winnerId]?.name ?? null) : null,
    pointsThisQuestion: room.judgements
      .filter((j) => j.questionIndex === room.questionIndex && j.playerId === playerId)
      .reduce((sum, j) => sum + j.pointsDelta, 0),
    answerTimer: answerTimerView(room),
    buzzTimer: buzzTimerView(room),
    lobby:
      room.phase === 'LOBBY' ? byJoinOrder(Object.values(room.players)).map(lobbyPlayer) : null,
    tonight: tonight(room, playerId),
    ...(answer !== undefined && { answer }),
  };
}

/** Sorts by `joinedAt`, then id, so equal join times still give a stable order. */
function byJoinOrder<P extends Player>(players: P[]): P[] {
  return [...players].sort(
    (a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** A "Who's here" row, built field by field: no score, RTT or join data. */
function lobbyPlayer(p: Player): LobbyPlayer {
  return { id: p.id, name: p.name, color: p.color, ...avatarOf(p), connected: p.connected };
}

/** The player's avatar as an optional key: absent, not undefined, when they picked none (F74). */
function avatarOf({ avatar }: { avatar?: string }): { avatar?: string } {
  return avatar !== undefined ? { avatar } : {};
}

/** Fields the Screen and the host remote both get. Built field by field so nothing extra slips in. */
function shared(room: Room) {
  return {
    code: room.code,
    title: room.set.title,
    phase: room.phase,
    questionIndex: room.questionIndex,
    questionCount: room.set.questions.length,
    openingCounter: room.openingCounter,
    winnerId: room.winnerId,
    alsoBuzzed: alsoBuzzed(room),
    lockedOut: room.lockedOut,
    falseStarts: room.falseStarts,
    showScoreboard: room.showScoreboard,
    settings: room.settings,
    // Not secret, so a Screen holding the hostToken can show the same controls (F23).
    canJudge: canJudge(room),
    canUndo: canUndo(room),
    scorerId: scorerId(room),
    answerTimer: answerTimerView(room),
    buzzTimer: buzzTimerView(room),
    session: sessionView(room),
  };
}

/**
 * The night's totals, ranked like scores, players who left included. Null in the room's first
 * game: before a second game there is nothing beyond the scoreboard to show (F76).
 */
function sessionView({ session }: Room): SessionView | null {
  if (session.gameNumber < 2) return null;
  // Every tally records both; an entry without an identity would have no name to show.
  const entries = Object.entries(session.totals).flatMap(([id, total]) => {
    const who = session.players[id];
    return who ? [{ ...who, id, score: total }] : [];
  });
  const totals = rankPlayers(entries).map((t): RankedTotal => ({
    id: t.id,
    name: t.name,
    color: t.color,
    ...avatarOf(t),
    total: t.score,
    rank: t.rank,
  }));
  return { gameNumber: session.gameNumber, totals };
}

/** One player's line of the night: their total and rank, none until they have a total (F77). */
function tonight(room: Room, playerId: string): PlayerView['tonight'] {
  const night = sessionView(room);
  const mine = night?.totals.find((t) => t.id === playerId);
  return night && mine ? { total: mine.total, rank: mine.rank, count: night.totals.length } : null;
}

/** Seconds and whether time is up, never `endsAt`: each device counts down from the snapshot. */
function answerTimerView({ answerTimer }: Room): AnswerTimerView | null {
  return answerTimer && { seconds: answerTimer.seconds, up: answerTimer.up };
}

/** Seconds only, never `endsAt`, as for the answer timer. */
function buzzTimerView({ buzzTimer }: Room): BuzzTimerView | null {
  return buzzTimer && { seconds: buzzTimer.seconds };
}

/**
 * Who answered the current question correctly: the latest correct or half judgement on it, if that
 * player is still in the room. A question visited again with Previous keeps its earlier scorer.
 */
function scorerId(room: Room): string | null {
  const correct = room.judgements.findLast(
    (j) => j.questionIndex === room.questionIndex && j.result !== 'wrong',
  );
  return correct && room.players[correct.playerId] ? correct.playerId : null;
}

/**
 * Every buzz but the winner's, ranked, with its gap to the winner. The winner stays fixed, so a
 * late buzz from BUZZED is listed but never outranks it, and one that missed the window is listed
 * after those that made it (DECISIONS #4, F12, F39).
 */
function alsoBuzzed(room: Room): BuzzGap[] {
  const winner = room.buzzes.find((b) => b.playerId === room.winnerId);
  if (!winner) return [];
  const others = room.buzzes.filter((b) => b !== winner);
  return buzzGaps([winner, ...rankOpening(others, room.players, room.windowStartedAt)]);
}

function publicPlayer(p: Ranked<Player>): RankedPlayer {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    ...avatarOf(p),
    score: p.score,
    connected: p.connected,
    rank: p.rank,
  };
}

/** Never spreads the question: `answer` and `hostNotes` must be opted in, not filtered out. */
function screenQuestion(q: Question, revealed: boolean): ScreenQuestion {
  return {
    id: q.id,
    text: q.text,
    ...(q.imageId !== undefined && { imageId: q.imageId }),
    points: q.points,
    ...(revealed && { answer: q.answer }),
  };
}

function currentQuestion(room: Room): Question | null {
  return room.set.questions[room.questionIndex] ?? null;
}

// SPEC-QUESTION: the spec also shows it in FINAL, but `host:end` can reach FINAL from an unrevealed
// question, so only REVEAL counts; see DECISIONS (F05).
function isRevealed(room: Room): boolean {
  return room.phase === 'REVEAL';
}

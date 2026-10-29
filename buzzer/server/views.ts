// Role-filtered views. The only way room state leaves the server: never emit `room` itself.
// Screen and Player views never carry host notes, token data or an answer before reveal
// (DECISIONS #2: this holds even for a Screen that holds the hostToken).

import type {
  AnswerTimerView,
  BoardView,
  BuzzGap,
  BuzzTimerView,
  ChoiceView,
  HostChoiceView,
  HostTypedView,
  HostView,
  LobbyPlayer,
  Player,
  PlayerChoiceView,
  PlayerTypedView,
  PlayerResults,
  PlayerView,
  Question,
  RankedPlayer,
  RankedTotal,
  Role,
  Room,
  ScreenQuestion,
  ScreenView,
  SessionView,
  TeamView,
  TypedGroup,
  TypedView,
  View,
} from '../shared/types.js';
import { RESULTS_CARD_ROWS, TEAMS } from '../shared/constants.js';
import { buzzGaps, rankOpening } from './fairness.js';
import { canBuzz, canChangeTeams, canJudge, canUndo } from './reducer.js';
import { rankPlayers, rankTeams, type Ranked } from './ranking.js';
import { typedGroups, type Group } from './typed.js';

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
    nextImageId: nextQuestion(room)?.imageId ?? null,
    category: room.set.category ?? null,
    difficulty: room.set.difficulty ?? null,
    hostDevices: room.hostDevices,
    choice: choiceView(room, isRevealed(room)),
    typed: typedView(room, isRevealed(room)),
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
    nextQuestion: nextQuestion(room),
    buzzes: room.buzzes,
    judgements: room.judgements,
    choice: hostChoiceView(room),
    typed: hostTypedView(room),
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
    copy: room.settings.copy,
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
    results: room.phase === 'FINAL' ? playerResults(room, ranked) : null,
    teams: teamsView(room),
    choice: playerChoiceView(room, playerId),
    typed: playerTypedView(room, playerId),
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
    canChangeTeams: canChangeTeams(room),
    scorerId: scorerId(room),
    answerTimer: answerTimerView(room),
    buzzTimer: buzzTimerView(room),
    session: sessionView(room),
    teams: teamsView(room),
    board: boardView(room),
  };
}

/**
 * The board's columns with each tile's question index, points and whether it was picked. No
 * question text, so it is the same for the Screen and the host. Null without a board (F89).
 */
function boardView(room: Room): BoardView | null {
  const { board, questions } = room.set;
  if (!board) return null;
  return {
    columns: board.columns.map((column) => ({
      title: column.title,
      tiles: column.questionIds.map((id) => {
        const questionIndex = questions.findIndex((q) => q.id === id);
        return {
          questionIndex,
          points: questions[questionIndex]?.points ?? 0,
          used: room.usedQuestionIds.includes(id),
        };
      }),
    })),
  };
}

/** The question after this one in set order; none on a board set, where the host picks it (F89). */
function nextQuestion(room: Room): Question | null {
  if (room.set.board) return null;
  return room.set.questions[room.questionIndex + 1] ?? null;
}

/**
 * The room's teams in index order, each scored as the sum of its members' scores and ranked like
 * players (equal scores share a rank). Null with teams off (F81).
 */
function teamsView(room: Room): TeamView[] | null {
  const count = room.settings.teams;
  if (count === 0) return null;
  const joined = byJoinOrder(Object.values(room.players));
  const teams = TEAMS.slice(0, count).map(({ name, color }, index) => {
    const members = joined.filter((p) => p.team === index);
    const score = members.reduce((sum, p) => sum + p.score, 0);
    return { index, name, color, score, memberIds: members.map((p) => p.id) };
  });
  return rankTeams(teams)
    .sort((a, b) => a.index - b.index)
    .map((t) => ({
      index: t.index,
      name: t.name,
      color: t.color,
      score: t.score,
      rank: t.rank,
      memberIds: t.memberIds,
    }));
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

/**
 * The results card's data for the phone (F78): top rows only, so 50 phones don't each get every
 * name. Names and scores are already on the Screen; there is no answer or note in it.
 */
function playerResults(room: Room, ranked: Ranked<Player>[]): PlayerResults {
  const night = sessionView(room);
  return {
    title: room.set.title,
    ranking: { rows: ranked.slice(0, RESULTS_CARD_ROWS).map(publicPlayer), count: ranked.length },
    tonight: night && {
      rows: night.totals.slice(0, RESULTS_CARD_ROWS),
      count: night.totals.length,
    },
  };
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

/**
 * The current choice question, built field by field: `correctChoice` and the per-choice counts
 * only once `revealed`, so a Screen or phone cannot learn the answer early (F85). Null for any
 * other question.
 */
function choiceView(room: Room, revealed: boolean): ChoiceView | null {
  const question = currentQuestion(room);
  if (question?.mode !== 'choice' || !question.choices) return null;
  return {
    choices: question.choices,
    ...answerProgress(room, room.answers),
    ...(revealed && {
      ...(question.correctChoice !== undefined && { correctChoice: question.correctChoice }),
      counts: choiceCounts(room, question.choices.length),
    }),
  };
}

/** The host's choice view: everything, at every phase, including each player's pick. */
function hostChoiceView(room: Room): HostChoiceView | null {
  const view = choiceView(room, false);
  const question = currentQuestion(room);
  if (!view || question?.correctChoice === undefined) return null;
  return {
    ...view,
    correctChoice: question.correctChoice,
    counts: choiceCounts(room, view.choices.length),
    answers: room.answers,
  };
}

/** The phone's choice view, with its own pick and nobody else's. */
function playerChoiceView(room: Room, playerId: string): PlayerChoiceView | null {
  const view = choiceView(room, isRevealed(room));
  return view && { ...view, mine: room.answers[playerId] ?? null };
}

/**
 * "N of M answered" and the time left, for choice and typed questions alike: `expected` counts
 * those who answered and the connected players yet to (DECISIONS F85).
 */
function answerProgress(room: Room, answers: Record<string, unknown>) {
  const answered = Object.keys(answers).filter((id) => room.players[id]).length;
  const waiting = Object.values(room.players).filter(
    (p) => p.connected && !Object.hasOwn(answers, p.id),
  );
  const { answeringTimer: timer } = room;
  return {
    answered,
    expected: answered + waiting.length,
    timer: timer && { seconds: timer.seconds },
  };
}

/**
 * The current typed question, built field by field: the groups, and so everyone's answers, only
 * once `revealed` (F87). Null for any other question. Before the host opens it, nobody has answered.
 */
function typedView(room: Room, revealed: boolean): TypedView | null {
  if (currentQuestion(room)?.mode !== 'typed') return null;
  return {
    ...answerProgress(room, room.typed?.answers ?? {}),
    closed: room.typed?.closed ?? false,
    ...(revealed && { groups: typedGroups(room).map(publicGroup) }),
  };
}

function publicGroup({ key, text, playerIds, correct }: Group): TypedGroup {
  return { key, text, playerIds, correct };
}

/** The host's typed view: every group at every phase, with its pre-mark. */
function hostTypedView(room: Room): HostTypedView | null {
  const view = typedView(room, false);
  return view && { ...view, groups: typedGroups(room) };
}

/** The phone's typed view, with its own answer and, before REVEAL, nobody else's. */
function playerTypedView(room: Room, playerId: string): PlayerTypedView | null {
  const view = typedView(room, isRevealed(room));
  const answers = room.typed?.answers ?? {};
  return view && { ...view, mine: Object.hasOwn(answers, playerId) ? answers[playerId]! : null };
}

/** How many players in the room picked each choice. */
function choiceCounts(room: Room, length: number): number[] {
  const counts = Array.from({ length }, () => 0);
  for (const [id, choice] of Object.entries(room.answers)) {
    if (room.players[id] && choice < length) counts[choice]! += 1;
  }
  return counts;
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

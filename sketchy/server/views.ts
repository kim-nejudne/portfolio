// Role views: what each client receives in `state`. **This is where the secrecy rules live**
// (Role views in docs/spec.md). Ported from Buzzr (buzzer/server/views.ts): one pure function per
// role, built field by field so nothing from `Room` slips through. The secret here is the word.
//
// Server-only, never in any view: `keyHash`, `hostTokenHash`, `rngState`, the deck, the packs, custom words
// (a count only), RTTs and every alternate. The word, its gloss and the choices go only to the
// drawer they belong to (`secret`) until the reveal; then the word alone goes to everyone.

import { ALMOST_MAX, CHOOSE_MS } from '../shared/constants.js';
import { normalize } from './match.js';
import { feedText } from './profanity.js';
import { rankPlayers } from './ranking.js';
import { cycleOrder } from './turnOrder.js';
import type {
  ChoiceView,
  FeedItem,
  GuessView,
  HostBlockView,
  PlayerChipView,
  PlayerView,
  Room,
  ScreenView,
  SecretView,
  TimerView,
  TonightRow,
  Turn,
  TurnView,
  WordEntry,
} from '../shared/types.js';

/** Who a view is for. A Screen's `isHost` means it joined with a valid hostToken. */
export type Viewer = { kind: 'screen'; isHost: boolean } | { kind: 'player'; pid: string };

/**
 * The view of `room` for `viewer` at monotonic `now` (timers are sent as time left). Throws for a
 * pid that isn't in the room: the gateway only builds views for players it has.
 */
// SPEC-QUESTION: the spec's `toView(room, role, pid?)` takes no `now` and no Screen token flag; both are needed (DECISIONS 20).
export function toView(
  room: Room,
  viewer: { kind: 'screen'; isHost: boolean },
  now: number,
): ScreenView;
export function toView(
  room: Room,
  viewer: { kind: 'player'; pid: string },
  now: number,
): PlayerView;
export function toView(room: Room, viewer: Viewer, now: number): ScreenView | PlayerView;
export function toView(room: Room, viewer: Viewer, now: number): ScreenView | PlayerView {
  return viewer.kind === 'screen'
    ? screenView(room, viewer.isHost, now)
    : playerView(room, viewer.pid, now);
}

function base(room: Room, isHost: boolean, now: number) {
  return {
    code: room.code,
    phase: room.phase,
    paused: room.paused && {
      reasons: [...room.paused.reasons],
      resumeInMs: room.paused.resumeAt === null ? null : Math.max(0, room.paused.resumeAt - now),
    },
    rematchInMs:
      room.phase === 'FINAL' && room.rematchAt !== null ? Math.max(0, room.rematchAt - now) : null,
    rematchFirst: rematchFirst(room),
    gameNumber: room.session.gameNumber,
    settings: { ...room.settings },
    players: chips(room),
    turn: room.turn && turnView(room, room.turn, now),
    host: isHost ? hostBlock(room) : null,
  };
}

function screenView(room: Room, isHost: boolean, now: number): ScreenView {
  const { turn, phase } = room;
  const feedShown =
    turn !== null &&
    (phase === 'DRAWING' || phase === 'REVEAL') &&
    room.settings.guessFeed !== 'off';
  return {
    role: 'screen',
    ...base(room, isHost, now),
    feed: feedShown ? turn.feed.map((g) => guessView(room, g)) : [],
    almost: turn && revealed(room) ? almost(room, turn).map((g) => guessView(room, g)) : [],
    awards: phase === 'FINAL' ? room.awards.map((a) => ({ ...a })) : [],
    gallery:
      phase === 'FINAL'
        ? room.history
            .filter((h) => h.hasInk)
            .map(({ turnId, drawerPid, word }) => ({ turnId, drawerPid, word }))
        : [],
    tonight: tonight(room),
  };
}

function playerView(room: Room, pid: string, now: number): PlayerView {
  const me = room.players[pid];
  if (!me) throw new Error('toView: unknown player');
  const ranks = ranksShown(room);
  const award = room.phase === 'FINAL' ? room.awards.find((a) => a.pid === pid) : undefined;
  const { turn } = room;
  const latest = turn?.feed.at(-1);
  return {
    role: 'player',
    ...base(room, room.crownPid === pid, now),
    me: {
      pid,
      turnPoints: turnPoints(room, pid),
      score: ranks ? me.score : null,
      // Shared ranks: everyone on the same score shares the better place.
      rank: ranks ? { rank: ranks.get(pid)!, of: ranks.size } : null,
      award: award ? { ...award } : null,
    },
    secret: secretView(room, pid, now),
    // The drawer knows the word, so the latest wrong guess leaks nothing to them.
    lastGuess:
      room.phase === 'DRAWING' && turn?.drawerPid === pid && latest
        ? guessView(room, latest)
        : null,
  };
}

// ---------- Pieces ----------

/**
 * Totals and ranks only between cycles and at the end (shared ranks, `ranking.ts`): each pid's
 * rank, or null during a turn, when views carry only this turn's points.
 */
function ranksShown(room: Room): Map<string, number> | null {
  if (room.phase !== 'SCOREBOARD' && room.phase !== 'FINAL') return null;
  return new Map(rankPlayers(Object.values(room.players)).map((p) => [p.pid, p.rank]));
}

/** The current turn's word is public once the turn has ended and the room is past DRAWING. */
function revealed(room: Room): boolean {
  const ended = room.turn?.endReason != null;
  return (
    ended && (room.phase === 'REVEAL' || room.phase === 'SCOREBOARD' || room.phase === 'FINAL')
  );
}

function chips(room: Room): PlayerChipView[] {
  const ranks = ranksShown(room);
  const turn = room.turn;
  return Object.values(room.players)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      color: p.color,
      connected: p.connected,
      crown: room.crownPid === p.pid,
      isDrawer:
        turn !== null &&
        turn.drawerPid === p.pid &&
        room.phase !== 'SCOREBOARD' &&
        room.phase !== 'FINAL',
      hasDoodle: p.hasDoodle,
      guessed: turn?.correct.some((c) => c.pid === p.pid) ?? false,
      turnPoints: turnPoints(room, p.pid),
      score: ranks ? p.score : null,
      rank: ranks?.get(p.pid) ?? null,
    }));
}

/** A guesser's points this turn; the drawer's once the turn has ended. */
function turnPoints(room: Room, pid: string): number {
  const turn = room.turn;
  if (!turn) return 0;
  if (pid === turn.drawerPid) return turn.endReason === null ? 0 : turn.drawerPoints;
  return turn.correct.find((c) => c.pid === pid)?.points ?? 0;
}

function turnView(room: Room, turn: Turn, now: number): TurnView {
  const guessers = Object.values(room.players).filter(
    (p) => p.pid !== turn.drawerPid && (p.connected || turn.correct.some((c) => c.pid === p.pid)),
  );
  const show = revealed(room);
  return {
    id: turn.id,
    number: room.history.filter((h) => h.turnId < turn.id).length + 1,
    cycle: turn.cycle,
    drawerPid: turn.drawerPid,
    drawerName: room.players[turn.drawerPid]?.name ?? '',
    timer: timerView(room, turn, now),
    mask: room.phase === 'DRAWING' && turn.word ? maskWord(turn.word.word, turn.hintIndexes) : null,
    word: show && turn.word ? turn.word.word : null,
    correct: turn.correct.map((c, i) => ({ pid: c.pid, points: c.points, order: i + 1 })),
    guessed: { guessed: turn.correct.length, of: guessers.length },
    endReason: turn.endReason,
    drawerReconnecting:
      room.drawerAway?.turnId === turn.id && !room.paused?.reasons.includes('drawerAway'),
  };
}

/** The CHOOSING or DRAWING clock, as time left at `now`; frozen while paused. */
function timerView(room: Room, turn: Turn, now: number): TimerView | null {
  let totalMs: number;
  let endsAt: number;
  if (room.phase === 'DRAWING' && turn.endsAt !== null) {
    totalMs = room.settings.drawSeconds * 1000;
    endsAt = turn.endsAt;
  } else if (room.phase === 'CHOOSING') {
    totalMs = CHOOSE_MS;
    endsAt = turn.dealtAt + CHOOSE_MS;
  } else {
    return null;
  }
  const clamp = (ms: number) => Math.min(totalMs, Math.max(0, ms));
  if (room.paused) {
    const left = room.paused.remainingMs ?? endsAt - room.paused.since;
    return { remainingMs: clamp(left), totalMs, running: false };
  }
  return { remainingMs: clamp(endsAt - now), totalMs, running: true };
}

/**
 * Blanks for `word`: one entry per character (NFC code point), `_` for each letter or digit not
 * revealed by a hint, and spaces, hyphens, apostrophes and other marks as themselves.
 * `hintIndexes` are code-point positions in the NFC word.
 */
export function maskWord(word: string, hintIndexes: readonly number[]): string[] {
  return [...word.normalize('NFC')].map((ch, i) =>
    /[\p{L}\p{N}]/u.test(ch) && !hintIndexes.includes(i) ? '_' : ch,
  );
}

/** The drawer's own choices and word: the current turn's, or the `upcoming` turn's. */
function secretView(room: Room, pid: string, now: number): SecretView | null {
  const { phase, turn, upcoming } = room;
  if ((phase === 'CHOOSING' || phase === 'DRAWING') && turn?.drawerPid === pid) {
    return secretOf(turn, phase === 'CHOOSING' && turn.word === null, null);
  }
  if ((phase === 'REVEAL' || phase === 'SCOREBOARD') && upcoming?.drawerPid === pid) {
    const open = upcoming.word === null;
    return secretOf(upcoming, open, open ? choiceTimer(room, upcoming, now) : null);
  }
  return null;
}

function secretOf(turn: Turn, choosing: boolean, chooseTimer: TimerView | null): SecretView {
  return {
    turnId: turn.id,
    choices: choosing ? turn.choices.map(choiceView) : null,
    word: turn.word && choiceView(turn.word),
    chooseTimer,
  };
}

/** Time left on an `upcoming` choice until its auto-pick; frozen at the pause while paused. */
function choiceTimer(room: Room, turn: Turn, now: number): TimerView {
  const at = room.paused ? room.paused.since : now;
  const left = Math.min(CHOOSE_MS, Math.max(0, turn.dealtAt + CHOOSE_MS - at));
  return { remainingMs: left, totalMs: CHOOSE_MS, running: room.paused === null };
}

/** A word for its drawer: never the alternates. */
function choiceView(entry: WordEntry): ChoiceView {
  return { word: entry.word, gloss: entry.gloss ?? null, difficulty: entry.difficulty };
}

/**
 * A stored guess as it may be shown: masked per the room's `guessFeed` now (not when it was typed),
 * so switching to 'clean' masks what is already up. Under 'off' a guess still shown (the drawer's
 * latest, the reveal's "Almost:") is masked as under 'clean'.
 */
// SPEC-QUESTION: the spec doesn't say how 'off' treats the drawer's latest guess and "Almost:"; masked as 'clean' (DECISIONS 38).
function guessView(room: Room, item: FeedItem): GuessView {
  return { pid: item.pid, text: feedText(item.text, room.settings.guessFeed) };
}

/**
 * The reveal's "Almost:": close guesses first (they came nearest), then the most recent wrong ones,
 * so a turn nobody came close in still shows what people tried. A guess typed twice ("Payong!",
 * "payong") is listed once, by its matcher form, keeping the close one or else the newer one. A
 * guess of only fillers or punctuation ("ang", "?") says nothing and is skipped. Under `'off'` the
 * host hid the wrong guesses, so only the close ones are listed.
 */
// SPEC-QUESTION: the spec says neither whether repeats count, how wrong ones are ordered, nor what 'off' does to them here (DECISIONS 57).
function almost(room: Room, turn: Turn): FeedItem[] {
  const wrong = room.settings.guessFeed === 'off' ? [] : [...turn.feed].reverse();
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const g of [...turn.closeGuesses, ...wrong]) {
    const key = normalize(g.text);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    out.push(g);
    if (out.length === ALMOST_MAX) break;
  }
  return out;
}

/**
 * During the rematch countdown: who draws first if it ran out now, the first connected player of
 * the rotated order (the reducer's own rule). Null otherwise, or with nobody connected.
 */
function rematchFirst(room: Room): ScreenView['rematchFirst'] {
  if (room.phase !== 'FINAL' || room.rematchAt === null) return null;
  const order = cycleOrder(Object.values(room.players), room.session.firstDrawerJoinedAt);
  const first = order.map((pid) => room.players[pid]!).find((p) => p.connected);
  return first ? { pid: first.pid, name: first.name, color: first.color } : null;
}

/**
 * The night's totals on FINAL from game 2 (Tonight panel, as in Buzzr): every finished game's
 * total plus this game's score, ranked with shared ranks; players who left are listed with the
 * total they had. Null in the first game and outside FINAL.
 */
function tonight(room: Room): TonightRow[] | null {
  if (room.phase !== 'FINAL' || room.session.gameNumber < 2) return null;
  const { totals, players } = room.session;
  const rows = new Map<
    string,
    { pid: string; name: string; color: string; score: number; joinedAt: number }
  >();
  for (const [pid, total] of Object.entries(totals)) {
    const who = players[pid];
    if (who) rows.set(pid, { pid, ...who, score: total });
  }
  for (const p of Object.values(room.players)) {
    rows.set(p.pid, {
      pid: p.pid,
      name: p.name,
      color: p.color,
      joinedAt: p.joinedAt,
      score: (totals[p.pid] ?? 0) + p.score,
    });
  }
  return rankPlayers([...rows.values()]).map((r) => ({
    pid: r.pid,
    name: r.name,
    color: r.color,
    total: r.score,
    rank: r.rank,
  }));
}

function hostBlock(room: Room): HostBlockView {
  return { code: room.code, customWordCount: room.customWords.length };
}

// Role-filtered snapshots (spec: Role views). Every field is copied by name, never spread from the
// room, so nothing secret (`keyHash`, the round's place, other players' aims) can slip into a view.

import type {
  CategorySummary,
  GateStatus,
  PausedView,
  Phase,
  Place,
  PlayerPrompt,
  PlayerView,
  PublicPlayer,
  Region,
  RevealedPlace,
  Room,
  Role,
  Round,
  MyResult,
  ScreenPrompt,
  ScreenView,
  StandingRow,
  VipControl,
} from '#shared/types.js';
import { closestIds, competitionRanks } from '#shared/scoring.js';

export interface ViewContext {
  /** Wall-clock ms, sent as `serverNow` (clients keep `serverNow − Date.now()`). */
  now: number;
  /** `PUBLIC_URL` without a trailing slash: the Screen's join URL and QR. */
  publicUrl: string;
  /** The live, visible categories (public: `GET /api/categories` serves the same list). */
  categories: CategorySummary[];
}

/** Each player's points in a round; 0 when they have no row (missed it or joined later). */
const pointsIn = (round: Round | undefined, playerId: string) =>
  round?.results?.find((r) => r.playerId === playerId)?.points ?? 0;

/** Players in join order, with each total and its competition rank. */
function publicPlayers(room: Room): PublicPlayer[] {
  const players = Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const played = room.game?.played ?? [];
  const totals = players.map((p) => played.reduce((sum, round) => sum + pointsIn(round, p.id), 0));
  const ranks = competitionRanks(totals);
  return players.map((p, i) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    connected: p.connected,
    waiting: p.waiting,
    isVip: p.id === room.vipId,
    total: totals[i]!,
    rank: ranks[i]!,
  }));
}

/**
 * SCOREBOARD and FINAL: rows by rank (ties in join order). Movement compares with the ranks before
 * the last played round, and is 0 on the first board (DECISIONS 25).
 */
function standings(room: Room, players: PublicPlayer[]): StandingRow[] | null {
  if (room.phase !== 'SCOREBOARD' && room.phase !== 'FINAL') return null;
  const played = room.game?.played ?? [];
  const last = played.at(-1);
  const roundPoints = players.map((p) => pointsIn(last, p.id));
  const before = competitionRanks(players.map((p, i) => p.total - roundPoints[i]!));
  return players
    .map((p, i) => ({
      playerId: p.id,
      rank: p.rank,
      total: p.total,
      roundPoints: roundPoints[i]!,
      movement: played.length > 1 ? before[i]! - p.rank : 0,
    }))
    .sort((a, b) => a.rank - b.rank);
}

/** The round the views describe: the current one, else the last played (SCOREBOARD, FINAL). */
const roundOf = (room: Room): Round | null =>
  room.phase === 'LOBBY' ? null : (room.game?.current ?? room.game?.played.at(-1) ?? null);

const placeOf = (room: Room, round: Round): Place => {
  const place = room.game?.pool[round.level]?.find((p) => p.id === round.placeId);
  if (!place) throw new Error('toView: round place missing from the pool');
  return place;
};

const photoUrl = (round: Round) => `/api/photos/${round.photoToken}`;

/** Name mode shows the display name; Picture mode the photo and a credit that never names it. */
function screenPrompt(room: Room, round: Round, place: Place): ScreenPrompt {
  if (room.settings.mode === 'name') return { kind: 'name', displayName: place.displayName };
  // shortcut: the author is always hidden behind "Wikimedia Commons contributor"; F48 brings the
  // spec's rule that shows it unless it shares a 4+ letter word with the answer.
  return {
    kind: 'picture',
    photoUrl: photoUrl(round),
    credit: `Photo: Wikimedia Commons contributor · ${place.photo?.licence ?? ''}`,
  };
}

function playerPrompt(room: Room, round: Round, place: Place): PlayerPrompt {
  const prompt = screenPrompt(room, round, place);
  return prompt.kind === 'name' ? prompt : { ...prompt, thumbUrl: `${photoUrl(round)}/thumb` };
}

const gateStatus = (room: Room): GateStatus =>
  room.paused ? 'delayed' : room.phase === 'INTRO' ? 'nowBoarding' : 'boarding';

/** The answer: only once the round has results, i.e. from its REVEAL on. */
function revealedPlace(room: Room, round: Round, place: Place): RevealedPlace {
  const picture = room.settings.mode === 'picture';
  return {
    name: place.name,
    displayName: place.displayName,
    fact: place.fact,
    position: { lat: place.lat, lng: place.lng },
    credit:
      picture && place.photo
        ? `Photo: ${place.photo.author}, ${place.photo.licence}, via Wikimedia Commons`
        : null,
    photoUrl: picture ? photoUrl(round) : null,
  };
}

/**
 * The viewer's own row, once the Screen has reached it: in REVEAL when `revealedCount` is past
 * their index (missed rows at stage `done`), and from SCOREBOARD on for the last played round.
 */
function myResult(room: Room, round: Round | null, me: PublicPlayer): MyResult | null {
  const playerId = me.id;
  const index = round?.results?.findIndex((r) => r.playerId === playerId) ?? -1;
  if (!round || index < 0) return null;
  const shown =
    room.phase !== 'REVEAL' || round.revealStage === 'done' || index < round.revealedCount;
  if (!shown) return null;
  const row = round.results![index]!;
  // The phone sees only its own row, so the server says whether it is tagged Closest.
  const closest = closestIds(round.results!).includes(playerId);
  // In REVEAL the round is not yet in `played`, so not yet in `me.total`.
  const totalAfter = me.total + (room.phase === 'REVEAL' ? row.points : 0);
  return { ...row, closest, totalAfter };
}

const pausedView = (room: Room): PausedView | null =>
  room.paused && {
    reasons: [...room.paused.reasons],
    since: room.paused.since,
    resumeAt: room.paused.resumeAt,
  };

/** The game's box and scale, from INTRO until the game ends (the box is public). */
const regionView = (room: Room): Region | null =>
  room.game && room.phase !== 'LOBBY'
    ? { box: { ...room.game.box }, scale: room.game.scale }
    : null;

/** The VIP drawer's controls per phase (spec: VIP controls). */
export function vipControls(phase: Phase, paused: boolean, rematchCounting: boolean): VipControl[] {
  const pause: VipControl = paused ? 'resume' : 'pause';
  switch (phase) {
    case 'LOBBY':
      return ['start', 'kick'];
    case 'INTRO':
    case 'GUESSING':
      return [pause, 'skipRound', 'kick', 'end'];
    case 'REVEAL':
      return ['next', pause, 'skipRound', 'end'];
    case 'SCOREBOARD':
      return ['next', pause, 'roundSettings', 'kick', 'end'];
    case 'FINAL':
      return rematchCounting ? ['rematchCancel'] : ['rematch', 'backToLobby', 'kick'];
  }
}

// shortcut: `final` stays null until the finale (F27, F28) computes podium, passes and awards.
export function toView(
  room: Room,
  role: 'screen',
  playerId: undefined,
  ctx: ViewContext,
): ScreenView;
export function toView(room: Room, role: 'player', playerId: string, ctx: ViewContext): PlayerView;
export function toView(
  room: Room,
  role: Role,
  playerId: string | undefined,
  ctx: ViewContext,
): ScreenView | PlayerView {
  const players = publicPlayers(room);
  const round = roundOf(room);
  const place = round && placeOf(room, round);
  const header = round && {
    number: round.number,
    total: room.settings.rounds,
    multiplier: round.multiplier,
    endsAt: round.endsAt,
  };
  const common = {
    serverNow: ctx.now,
    code: room.code,
    phase: room.phase,
    settings: { ...room.settings },
    categoryName: ctx.categories.find((c) => c.id === room.settings.categoryId)?.name ?? null,
    hasCategories: ctx.categories.length > 0,
    paused: pausedView(room),
    rematchAt: room.rematchAt,
    region: regionView(room),
  };

  if (role === 'screen') {
    return {
      role: 'screen',
      ...common,
      joinUrl: `${ctx.publicUrl}/play/${room.code}`,
      players,
      round: header && {
        ...header,
        gate: gateStatus(room),
        lockedIn: Object.keys(round.locks),
        prompt: screenPrompt(room, round, place!),
      },
      reveal:
        room.phase === 'REVEAL' && round?.results
          ? {
              place: revealedPlace(room, round, place!),
              results: round.results.map((r) => ({
                ...r,
                position: r.position && { ...r.position },
              })),
              revealStage: round.revealStage,
              revealedCount: round.revealedCount,
            }
          : null,
      standings: standings(room, players),
      final: null,
    };
  }

  const me = players.find((p) => p.id === playerId);
  if (!me) throw new Error('toView: no such player');
  return {
    role: 'player',
    ...common,
    me,
    playerCount: players.length,
    vipName: players.find((p) => p.isVip)?.name ?? null,
    round: header && {
      ...header,
      prompt: playerPrompt(room, round, place!),
      myLock: round.locks[me.id]
        ? { lat: round.locks[me.id]!.lat, lng: round.locks[me.id]!.lng }
        : null,
      // SPEC-QUESTION: Role views lists no aim, but Reconnects keeps a returning player's earlier
      // aim, so the viewer's own aim rides along (DECISIONS 25).
      myAim: round.aims[me.id] ? { ...round.aims[me.id]! } : null,
      stillGuessing:
        room.phase === 'INTRO' || room.phase === 'GUESSING'
          ? round.participants
              .filter((id) => !round.locks[id] && room.players[id])
              .map((id) => room.players[id]!.emoji)
          : [],
    },
    myResult: myResult(room, round, me),
    vip: me.isVip
      ? {
          categories: ctx.categories,
          screenCount: room.screenCount,
          players,
          controls: vipControls(room.phase, room.paused !== null, room.rematchAt !== null),
        }
      : null,
  };
}

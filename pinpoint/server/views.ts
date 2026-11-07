// Role-filtered snapshots (spec: Role views). Every field is copied by name, never spread from the
// room, so nothing secret (`keyHash`, the round's place, other players' aims) can slip into a view.

import type {
  PausedView,
  Phase,
  PlayerView,
  PublicPlayer,
  Region,
  Room,
  Role,
  ScreenView,
  VipControl,
} from '#shared/types.js';
import { competitionRanks } from '#shared/scoring.js';

export interface ViewContext {
  /** Wall-clock ms, sent as `serverNow` (clients keep `serverNow − Date.now()`). */
  now: number;
  /** `PUBLIC_URL` without a trailing slash: the Screen's join URL and QR. */
  publicUrl: string;
}

/** Players in join order, with each total and its competition rank. */
function publicPlayers(room: Room): PublicPlayer[] {
  const players = Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const totals = players.map((p) =>
    (room.game?.played ?? []).reduce(
      (sum, round) => sum + (round.results?.find((r) => r.playerId === p.id)?.points ?? 0),
      0,
    ),
  );
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

const pausedView = (room: Room): PausedView | null =>
  room.paused && { reasons: [...room.paused.reasons], resumeAt: room.paused.resumeAt };

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

// shortcut: lobby views only; round, reveal, standings and finale fields stay null until the
// features that build those phases (F10 on) fill them in, checked by the leak test.
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
  const common = {
    serverNow: ctx.now,
    code: room.code,
    phase: room.phase,
    settings: { ...room.settings },
    paused: pausedView(room),
    rematchAt: room.rematchAt,
    region: regionView(room),
    round: null,
  };

  if (role === 'screen') {
    return {
      role: 'screen',
      ...common,
      joinUrl: `${ctx.publicUrl}/play/${room.code}`,
      players,
      reveal: null,
      standings: null,
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
    myResult: null,
    vip: me.isVip
      ? {
          // shortcut: no category store yet; the categories feature fills the lobby list.
          categories: [],
          players,
          controls: vipControls(room.phase, room.paused !== null, room.rematchAt !== null),
        }
      : null,
  };
}

// The drawer away (F40): `player:visibility` and disconnects, the 2 s debounce, the `drawerAway`
// pause, the drawer's return and the 30 s limit. "Pausing" and "Edge cases" in docs/spec.md.
import { describe, expect, it } from 'vitest';
import {
  CHOOSE_MS,
  DRAWER_AWAY_DEBOUNCE_MS,
  DRAWER_AWAY_MS,
  GRACE_MS,
  RESUME_COUNTDOWN_MS,
  REVEAL_MS,
} from '../shared/constants.js';
import type { Action, Effect, Room, TimerName } from '../shared/types.js';
import { reduce } from './reducer.js';
import { drawerPoints } from './scoring.js';
import {
  NEW_PHONE,
  SCREEN,
  SCREEN_HOST,
  asPlayer,
  dealt,
  inPhase,
  secretWord,
  started,
  step,
  withPlayers,
} from './test/rooms.js';
import { toView } from './views.js';

const DEBOUNCE = DRAWER_AWAY_DEBOUNCE_MS;
const LIMIT = DRAWER_AWAY_MS;

type Scheduled = Extract<Effect, { type: 'schedule' }>;

const hide = (pid: string, hidden = true): Action => ({
  type: 'player:visibility',
  by: asPlayer(pid),
  hidden,
});
const drop = (pid: string): Action => ({ type: 'sys:disconnected', pid });
/** The same phone back: Socket.IO reconnected and the phone joined again with its key. */
const rejoin = (name: string, hidden?: boolean): Action => ({
  type: 'player:join',
  by: NEW_PHONE,
  keyHash: `key-${name}`,
  name,
  ...(hidden === undefined ? {} : { hidden }),
});
const PAUSE: Action = { type: 'host:pause', by: SCREEN_HOST };
const RESUME: Action = { type: 'host:resume', by: SCREEN_HOST };

function scheduled(effects: Effect[], timer: TimerName): Scheduled[] {
  return effects.filter((e): e is Scheduled => e.type === 'schedule' && e.timer === timer);
}

/** The one `timer` scheduled in `effects`. */
function only(effects: Effect[], timer: TimerName): Scheduled {
  const found = scheduled(effects, timer);
  expect(found, timer).toHaveLength(1);
  return found[0]!;
}

/** Fires a scheduled timer at its due time, as the gateway would. */
const fire = (room: Room, e: Scheduled, at = e.at) =>
  reduce(room, { type: 'timer', timer: e.timer, turnId: e.turnId, epoch: e.epoch }, at);

const screenTurn = (room: Room, now: number) =>
  toView(room, { kind: 'screen', isHost: false }, now).turn!;

/** DRAWING with Ana drawing; her phone locks at `awayAt` and the 2 s check pauses the game. */
function awayPaused(awayAt?: number) {
  const { room, pids, at } = started();
  const t = awayAt ?? at + 10_000;
  const hidden = step(room, hide(pids[0]!), t);
  const check = only(hidden.effects, 'drawerAwayCheck');
  const res = fire(hidden.room, check);
  if (!res.ok) throw new Error(res.error);
  return { pids, at, t, before: hidden.room, room: res.room, effects: res.effects };
}

describe('player:visibility', () => {
  it('records hidden for any player in any phase, the lobby too', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const res = step(room, hide(pids[1]!), 2_000_000);
    expect(res.room.players[pids[1]!]!.hidden).toBe(true);
    expect(res.effects).toEqual([]);
    expect(step(res.room, hide(pids[1]!, false), 2_000_100).room.players[pids[1]!]!.hidden).toBe(
      false,
    );
  });

  it('comes from a joined player only', () => {
    const { room } = withPlayers(['Ana', 'Ben']);
    expect(
      reduce(room, { type: 'player:visibility', by: SCREEN, hidden: true }, 2_000_000),
    ).toEqual({ ok: false, error: 'notPlayer' });
    expect(reduce(room, hide('nobody'), 2_000_000)).toEqual({
      ok: false,
      error: 'unknownPlayer',
    });
  });

  it('is set by a rejoin from what the joining page says, visible by default', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const hidden = step(step(room, hide(pids[0]!), 2_000_000).room, drop(pids[0]!), 2_000_100).room;
    const back = step(hidden, rejoin('Ana'), 2_000_200).room.players[pids[0]!]!;
    expect(back).toMatchObject({ connected: true, hidden: false });
    const stillHidden = step(hidden, rejoin('Ana', true), 2_000_200).room.players[pids[0]!]!;
    expect(stillHidden).toMatchObject({ connected: true, hidden: true });
  });

  it('a new player joining with a hidden page is hidden', () => {
    const { room } = withPlayers(['Ana']);
    const res = step(
      room,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'key-Ben', name: 'Ben', hidden: true },
      2_000_000,
    ).room;
    expect(Object.values(res.players).find((p) => p.name === 'Ben')!.hidden).toBe(true);
  });

  it('a guesser hiding or dropping pauses nothing and schedules no check', () => {
    const { room, pids, at } = started();
    const hidden = step(room, hide(pids[1]!), at + 1000);
    const gone = step(hidden.room, drop(pids[2]!), at + 2000);
    expect(scheduled([...hidden.effects, ...gone.effects], 'drawerAwayCheck')).toEqual([]);
    expect(gone.room.drawerAway).toBeNull();
    expect(screenTurn(gone.room, at + 2000).drawerReconnecting).toBe(false);
  });

  it('the drawer away outside CHOOSING and DRAWING schedules nothing', () => {
    const reveal = inPhase('REVEAL');
    const res = step(reveal, hide(reveal.turn!.drawerPid), 3_000_000);
    expect(scheduled(res.effects, 'drawerAwayCheck')).toEqual([]);
    expect(res.room.drawerAway).toBeNull();
  });
});

describe('the 2 s debounce', () => {
  it('a 1 s blip pauses nothing', () => {
    const { room, pids, at } = started();
    const t = at + 10_000;
    const gone = step(room, drop(pids[0]!), t);
    const check = only(gone.effects, 'drawerAwayCheck');
    expect(check).toMatchObject({ at: t + DEBOUNCE, turnId: room.turn!.id });
    const back = step(gone.room, rejoin('Ana'), t + 1000).room;
    expect(fire(back, check)).toEqual({ ok: false, error: 'staleTimer' });
    expect(back.paused).toBeNull();
    // The clock never stopped.
    expect(back.turn!.endsAt).toBe(room.turn!.endsAt);
    expect(screenTurn(back, t + 1000).drawerReconnecting).toBe(false);
  });

  it('the clock keeps running and the Screen shows "reconnecting" during it', () => {
    const { room, pids, at } = started();
    const t = at + 10_000;
    const hidden = step(room, hide(pids[0]!), t).room;
    expect(hidden.paused).toBeNull();
    const turn = screenTurn(hidden, t + 1500);
    expect(turn.drawerReconnecting).toBe(true);
    expect(turn.timer).toMatchObject({ running: true, remainingMs: 60_000 - 11_500 });
    // Guesses still count meanwhile.
    const guess = reduce(
      hidden,
      {
        type: 'player:guess',
        by: asPlayer(pids[1]!),
        text: secretWord(hidden),
        receivedAt: t + 1500,
        oneWayMs: 0,
      },
      t + 1500,
    );
    expect(guess.ok).toBe(true);
  });

  it('a phone still hidden after 2 s sets the drawerAway pause and freezes the clock', () => {
    const { room, before, t, effects } = awayPaused();
    expect(room.paused).toEqual({
      reasons: ['drawerAway'],
      since: t + DEBOUNCE,
      remainingMs: before.turn!.endsAt! - (t + DEBOUNCE),
      resumeAt: null,
    });
    expect(room.timerEpoch).toBe(before.timerEpoch + 1);
    // The 30 s limit starts with the pause.
    expect(only(effects, 'drawerGone').at).toBe(t + DEBOUNCE + LIMIT);
    // The badge gives way to the paused overlay.
    expect(screenTurn(room, t + DEBOUNCE).drawerReconnecting).toBe(false);
  });

  it('a disconnect pauses after 2 s just as hiding does', () => {
    const { room, pids, at } = started();
    const gone = step(room, drop(pids[0]!), at + 5000);
    const res = fire(gone.room, only(gone.effects, 'drawerAwayCheck'));
    expect(res.ok && res.room.paused?.reasons).toEqual(['drawerAway']);
  });

  it('a hidden phone that then disconnects keeps the first check', () => {
    const { room, pids, at } = started();
    const hidden = step(room, hide(pids[0]!), at + 5000);
    const gone = step(hidden.room, drop(pids[0]!), at + 6000);
    expect(scheduled(gone.effects, 'drawerAwayCheck')).toEqual([]);
    const res = fire(gone.room, only(hidden.effects, 'drawerAwayCheck'));
    expect(res.ok && res.room.paused?.since).toBe(at + 5000 + DEBOUNCE);
  });

  it('away again after a blip: only the second absence’s check pauses, 2 s after it', () => {
    const { room, pids, at } = started();
    const first = step(room, hide(pids[0]!), at + 5000);
    const back = step(first.room, hide(pids[0]!, false), at + 5500).room;
    const second = step(back, hide(pids[0]!), at + 6500);
    expect(fire(second.room, only(first.effects, 'drawerAwayCheck'))).toEqual({
      ok: false,
      error: 'staleTimer',
    });
    const res = fire(second.room, only(second.effects, 'drawerAwayCheck'));
    expect(res.ok && res.room.paused?.since).toBe(at + 6500 + DEBOUNCE);
  });

  it('in CHOOSING too, with the choice’s time frozen', () => {
    const { room, pids, at } = dealt();
    const hidden = step(room, hide(pids[0]!), at + 3000);
    const res = fire(hidden.room, only(hidden.effects, 'drawerAwayCheck'));
    expect(res.ok && res.room.paused).toMatchObject({
      reasons: ['drawerAway'],
      remainingMs: CHOOSE_MS - 5000,
    });
  });

  it('survives the auto-pick: the check is re-armed at the new epoch, still 2 s after', () => {
    const { room, pids, at } = dealt();
    const hidden = step(room, hide(pids[0]!), at + 11_000);
    // The deal's `chooseUp`, at the epoch it was scheduled with.
    const chooseUp: Scheduled = {
      type: 'schedule',
      timer: 'chooseUp',
      at: at + CHOOSE_MS,
      turnId: room.turn!.id,
      epoch: room.timerEpoch,
    };
    const picked = fire(hidden.room, chooseUp);
    if (!picked.ok) throw new Error(picked.error);
    expect(picked.room.phase).toBe('DRAWING');
    // The first check went stale with the phase change.
    expect(fire(picked.room, only(hidden.effects, 'drawerAwayCheck'))).toEqual({
      ok: false,
      error: 'staleTimer',
    });
    const check = only(picked.effects, 'drawerAwayCheck');
    expect(check.at).toBe(at + 11_000 + DEBOUNCE);
    const res = fire(picked.room, check);
    expect(res.ok && res.room.paused?.reasons).toEqual(['drawerAway']);
  });

  it('a hidden player dealt a turn is away from the deal', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const hidden = step(room, hide(pids[0]!), 1_500_000).room;
    const res = step(hidden, { type: 'host:start', by: SCREEN_HOST }, 1_500_100);
    expect(only(res.effects, 'drawerAwayCheck').at).toBe(1_500_100 + DEBOUNCE);
    expect(screenTurn(res.room, 1_500_100).drawerReconnecting).toBe(true);
  });
});

describe('the drawer back', () => {
  it('visible again: the reason clears into the 3-2-1, then the clock goes on with what it had', () => {
    const { room, pids, before, t } = awayPaused();
    const backAt = t + DEBOUNCE + 4000;
    const back = step(room, hide(pids[0]!, false), backAt);
    expect(back.room.paused).toMatchObject({ reasons: [], resumeAt: backAt + RESUME_COUNTDOWN_MS });
    expect(back.room.drawerAway).toBeNull();
    const go = fire(back.room, only(back.effects, 'resumeGo'));
    if (!go.ok) throw new Error(go.error);
    expect(go.room.paused).toBeNull();
    const pausedFor = backAt + RESUME_COUNTDOWN_MS - (t + DEBOUNCE);
    expect(go.room.turn!.endsAt).toBe(before.turn!.endsAt! + pausedFor);
    expect(only(go.effects, 'drawUp').at).toBe(before.turn!.endsAt! + pausedFor + GRACE_MS);
  });

  it('reconnected: the rejoin clears it too', () => {
    const { room, pids, at } = started();
    const gone = step(room, drop(pids[0]!), at + 5000);
    const paused = fire(gone.room, only(gone.effects, 'drawerAwayCheck'));
    if (!paused.ok) throw new Error(paused.error);
    const back = step(paused.room, rejoin('Ana'), at + 9000).room;
    expect(back.paused).toMatchObject({ reasons: [], resumeAt: at + 9000 + RESUME_COUNTDOWN_MS });
  });

  it('a locked phone reconnecting in the background stays away: no 3-2-1, the 30 s runs on', () => {
    const { room, pids, t, effects } = awayPaused();
    const gone = step(room, drop(pids[0]!), t + 5000).room;
    const back = step(gone, rejoin('Ana', true), t + 6000);
    expect(back.room.paused).toMatchObject({ reasons: ['drawerAway'], resumeAt: null });
    expect(back.room.drawerAway).toEqual(room.drawerAway);
    expect(scheduled(back.effects, 'drawerGone')).toEqual([]);
    const res = fire(back.room, only(effects, 'drawerGone'));
    expect(res.ok && res.room.turn!.endReason).toBe('drawerGone');
  });

  it('leaving again during the 3-2-1 stops it and pauses 2 s later', () => {
    const { room, pids, t } = awayPaused();
    const back = step(room, hide(pids[0]!, false), t + 5000);
    const away = step(back.room, hide(pids[0]!), t + 6000);
    expect(away.room.paused?.resumeAt).not.toBeNull();
    const res = fire(away.room, only(away.effects, 'drawerAwayCheck'));
    if (!res.ok) throw new Error(res.error);
    expect(res.room.paused).toMatchObject({ reasons: ['drawerAway'], resumeAt: null });
    expect(fire(res.room, only(back.effects, 'resumeGo'))).toEqual({
      ok: false,
      error: 'staleTimer',
    });
  });

  it('guesses are refused during the pause', () => {
    const { room, pids, t } = awayPaused();
    const guess = reduce(
      room,
      {
        type: 'player:guess',
        by: asPlayer(pids[1]!),
        text: secretWord(room),
        receivedAt: t + 3000,
        oneWayMs: 0,
      },
      t + 3000,
    );
    expect(guess).toEqual({ ok: false, error: 'paused' });
  });
});

describe('the 30 s limit', () => {
  it('DRAWING: the turn ends as drawerGone, points stay and the drawer gets half', () => {
    const { room, pids, at } = started();
    const guessed = step(
      room,
      {
        type: 'player:guess',
        by: asPlayer(pids[1]!),
        text: secretWord(room),
        receivedAt: at + 5000,
        oneWayMs: 0,
      },
      at + 5000,
    ).room;
    const benPoints = guessed.players[pids[1]!]!.score;
    const hidden = step(guessed, hide(pids[0]!), at + 10_000);
    const paused = fire(hidden.room, only(hidden.effects, 'drawerAwayCheck'));
    if (!paused.ok) throw new Error(paused.error);
    const goneAt = at + 10_000 + DEBOUNCE + LIMIT;
    const res = fire(paused.room, only(paused.effects, 'drawerGone'));
    if (!res.ok) throw new Error(res.error);
    expect(res.room.phase).toBe('REVEAL');
    expect(res.room.turn!.endReason).toBe('drawerGone');
    // No 3-2-1 before the reveal: the pause is simply over.
    expect(res.room.paused).toBeNull();
    expect(res.room.drawerAway).toBeNull();
    expect(res.room.players[pids[1]!]!.score).toBe(benPoints);
    expect(res.room.players[pids[0]!]!.score).toBe(drawerPoints([benPoints]));
    expect(res.effects).toContainEqual({ type: 'inkClose', turnId: room.turn!.id });
    expect(res.effects).toContainEqual({
      type: 'fx',
      to: 'all',
      fx: { kind: 'turnEnd', reason: 'drawerGone' },
    });
    expect(only(res.effects, 'revealDone').at).toBe(goneAt + REVEAL_MS);
    // Ana isn't dealt again this cycle: Ben is next, then Cy.
    expect(res.room.upcoming!.drawerPid).toBe(pids[1]);
    expect(res.room.turnOrder.indexOf(pids[0]!)).toBeLessThan(res.room.turnIndex);
  });

  it('CHOOSING: skipped without a reveal; the next drawer chooses', () => {
    const { room, pids, at } = dealt();
    const hidden = step(room, hide(pids[0]!), at + 1000);
    const paused = fire(hidden.room, only(hidden.effects, 'drawerAwayCheck'));
    if (!paused.ok) throw new Error(paused.error);
    const res = fire(paused.room, only(paused.effects, 'drawerGone'));
    if (!res.ok) throw new Error(res.error);
    expect(res.room.phase).toBe('CHOOSING');
    expect(res.room.turn!.drawerPid).toBe(pids[1]);
    expect(res.room.history).toEqual([]);
    expect(res.room.paused).toBeNull();
    // The words went back: the deck holds them again.
    for (const choice of room.turn!.choices) expect(res.room.deck.remaining).toContain(choice.id);
  });

  it('is stale once the drawer is back', () => {
    const { room, pids, t, effects } = awayPaused();
    const back = step(room, hide(pids[0]!, false), t + 5000).room;
    expect(fire(back, only(effects, 'drawerGone'))).toEqual({ ok: false, error: 'staleTimer' });
  });

  it('waits while the host holds the game too, and runs afresh from the host’s resume', () => {
    const { room, pids, at } = started();
    const held = step(room, PAUSE, at + 5000).room;
    const hidden = step(held, hide(pids[0]!), at + 6000);
    const res = fire(hidden.room, only(hidden.effects, 'drawerAwayCheck'));
    if (!res.ok) throw new Error(res.error);
    expect(res.room.paused?.reasons).toEqual(['host', 'drawerAway']);
    expect(scheduled(res.effects, 'drawerGone')).toEqual([]);
    const resumed = step(res.room, RESUME, at + 60_000);
    // Still waiting on the drawer: no 3-2-1 yet.
    expect(resumed.room.paused).toMatchObject({ reasons: ['drawerAway'], resumeAt: null });
    expect(only(resumed.effects, 'drawerGone').at).toBe(at + 60_000 + LIMIT);
  });

  it('a host pause during it stops the count; the old limit is stale', () => {
    const { room, effects, t } = awayPaused();
    const held = step(room, PAUSE, t + 10_000).room;
    expect(held.paused?.reasons).toEqual(['drawerAway', 'host']);
    expect(fire(held, only(effects, 'drawerGone'))).toEqual({ ok: false, error: 'staleTimer' });
    expect(held.phase).toBe('DRAWING');
  });
});

describe('moving on while the drawer is away', () => {
  it('a host skip: the next drawer is here, so the reason clears into the 3-2-1', () => {
    const { room, t } = awayPaused();
    const res = step(room, { type: 'host:skip', by: SCREEN_HOST }, t + 5000);
    expect(res.room.phase).toBe('REVEAL');
    expect(res.room.paused).toMatchObject({
      reasons: [],
      resumeAt: t + 5000 + RESUME_COUNTDOWN_MS,
    });
    expect(res.room.drawerAway).toBeNull();
  });

  it('the drawer kicked: the turn ends as a skip and the reason clears', () => {
    const { room, pids, t } = awayPaused();
    const res = step(room, { type: 'host:kick', by: SCREEN_HOST, pid: pids[0]! }, t + 5000);
    expect(res.room.turn!.endReason).toBe('skip');
    expect(res.room.paused?.reasons).toEqual([]);
  });

  it('host:end clears everything', () => {
    const { room, t } = awayPaused();
    const res = step(room, { type: 'host:end', by: SCREEN_HOST }, t + 5000);
    expect(res.room.phase).toBe('FINAL');
    expect(res.room.paused).toBeNull();
    expect(res.room.drawerAway).toBeNull();
  });
});

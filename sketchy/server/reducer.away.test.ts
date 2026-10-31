// The drawer away (F40): `player:visibility` and disconnects, the 2 s debounce, the `drawerAway`
// pause, the drawer's return and the 30 s limit. The Screen away and too few players (F41): the
// `screenAway` and `fewPlayers` pauses, and several reasons at once. "Pausing" and "Edge cases" in
// docs/spec.md.
import { describe, expect, it } from 'vitest';
import {
  CHOOSE_MS,
  DRAWER_AWAY_DEBOUNCE_MS,
  DRAWER_AWAY_MS,
  GRACE_MS,
  RESUME_COUNTDOWN_MS,
  REVEAL_MS,
  SCREEN_AWAY_MS,
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
  makeRoom,
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
  avatar: '🦊',
  ...(hidden === undefined ? {} : { hidden }),
});
const screens = (count: number): Action => ({ type: 'sys:screens', count });
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
      {
        type: 'player:join',
        by: NEW_PHONE,
        keyHash: 'key-Ben',
        name: 'Ben',
        avatar: '🦊',
        hidden: true,
      },
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

// ---------- F41: the Screen away ----------

/** DRAWING with Ana drawing; the last Screen goes at `goneAt` and `screenGone` pauses the game. */
function screenPaused(names?: string[]) {
  const { room, pids, at } = started(names);
  const t = at + 10_000;
  const gone = step(room, screens(0), t);
  const res = fire(gone.room, only(gone.effects, 'screenGone'));
  if (!res.ok) throw new Error(res.error);
  return { pids, at, t, before: gone.room, room: res.room, effects: res.effects };
}

describe('screenAway', () => {
  it('the last Screen gone 3 s in DRAWING sets the pause and freezes the clock', () => {
    const { room, at } = started();
    const t = at + 10_000;
    const gone = step(room, screens(0), t);
    expect(gone.room.paused).toBeNull();
    expect(gone.room.screenAwaySince).toBe(t);
    const check = only(gone.effects, 'screenGone');
    expect(check).toMatchObject({ at: t + SCREEN_AWAY_MS, turnId: room.turn!.id });
    const res = fire(gone.room, check);
    if (!res.ok) throw new Error(res.error);
    expect(res.room.paused).toEqual({
      reasons: ['screenAway'],
      since: t + SCREEN_AWAY_MS,
      remainingMs: room.turn!.endsAt! - (t + SCREEN_AWAY_MS),
      resumeAt: null,
    });
    expect(res.room.timerEpoch).toBe(gone.room.timerEpoch + 1);
  });

  it('a Screen back within 3 s pauses nothing', () => {
    const { room, at } = started();
    const gone = step(room, screens(0), at + 10_000);
    const back = step(gone.room, screens(1), at + 12_000).room;
    expect(back.screenAwaySince).toBeNull();
    expect(fire(back, only(gone.effects, 'screenGone'))).toEqual({
      ok: false,
      error: 'staleTimer',
    });
    expect(back.turn!.endsAt).toBe(room.turn!.endsAt);
  });

  it('gone again after a blip: only the second absence’s check pauses, 3 s after it', () => {
    const { room, at } = started();
    const first = step(room, screens(0), at + 10_000);
    const back = step(first.room, screens(1), at + 11_000).room;
    const second = step(back, screens(0), at + 12_000);
    // Same epoch, but it was the first absence's: too early for the second.
    expect(fire(second.room, only(first.effects, 'screenGone'))).toEqual({
      ok: false,
      error: 'staleTimer',
    });
    const res = fire(second.room, only(second.effects, 'screenGone'));
    expect(res.ok && res.room.paused?.since).toBe(at + 12_000 + SCREEN_AWAY_MS);
  });

  it('one of two Screens leaving pauses nothing', () => {
    const { room, at } = started();
    const two = step(room, screens(2), at + 1000).room;
    const res = step(two, screens(1), at + 2000);
    expect(scheduled(res.effects, 'screenGone')).toEqual([]);
    expect(res.room.screenAwaySince).toBeNull();
  });

  it('a Screen rejoining: the reason clears into the 3-2-1, then the clock goes on with what it had', () => {
    const { room, before, t } = screenPaused();
    const backAt = t + SCREEN_AWAY_MS + 7000;
    const back = step(room, screens(1), backAt);
    expect(back.room.paused).toMatchObject({ reasons: [], resumeAt: backAt + RESUME_COUNTDOWN_MS });
    expect(back.room.screenAwaySince).toBeNull();
    const go = fire(back.room, only(back.effects, 'resumeGo'));
    if (!go.ok) throw new Error(go.error);
    expect(go.room.paused).toBeNull();
    const pausedFor = backAt + RESUME_COUNTDOWN_MS - (t + SCREEN_AWAY_MS);
    expect(go.room.turn!.endsAt).toBe(before.turn!.endsAt! + pausedFor);
  });

  it('every view says the game waits for the Screen, and guesses are refused', () => {
    const { room, pids, t } = screenPaused();
    const now = t + SCREEN_AWAY_MS + 1000;
    const phone = toView(room, { kind: 'player', pid: pids[1]! }, now);
    expect(phone.paused?.reasons).toEqual(['screenAway']);
    expect(
      reduce(
        room,
        {
          type: 'player:guess',
          by: asPlayer(pids[1]!),
          text: secretWord(room),
          receivedAt: now,
          oneWayMs: 0,
        },
        now,
      ),
    ).toEqual({ ok: false, error: 'paused' });
  });

  it('in CHOOSING too, with the choice’s time frozen', () => {
    const { room, at } = dealt();
    const gone = step(room, screens(0), at + 2000);
    const res = fire(gone.room, only(gone.effects, 'screenGone'));
    expect(res.ok && res.room.paused).toMatchObject({
      reasons: ['screenAway'],
      remainingMs: CHOOSE_MS - 2000 - SCREEN_AWAY_MS,
    });
  });

  it('survives the auto-pick: the check is re-armed at the new epoch, still 3 s after', () => {
    const { room, at } = dealt();
    const gone = step(room, screens(0), at + 11_000);
    const chooseUp: Scheduled = {
      type: 'schedule',
      timer: 'chooseUp',
      at: at + CHOOSE_MS,
      turnId: room.turn!.id,
      epoch: room.timerEpoch,
    };
    const picked = fire(gone.room, chooseUp);
    if (!picked.ok) throw new Error(picked.error);
    expect(picked.room.phase).toBe('DRAWING');
    expect(fire(picked.room, only(gone.effects, 'screenGone'))).toEqual({
      ok: false,
      error: 'staleTimer',
    });
    const check = only(picked.effects, 'screenGone');
    expect(check.at).toBe(at + 11_000 + SCREEN_AWAY_MS);
    const res = fire(picked.room, check);
    expect(res.ok && res.room.paused?.reasons).toEqual(['screenAway']);
  });

  it('nothing pauses in LOBBY, REVEAL or SCOREBOARD', () => {
    const lobby = withPlayers(['Ana', 'Ben']).room;
    for (const room of [lobby, inPhase('REVEAL'), inPhase('SCOREBOARD')]) {
      const res = step(room, screens(0), 3_000_000);
      expect(scheduled(res.effects, 'screenGone'), room.phase).toEqual([]);
      expect(res.room.screenAwaySince, room.phase).toBeNull();
      expect(res.room.paused, room.phase).toBeNull();
    }
  });

  it('the 3 s count from when the turn finds no Screen: gone in REVEAL, paused 3 s into CHOOSING', () => {
    const reveal = inPhase('REVEAL');
    const gone = step(reveal, screens(0), 3_000_000).room;
    const next = step(gone, { type: 'host:next', by: asPlayer(gone.crownPid!, true) }, 3_001_000);
    expect(next.room.phase).toBe('CHOOSING');
    expect(next.room.screenAwaySince).toBe(3_001_000);
    const check = only(next.effects, 'screenGone');
    expect(check.at).toBe(3_001_000 + SCREEN_AWAY_MS);
    const res = fire(next.room, check);
    expect(res.ok && res.room.paused?.reasons).toEqual(['screenAway']);
  });

  it('a skip during the pause: leaving DRAWING clears it into the 3-2-1', () => {
    const { room, pids, t } = screenPaused();
    const res = step(room, { type: 'host:skip', by: asPlayer(pids[0]!, true) }, t + 5000);
    expect(res.room.phase).toBe('REVEAL');
    expect(res.room.paused).toMatchObject({
      reasons: [],
      resumeAt: t + 5000 + RESUME_COUNTDOWN_MS,
    });
    expect(res.room.screenAwaySince).toBeNull();
  });

  it('a host pause during the 3 s: the check is re-armed and both reasons hold', () => {
    const { room, pids, at } = started();
    const t = at + 10_000;
    const gone = step(room, screens(0), t);
    const held = step(gone.room, { type: 'host:pause', by: asPlayer(pids[0]!, true) }, t + 1000);
    const check = only(held.effects, 'screenGone');
    expect(check).toMatchObject({ at: t + SCREEN_AWAY_MS, epoch: held.room.timerEpoch });
    const res = fire(held.room, check);
    if (!res.ok) throw new Error(res.error);
    expect(res.room.paused?.reasons).toEqual(['host', 'screenAway']);
    // The host's Resume leaves the Screen's reason holding the game.
    const resumed = step(res.room, { type: 'host:resume', by: asPlayer(pids[0]!, true) }, t + 5000);
    expect(resumed.room.paused).toMatchObject({ reasons: ['screenAway'], resumeAt: null });
    expect(scheduled(resumed.effects, 'resumeGo')).toEqual([]);
  });

  it('host:end clears it', () => {
    const { room, pids, t } = screenPaused();
    const res = step(room, { type: 'host:end', by: asPlayer(pids[0]!, true) }, t + 5000);
    expect(res.room.phase).toBe('FINAL');
    expect(res.room.paused).toBeNull();
    expect(res.room.screenAwaySince).toBeNull();
  });

  it('a room no Screen ever joined starts its first turn paused 3 s in', () => {
    const { room } = withPlayers(['Ana', 'Ben'], makeRoom({ screens: 0 }));
    const res = step(room, { type: 'host:start', by: asPlayer(room.crownPid!, true) }, 2_000_000);
    expect(only(res.effects, 'screenGone').at).toBe(2_000_000 + SCREEN_AWAY_MS);
  });
});

// ---------- F41: too few players ----------

describe('fewPlayers', () => {
  it('down to 1 connected mid-turn: paused at once with the clock frozen', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const t = at + 10_000;
    const res = step(room, drop(pids[1]!), t);
    expect(res.room.paused).toEqual({
      reasons: ['fewPlayers'],
      since: t,
      remainingMs: room.turn!.endsAt! - t,
      resumeAt: null,
    });
    expect(res.room.timerEpoch).toBe(room.timerEpoch + 1);
    expect(toView(res.room, { kind: 'player', pid: pids[0]! }, t).paused?.reasons).toEqual([
      'fewPlayers',
    ]);
  });

  it('back to 2: the 3-2-1, then the clock goes on with what it had', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const t = at + 10_000;
    const few = step(room, drop(pids[1]!), t).room;
    const back = step(few, rejoin('Ben'), t + 5000);
    expect(back.room.paused).toMatchObject({
      reasons: [],
      resumeAt: t + 5000 + RESUME_COUNTDOWN_MS,
    });
    const go = fire(back.room, only(back.effects, 'resumeGo'));
    if (!go.ok) throw new Error(go.error);
    expect(go.room.paused).toBeNull();
    expect(go.room.turn!.endsAt).toBe(room.turn!.endsAt! + 5000 + RESUME_COUNTDOWN_MS);
  });

  it('a new player joining makes 2 too', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const few = step(room, drop(pids[1]!), at + 1000).room;
    const res = step(
      few,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'key-Cy', name: 'Cy', avatar: '🦊' },
      at + 2000,
    );
    expect(res.room.paused?.reasons).toEqual([]);
  });

  it('a hidden phone is still connected: no pause', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const res = step(room, hide(pids[1]!), at + 1000);
    expect(res.room.paused).toBeNull();
  });

  it('players leaving count as well as disconnecting', () => {
    const { room, pids, at } = started(['Ana', 'Ben', 'Cy']);
    const left = step(room, { type: 'player:leave', by: asPlayer(pids[1]!) }, at + 1000).room;
    expect(left.paused).toBeNull();
    const res = step(left, drop(pids[2]!), at + 2000);
    expect(res.room.paused?.reasons).toEqual(['fewPlayers']);
  });

  it('in CHOOSING, REVEAL and SCOREBOARD too, with their timers held', () => {
    const choosing = dealt(['Ana', 'Ben']).room;
    for (const room of [choosing, inPhase('REVEAL'), inPhase('SCOREBOARD')]) {
      const other = Object.keys(room.players).find((pid) => pid !== room.crownPid)!;
      const res = step(room, drop(other), 3_000_000);
      expect(res.room.paused?.reasons, room.phase).toEqual(['fewPlayers']);
      expect(res.room.paused?.remainingMs, room.phase).not.toBeNull();
    }
  });

  it('not in LOBBY or FINAL', () => {
    const lobby = withPlayers(['Ana', 'Ben']);
    expect(step(lobby.room, drop(lobby.pids[1]!), 2_000_000).room.paused).toBeNull();
    const final = inPhase('FINAL');
    const other = Object.keys(final.players).find((pid) => pid !== final.crownPid)!;
    expect(step(final, drop(other), 3_000_000).room.paused).toBeNull();
  });

  it('nobody connected: still one reason', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const one = step(room, drop(pids[1]!), at + 1000).room;
    const none = step(one, drop(pids[0]!), at + 2000).room;
    expect(none.paused?.reasons).toEqual(['fewPlayers']);
  });

  it('the host can End game during it', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const few = step(room, drop(pids[1]!), at + 1000).room;
    const res = step(few, { type: 'host:end', by: asPlayer(pids[0]!, true) }, at + 2000);
    expect(res.room.phase).toBe('FINAL');
    expect(res.room.paused).toBeNull();
  });

  it('dropping again during the 3-2-1 stops it', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const few = step(room, drop(pids[1]!), at + 1000).room;
    const back = step(few, rejoin('Ben'), at + 2000);
    const again = step(back.room, drop(pids[1]!), at + 3000).room;
    expect(again.paused).toMatchObject({ reasons: ['fewPlayers'], resumeAt: null });
    expect(fire(again, only(back.effects, 'resumeGo'))).toEqual({
      ok: false,
      error: 'staleTimer',
    });
  });
});

// ---------- F41: several reasons ----------

describe('several pause reasons', () => {
  it('screenAway and fewPlayers: the game resumes only when both clear', () => {
    const { room, pids, before, t } = screenPaused();
    const few = step(step(room, drop(pids[1]!), t + 4000).room, drop(pids[2]!), t + 4500).room;
    expect(few.paused?.reasons).toEqual(['screenAway', 'fewPlayers']);
    const screenBack = step(few, screens(1), t + 6000);
    expect(screenBack.room.paused).toMatchObject({ reasons: ['fewPlayers'], resumeAt: null });
    expect(scheduled(screenBack.effects, 'resumeGo')).toEqual([]);
    const benBack = step(screenBack.room, rejoin('Ben'), t + 8000);
    expect(benBack.room.paused).toMatchObject({
      reasons: [],
      resumeAt: t + 8000 + RESUME_COUNTDOWN_MS,
    });
    const go = fire(benBack.room, only(benBack.effects, 'resumeGo'));
    if (!go.ok) throw new Error(go.error);
    expect(go.room.paused).toBeNull();
    const pausedFor = t + 8000 + RESUME_COUNTDOWN_MS - (t + SCREEN_AWAY_MS);
    expect(go.room.turn!.endsAt).toBe(before.turn!.endsAt! + pausedFor);
  });

  it('a Screen gone during a fewPlayers pause still adds screenAway 3 s on', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const few = step(room, drop(pids[1]!), at + 1000).room;
    const gone = step(few, screens(0), at + 2000);
    const res = fire(gone.room, only(gone.effects, 'screenGone'));
    if (!res.ok) throw new Error(res.error);
    expect(res.room.paused?.reasons).toEqual(['fewPlayers', 'screenAway']);
    // Ben back: the Screen still holds it.
    const ben = step(res.room, rejoin('Ben'), at + 6000).room;
    expect(ben.paused).toMatchObject({ reasons: ['screenAway'], resumeAt: null });
  });

  it('the drawer gone for 30 s with too few players: the turn ends but the game stays paused', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const t = at + 10_000;
    const gone = step(room, drop(pids[0]!), t);
    expect(gone.room.paused?.reasons).toEqual(['fewPlayers']);
    const away = fire(gone.room, only(gone.effects, 'drawerAwayCheck'));
    if (!away.ok) throw new Error(away.error);
    expect(away.room.paused?.reasons).toEqual(['fewPlayers', 'drawerAway']);
    const res = fire(away.room, only(away.effects, 'drawerGone'));
    if (!res.ok) throw new Error(res.error);
    expect(res.room.phase).toBe('REVEAL');
    expect(res.room.turn!.endReason).toBe('drawerGone');
    expect(res.room.paused).toMatchObject({ reasons: ['fewPlayers'], resumeAt: null });
    expect(scheduled(res.effects, 'revealDone')).toEqual([]);
  });

  it('all four: Resume and each return clear only their own', () => {
    const { room, pids, t } = awayPaused();
    const held = step(room, PAUSE, t + 3000).room;
    const gone = step(held, screens(0), t + 3500);
    const screenOff = fire(gone.room, only(gone.effects, 'screenGone'));
    if (!screenOff.ok) throw new Error(screenOff.error);
    const few = step(screenOff.room, drop(pids[1]!), t + 7000);
    const all = step(few.room, drop(pids[2]!), t + 7100).room;
    expect([...all.paused!.reasons].sort()).toEqual(
      ['drawerAway', 'fewPlayers', 'host', 'screenAway'].sort(),
    );
    let r = step(all, RESUME, t + 8000).room;
    r = step(r, hide(pids[0]!, false), t + 9000).room;
    r = step(r, screens(1), t + 10_000).room;
    expect(r.paused).toMatchObject({ reasons: ['fewPlayers'], resumeAt: null });
    const last = step(r, rejoin('Cy'), t + 11_000).room;
    expect(last.paused).toMatchObject({ reasons: [], resumeAt: t + 11_000 + RESUME_COUNTDOWN_MS });
  });
});

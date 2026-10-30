// Phone helpers: the drawer's layout numbers (UI by role and phase, Drawer layout), what a join
// answer means for the page, and the pad's first-pointer rule. Presentation only.

import { OWN_GUESSES_SHOWN } from '../../../shared/constants.js';
import type { Ack, Fx, PlayerView, TimerView } from '../../../shared/types.js';
import type { CopyKey } from './copy.js';

/** The top bar: the word (small), the timer, "2 of 4 got it" and the latest guess. */
export const DRAWER_BAR_PX = 56;
/** Each of the two toolbar rows under the pad. */
export const DRAWER_TOOL_ROW_PX = 48;
/** Breathing room around the pad: 4 px each side, 16 px in total above and below. */
const PAD_SIDE_GAP_PX = 8;
const PAD_VERTICAL_GAP_PX = 16;

/**
 * The square pad's side in CSS px: min(viewport width − 8, viewport height − 56 − 2 × 48 − 16).
 * Pass the space left after safe-area insets. Floored, so the layout never rounds past the edge.
 */
export function drawerPadSize(width: number, height: number): number {
  const byWidth = width - PAD_SIDE_GAP_PX;
  const byHeight = height - DRAWER_BAR_PX - 2 * DRAWER_TOOL_ROW_PX - PAD_VERTICAL_GAP_PX;
  return Math.max(0, Math.floor(Math.min(byWidth, byHeight)));
}

/** The pad at the smallest supported phone (360 × 560): a landscape pad below it doesn't fit. */
const MIN_UPRIGHT_PAD_PX = drawerPadSize(360, 560);

/**
 * Whether the drawer should be asked to "Turn your phone upright" (Edge cases, phone rotated to
 * landscape while drawing): the viewport is landscape and the pad would be smaller than at the
 * minimum supported phone. A landscape tablet keeps its pad; portrait never asks.
 */
// SPEC-QUESTION: "keeps its square size where it fits" is read as a landscape pad at least as big as the 360 × 560 one (DECISIONS 54).
export function drawerSideways(width: number, height: number): boolean {
  return width > height && drawerPadSize(width, height) < MIN_UPRIGHT_PAD_PX;
}

/** How far into DRAWING an empty pad gets "Start with one big shape. Anything helps!". */
export const INK_NUDGE_AFTER_MS = 10_000;

/**
 * Whether the drawer's pad shows "Start with one big shape. Anything helps!": 10 s into the turn's
 * clock (`left` is what `useCountdown` gives) with nothing drawn yet this turn. Once the drawer
 * has drawn, it never comes back that turn, even if they clear. Not before the turn's ink is in
 * (`ready`), so a reload with ink on the pad doesn't flash it.
 */
// SPEC-QUESTION: "10 s into DRAWING" counts on the turn's clock, and "gone on the first stroke" stays gone for the turn (DECISIONS 58).
export function inkNudge(
  timer: TimerView | null,
  left: number,
  pad: { ready: boolean; drew: boolean },
): boolean {
  if (!pad.ready || pad.drew || !timer) return false;
  return timer.totalMs - left >= INK_NUDGE_AFTER_MS;
}

// ---------- Joining ----------

/**
 * The turn a phone joining mid-game is welcomed into ("You're in! Mika is drawing. Type your
 * guess."): given the first view after a new player's join, the turn in play if they are a guesser
 * in it (CHOOSING or DRAWING), else null. A stored player rejoining isn't asked.
 */
export function welcomeTurn(view: PlayerView): number | null {
  const { phase, turn } = view;
  if (phase !== 'CHOOSING' && phase !== 'DRAWING') return null;
  return turn && turn.drawerPid !== view.me.pid ? turn.id : null;
}

/**
 * Whether a phone keeps its screen on (Guesser phone: "Wake Lock requested during a game"): from
 * the first deal to the final scores, a pause and a rematch countdown included. Not in the lobby
 * (nobody is waiting on this phone there, and a sleeping phone rejoins silently), and not with no
 * view (joining, ended, removed).
 */
// SPEC-QUESTION: "during a game" read as CHOOSING through FINAL, not the lobby (DECISIONS 59).
export function phoneWakeLock(view: PlayerView | null): boolean {
  return view !== null && view.phase !== 'LOBBY';
}

/**
 * Whether `next` brings this phone the crown that `prev` didn't have, for the "You're the host now
 * 👑" toast. Never on the first view (the first joiner's lobby already says "You're the host 👑"),
 * and only for the same player.
 */
export function gainedCrown(prev: PlayerView | null, next: PlayerView): boolean {
  return prev !== null && prev.me.pid === next.me.pid && prev.host === null && next.host !== null;
}

/** What the phone shows after a `player:join` answer. */
export type JoinOutcome =
  | { status: 'live' }
  | { status: 'ended' }
  | { status: 'removed' }
  /** The name belongs to a disconnected player: "Are you Jun? · Rejoin as Jun / Pick another name". */
  | { status: 'takeOver' }
  | { status: 'form'; error: CopyKey };

/**
 * `alreadyJoined` is a late answer to an earlier try that already let the socket in. Anything else
 * that isn't a missing room or a kick goes back to the name step: a name in use, a full room, or a
 * stored player who is no longer in the room (they left, or it is a new room with the same code).
 */
export function joinOutcome(res: Ack): JoinOutcome {
  if (res.ok || res.error === 'alreadyJoined') return { status: 'live' };
  switch (res.error) {
    case 'roomNotFound':
      return { status: 'ended' };
    case 'kicked':
      return { status: 'removed' };
    case 'nameOfDisconnected':
      return { status: 'takeOver' };
    case 'nameTaken':
      return { status: 'form', error: 'nameTaken' };
    case 'roomFull':
      return { status: 'form', error: 'roomFull' };
    case 'rateLimited':
      return { status: 'form', error: 'joinTooMany' };
    default:
      return { status: 'form', error: 'joinFailed' };
  }
}

// ---------- Guessing ----------

/** How long a note under the guess box ("Slow down") stays up. */
export const GUESS_NOTICE_MS = 1_500;

/** What the guess box does with a `player:guess` answer (`null`: lost or timed out). */
export interface GuessAnswer {
  /** A short note under the box. */
  notice: CopyKey | null;
  /** Put the guess back in the box (if it's still empty), so it can be sent again. */
  restore: boolean;
}

/**
 * Over the 700 ms limit the server refused the guess unread: "Slow down", and the text goes
 * back in the box. Every other answer clears it: a wrong, close or right guess is answered by
 * `fx` and the next view, and the other refusals (too late, already got it) can't be retried.
 */
export function guessAnswer(res: Ack | null): GuessAnswer {
  if (res && !res.ok && res.error === 'slowDown') return { notice: 'slowDown', restore: true };
  return { notice: null, restore: false };
}

/** One of this phone's own guesses this turn, with what the server said about it. */
export interface OwnGuess {
  text: string;
  close: boolean;
}

/** This phone's own guesses, kept for one turn. */
export interface OwnGuesses {
  turnId: number;
  items: OwnGuess[];
}

/**
 * Adds an answered guess ("payong ✗", or "tsinelas ko ≈" after a near miss) to this turn's list,
 * starting again on a new turn and keeping the last `OWN_GUESSES_SHOWN`.
 */
export function addOwnGuess(prev: OwnGuesses, turnId: number, guess: OwnGuess): OwnGuesses {
  const items = prev.turnId === turnId ? prev.items : [];
  return { turnId, items: [...items, guess].slice(-OWN_GUESSES_SHOWN) };
}

// ---------- The pad's pointer ----------

/**
 * Only the first pointer down on the pad draws; a second finger or a palm is ignored until the
 * first lifts (Stopping scroll and zoom). `up` (pointerup, pointercancel, lost capture) returns
 * true when it ended the stroke in hand.
 */
export interface PointerGate {
  down(pointerId: number): boolean;
  owns(pointerId: number): boolean;
  up(pointerId: number): boolean;
}

export function createPointerGate(): PointerGate {
  let active: number | null = null;
  return {
    down(pointerId) {
      if (active !== null) return false;
      active = pointerId;
      return true;
    },
    owns: (pointerId) => active === pointerId,
    up(pointerId) {
      if (active !== pointerId) return false;
      active = null;
      return true;
    },
  };
}

/** How long the drawer's phone vibrates on "your turn". */
export const YOUR_TURN_VIBRATE_MS = 200;

/**
 * How long an `fx` vibrates this phone, or null. Phones are otherwise silent (Overview: Sound):
 * "your turn" is the only vibration and the only cue a phone makes.
 */
export function fxVibration(fx: Fx): number | null {
  return fx.kind === 'yourTurn' ? YOUR_TURN_VIBRATE_MS : null;
}

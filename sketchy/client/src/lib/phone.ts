// Phone helpers: the drawer's layout numbers (UI by role and phase, Drawer layout), what a join
// answer means for the page, and the pad's first-pointer rule. Presentation only.

import { OWN_GUESSES_SHOWN } from '../../../shared/constants.js';
import type { Ack, PlayerView } from '../../../shared/types.js';
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

/** What the phone shows after a `player:join` answer. */
export type JoinOutcome =
  | { status: 'live' }
  | { status: 'ended' }
  | { status: 'removed' }
  | { status: 'form'; error: CopyKey };

/**
 * `alreadyJoined` is a late answer to an earlier try that already let the socket in. Anything else
 * that isn't a missing room or a kick goes back to the name step: a name in use, a full room, or a
 * stored player who is no longer in the room (they left, or it is a new room with the same code).
 */
// SPEC-QUESTION: "Are you Jun? · Rejoin as Jun" for `nameOfDisconnected` is F42; until then it reads as a taken name (DECISIONS 29).
export function joinOutcome(res: Ack): JoinOutcome {
  if (res.ok || res.error === 'alreadyJoined') return { status: 'live' };
  switch (res.error) {
    case 'roomNotFound':
      return { status: 'ended' };
    case 'kicked':
      return { status: 'removed' };
    case 'nameTaken':
    case 'nameOfDisconnected':
      return { status: 'form', error: 'nameTaken' };
    case 'roomFull':
      return { status: 'form', error: 'roomFull' };
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

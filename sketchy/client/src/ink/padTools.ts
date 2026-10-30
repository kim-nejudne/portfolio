// The drawer pad's Undo and Clear (Canvas and drawing tools, Tools): each changes the pad's own
// action stack and sends the same op, so the pad, the server and every Screen keep one picture.
// Undo pops the last action (a stroke, or a clear, which brings the drawing back); Clear pushes a
// clear, undoable, so no confirm. Both wait for the sender to start (the turn's snapshot is in):
// before that the pad doesn't hold the ink drawn before a reload, which a `u` would pop.

import { popAction, pushClear, visibleStrokes, type InkStack } from '../../../shared/ink.js';
import type { InkSender } from './inkSender.js';

export interface PadState {
  /** The turn's snapshot is in: the pad holds every stroke of the turn, ink from before a reload too. */
  ready: boolean;
  canUndo: boolean;
  canClear: boolean;
}

export function padState(stack: InkStack, sender: InkSender): PadState {
  const started = sender.started();
  return {
    ready: started,
    canUndo: started && stack.actions.length > 0,
    canClear: started && visibleStrokes(stack).length > 0,
  };
}

/** Undoes the last action on the pad and sends `u`; false when there is nothing to undo. */
export function padUndo(stack: InkStack, sender: InkSender): boolean {
  if (!padState(stack, sender).canUndo) return false;
  sender.undo();
  popAction(stack);
  return true;
}

/** Clears the pad and sends `c`; false when the canvas is already empty. */
export function padClear(stack: InkStack, sender: InkSender): boolean {
  if (!padState(stack, sender).canClear) return false;
  sender.clear();
  pushClear(stack);
  return true;
}

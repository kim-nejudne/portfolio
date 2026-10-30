// The Screen's short-lived turn effects (UI by role and phase, Screen; Guess feed and rude guesses):
// "Jun got it!", wrong-guess speech bubbles and floating reactions. They come from `fx` events,
// never from the snapshot, and each lasts a fixed time. A store for `useSyncExternalStore`.

import type { Fx, Reaction } from '../../../shared/types.js';

/** "Jun got it!" stays up this long. */
export const ANNOUNCE_MS = 2000;
/** A wrong guess's speech bubble stays up this long. */
export const BUBBLE_MS = 2000;
/** At most this many bubbles at once; extras only go to the feed list. */
export const BUBBLES_MAX = 3;
/** A reaction floats up for this long. */
export const FLOAT_MS = 2000;
/** At most this many reactions in the air (ten players at one a second each, twice over). */
export const FLOATS_MAX = 20;

export interface GotIt {
  id: number;
  pid: string;
}
export interface Bubble {
  id: number;
  pid: string;
  /** `null` when masked, or when the feed is off ("Bea is guessing…"). */
  text: string | null;
}
export interface Float {
  id: number;
  pid: string;
  emoji: Reaction;
}

export interface ScreenFxState {
  gotIt: GotIt[];
  bubbles: Bubble[];
  floats: Float[];
}

export const NO_FX: ScreenFxState = { gotIt: [], bubbles: [], floats: [] };

export interface ScreenFx {
  push(fx: Fx): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): ScreenFxState;
}

export function createScreenFx(): ScreenFx {
  let state = NO_FX;
  let nextId = 1;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();

  const set = (next: ScreenFxState) => {
    state = next;
    for (const l of listeners) l();
  };
  const drop = (ids: number[]) => {
    for (const id of ids) {
      clearTimeout(timers.get(id));
      timers.delete(id);
    }
  };
  /** Removes item `id` from `list` after `ms`. */
  const expire = (list: keyof ScreenFxState, id: number, ms: number) => {
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        set({ ...state, [list]: state[list].filter((x) => x.id !== id) });
      }, ms),
    );
  };

  return {
    push(fx) {
      const id = nextId++;
      if (fx.kind === 'correct') {
        const old = state.gotIt.filter((g) => g.pid === fx.pid);
        drop(old.map((g) => g.id));
        set({
          ...state,
          gotIt: [...state.gotIt.filter((g) => g.pid !== fx.pid), { id, pid: fx.pid }],
        });
        expire('gotIt', id, ANNOUNCE_MS);
      } else if (fx.kind === 'wrongGuess') {
        // A guesser's newer guess replaces their own bubble; otherwise a full set drops it.
        const own = state.bubbles.filter((b) => b.pid === fx.pid);
        if (own.length === 0 && state.bubbles.length >= BUBBLES_MAX) return;
        drop(own.map((b) => b.id));
        const rest = state.bubbles.filter((b) => b.pid !== fx.pid);
        set({ ...state, bubbles: [...rest, { id, pid: fx.pid, text: fx.text }] });
        expire('bubbles', id, BUBBLE_MS);
      } else if (fx.kind === 'reaction') {
        const floats = [...state.floats, { id, pid: fx.pid, emoji: fx.emoji }];
        const over = floats.splice(0, Math.max(0, floats.length - FLOATS_MAX));
        drop(over.map((f) => f.id));
        set({ ...state, floats });
        expire('floats', id, FLOAT_MS);
      }
    },
    clear() {
      drop([...timers.keys()]);
      set(NO_FX);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
  };
}

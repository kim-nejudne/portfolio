// The Screen's FINAL gallery: each finished drawing's frozen action stack, asked for with
// `ink:get {turnId}` (Reconnects and snapshots, Gallery in FINAL). Screen sockets only; phones
// never load this module.
//
// A drawing the room no longer keeps (`inkNotKept`: past the 4 MB budget, or reset) shows
// "Drawing not kept". Any other failure (a timeout, `rateLimited`, an `/ink` socket not yet
// hello'd) is asked again later, waiting twice as long each time; asking again after a new hello
// keeps that count, so a reconnect can't repeat a rate-limited burst at full speed.

import { applyInkOps, createInkStack, type InkStack } from '../../../shared/ink.js';
import type { Ack, InkOp } from '../../../shared/types.js';

export type GalleryEntry =
  { status: 'loading' } | { status: 'ready'; stack: InkStack } | { status: 'notKept' };

/** Sends `ink:get`; rejects on a timeout. */
export type GalleryFetch = (turnId: number) => Promise<Ack<{ turnId: number; actions: InkOp[] }>>;

/** First wait before asking again after a failure; doubled per failure, up to the max. */
export const GALLERY_RETRY_MS = 2000;
const GALLERY_RETRY_MAX_MS = 16_000;

export interface ScreenGallery {
  /** Asks for each drawing not already held or on its way. */
  want(turnIds: readonly number[]): void;
  /** Asks at once for every drawing waiting to retry (the `/ink` socket said hello again). */
  retry(): void;
  get(turnId: number): GalleryEntry | undefined;
  /** Grows on every change, for `useSyncExternalStore`. */
  version(): number;
  subscribe(listener: () => void): () => void;
  /** Forgets every drawing (the game left FINAL); answers still on their way are dropped. */
  clear(): void;
}

export function createScreenGallery(
  fetch: GalleryFetch,
  retryMs = GALLERY_RETRY_MS,
): ScreenGallery {
  let entries = new Map<number, GalleryEntry>();
  // Drawings waiting to ask again: their timer and how many times they failed.
  let waiting = new Map<number, { timer: ReturnType<typeof setTimeout>; failures: number }>();
  let inFlight = new Set<number>();
  let generation = 0;
  let version = 0;
  const listeners = new Set<() => void>();
  const changed = () => {
    version += 1;
    for (const listener of listeners) listener();
  };

  const ask = (turnId: number, failures: number) => {
    const asked = generation;
    inFlight.add(turnId);
    const settle = (entry: GalleryEntry | null) => {
      if (asked !== generation) return;
      inFlight.delete(turnId);
      if (entry) {
        entries.set(turnId, entry);
        return changed();
      }
      const delay = Math.min(GALLERY_RETRY_MAX_MS, retryMs * 2 ** failures);
      const timer = setTimeout(() => {
        waiting.delete(turnId);
        ask(turnId, failures + 1);
      }, delay);
      waiting.set(turnId, { timer, failures: failures + 1 });
    };
    fetch(turnId).then(
      (res) => {
        if (res.ok) {
          const stack = createInkStack();
          applyInkOps(stack, res.actions);
          settle({ status: 'ready', stack });
        } else if (res.error === 'inkNotKept') {
          settle({ status: 'notKept' });
        } else settle(null);
      },
      () => settle(null),
    );
  };

  return {
    want(turnIds) {
      let added = false;
      for (const turnId of turnIds) {
        if (entries.has(turnId)) continue;
        entries.set(turnId, { status: 'loading' });
        added = true;
        ask(turnId, 0);
      }
      if (added) changed();
    },
    retry() {
      for (const [turnId, { timer, failures }] of waiting) {
        clearTimeout(timer);
        if (!inFlight.has(turnId)) ask(turnId, failures);
      }
      waiting = new Map();
    },
    get: (turnId) => entries.get(turnId),
    version: () => version,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      if (entries.size === 0) return;
      for (const { timer } of waiting.values()) clearTimeout(timer);
      generation += 1;
      entries = new Map();
      waiting = new Map();
      inFlight = new Set();
      changed();
    },
  };
}

/**
 * What a key does to the gallery: ← → page the open drawing (clamped at the ends) or, with none
 * open, open the first or last; Esc closes, except during a rematch countdown, where Esc is the
 * host's Cancel. `null` leaves the key alone.
 */
export function galleryKey(
  key: string,
  openIndex: number,
  count: number,
  counting: boolean,
): { open: number } | 'close' | null {
  if (count === 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowLeft') {
    const step = key === 'ArrowRight' ? 1 : -1;
    if (openIndex < 0) return { open: step > 0 ? 0 : count - 1 };
    return { open: Math.min(count - 1, Math.max(0, openIndex + step)) };
  }
  if (key === 'Escape' && openIndex >= 0 && !counting) return 'close';
  return null;
}

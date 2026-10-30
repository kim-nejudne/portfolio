// The Screen's lobby doodles (Lobby doodles): each player's action stack, by pid, from the `/ink`
// snapshot (`doodles`) and the `doodle {pid, ops}` relays after it. Chips draw a player's doodle as
// their avatar once their view says `hasDoodle`. Only Screens hold this: phones never get doodles.

import { createContext } from 'react';
import { applyInkOps, createInkStack, type InkStack } from '../../../shared/ink.js';
import type { InkOp } from '../../../shared/types.js';

export interface ScreenDoodles {
  /** A snapshot's doodles replace every one held (none when it carries none). */
  replace(doodles: Record<string, InkOp[]> | undefined): void;
  apply(pid: string, ops: readonly InkOp[]): void;
  get(pid: string): InkStack | undefined;
  /** Grows whenever `pid`'s doodle changes (a relay for it, or a snapshot), so only its avatar redraws. */
  version(pid: string): number;
  /** `pid` is the doodle that changed, or undefined when all were replaced. */
  subscribe(listener: (pid?: string) => void): () => void;
}

export function createScreenDoodles(): ScreenDoodles {
  let stacks = new Map<string, InkStack>();
  // A snapshot bumps every pid's version at once (`base`); a relay bumps one.
  let base = 0;
  const bumps = new Map<string, number>();
  const listeners = new Set<(pid?: string) => void>();
  const emit = (pid?: string) => {
    if (pid === undefined) base += 1;
    else bumps.set(pid, (bumps.get(pid) ?? 0) + 1);
    for (const listener of listeners) listener(pid);
  };
  return {
    replace(doodles) {
      stacks = new Map();
      for (const [pid, ops] of Object.entries(doodles ?? {})) {
        const stack = createInkStack();
        applyInkOps(stack, ops);
        stacks.set(pid, stack);
      }
      emit();
    },
    apply(pid, ops) {
      let stack = stacks.get(pid);
      if (!stack) stacks.set(pid, (stack = createInkStack()));
      applyInkOps(stack, ops);
      emit(pid);
    },
    get: (pid) => stacks.get(pid),
    version: (pid) => base + (bumps.get(pid) ?? 0),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Set by the Screen page; phones have none, so their avatars stay initials. */
export const DoodleContext = createContext<ScreenDoodles | null>(null);

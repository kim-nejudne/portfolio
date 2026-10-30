// The drawer's "Bea is close!" (UI by role and phase, Drawer phone): a `closeAlert` fx puts the
// guesser's name in the top bar, in amber, for 2 s. A newer one takes its place and restarts the
// 2 s. A store for `useSyncExternalStore`; the phone clears it when DRAWING ends.

/** "Bea is close!" stays up this long. */
export const CLOSE_ALERT_MS = 2_000;

export interface CloseAlert {
  /** The close guesser. */
  push(pid: string): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
  /** The close guesser's pid while the alert is up, else null. */
  getSnapshot(): string | null;
}

// SPEC-QUESTION: the spec doesn't say what a second close guess within 2 s does; the newer one takes over and restarts the 2 s (DECISIONS 58).
export function createCloseAlert(): CloseAlert {
  let pid: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const set = (next: string | null) => {
    pid = next;
    for (const l of listeners) l();
  };
  return {
    push(next) {
      clearTimeout(timer);
      timer = setTimeout(() => set(null), CLOSE_ALERT_MS);
      set(next);
    },
    clear() {
      clearTimeout(timer);
      if (pid !== null) set(null);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => pid,
  };
}

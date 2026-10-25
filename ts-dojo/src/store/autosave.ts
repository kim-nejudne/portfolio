// Autosave (spec §7 Writes: files are "autosaved 500 ms after the last keystroke"; §9: "the
// editor is the source of truth and files are autosaved"; §12 F5: a buffer survives a reload
// when autosaved within 1 s). One timer per key so a switch between files never delays either
// one's write; `flush` is for unmount and `pagehide`, `forget` for a deleted buffer.
export const AUTOSAVE_DELAY_MS = 500;

export interface Autosave<K> {
  /** A new value for `key`: written `delayMs` after the last touch of that key. */
  touch(key: K, value: string): void;
  /** Writes every pending value now. */
  flush(): void;
  /** Drops a pending write (the buffer was deleted). */
  forget(key: K): void;
  /** The values not yet written, in the order their keys were first touched. */
  pending(): [K, string][];
  /** Flushes, then ignores every later touch. */
  dispose(): void;
}

export function createAutosave<K>(
  write: (key: K, value: string) => void,
  delayMs: number = AUTOSAVE_DELAY_MS,
): Autosave<K> {
  const pending = new Map<
    K,
    { value: string; timer: ReturnType<typeof setTimeout> }
  >();
  let disposed = false;

  const commit = (key: K): void => {
    const entry = pending.get(key);
    if (entry === undefined) return;
    clearTimeout(entry.timer);
    pending.delete(key);
    write(key, entry.value);
  };

  return {
    touch(key, value) {
      if (disposed) return;
      const previous = pending.get(key);
      if (previous !== undefined) clearTimeout(previous.timer);
      pending.set(key, {
        value,
        timer: setTimeout(() => commit(key), delayMs),
      });
    },
    flush() {
      for (const key of [...pending.keys()]) commit(key);
    },
    forget(key) {
      const entry = pending.get(key);
      if (entry === undefined) return;
      clearTimeout(entry.timer);
      pending.delete(key);
    },
    pending() {
      return [...pending.entries()].map(([key, entry]) => [key, entry.value]);
    },
    dispose() {
      this.flush();
      disposed = true;
    },
  };
}

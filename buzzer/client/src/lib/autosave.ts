// Autosave for the set editor (Set editor: "Autosave on every change (debounced 500 ms) with a
// "Saved" indicator"). The timer lives in `Autosaver`, so it can be tested with fake timers.

import { useEffect, useRef, useState } from 'react';

export const AUTOSAVE_DELAY_MS = 500;

/** `saved`: nothing waiting. `pending`: a change waits for the debounce or its write. */
export type SaveStatus = 'saved' | 'pending' | 'error';

/**
 * Saves the latest scheduled value once no new value has arrived for `delayMs`. Writes never
 * overlap: a value scheduled during a write is saved after it. A failed write reports `error` and
 * keeps its value; the next change or `flush` tries again.
 */
export class Autosaver<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private latest: { value: T } | null = null;
  private writing: Promise<void> | null = null;
  private failed = false;

  constructor(
    private readonly save: (value: T) => Promise<void>,
    private readonly onStatus: (status: SaveStatus) => void,
    private readonly delayMs = AUTOSAVE_DELAY_MS,
  ) {}

  schedule(value: T): void {
    this.latest = { value };
    this.failed = false;
    this.onStatus('pending');
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delayMs);
  }

  /** Saves a waiting value now, for example when the editor closes. */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    while (this.writing) await this.writing;
    const next = this.latest;
    if (next === null) return;
    this.latest = null;

    this.writing = this.save(next.value).then(
      () => {
        this.failed = false;
      },
      () => {
        // Keep the value, so a later flush (the editor closing) tries it again.
        this.failed = true;
        this.latest ??= next;
      },
    );
    await this.writing;
    this.writing = null;
    if (this.timer !== null) return;
    if (this.failed) this.onStatus('error');
    else if (this.latest === null) this.onStatus('saved');
  }
}

/**
 * The editor's hook: `schedule` on every change. A change still waiting is written when the
 * component unmounts or the page is hidden (tab closed, app switched).
 */
export function useAutosave<T>(save: (value: T) => Promise<void>) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const saverRef = useRef<Autosaver<T> | null>(null);
  saverRef.current ??= new Autosaver(save, setStatus);

  useEffect(() => {
    const saver = saverRef.current!;
    const flush = () => void saver.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  return { status, schedule: (value: T) => saverRef.current!.schedule(value) };
}

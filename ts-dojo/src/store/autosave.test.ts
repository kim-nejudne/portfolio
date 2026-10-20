// Autosave (spec §7 Writes: "autosaved 500 ms after the last keystroke"; §12 F5: within 1 s):
// one timer per key, the newest value wins, `flush` writes everything pending at once (unmount,
// pagehide), `dispose` flushes and stops.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_DELAY_MS, createAutosave } from './autosave';

describe('createAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits 500 ms after the last change to a key, then writes the newest value', () => {
    const writes: [string, string][] = [];
    const autosave = createAutosave((key: string, value: string) => {
      writes.push([key, value]);
    });
    expect(AUTOSAVE_DELAY_MS).toBe(500);
    autosave.touch('/index.ts', 'a');
    vi.advanceTimersByTime(400);
    autosave.touch('/index.ts', 'ab');
    vi.advanceTimersByTime(400);
    expect(writes).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(writes).toEqual([['/index.ts', 'ab']]);
  });

  it('keeps one timer per key', () => {
    const writes: [string, string][] = [];
    const autosave = createAutosave((key: string, value: string) => {
      writes.push([key, value]);
    });
    autosave.touch('/index.ts', 'a');
    vi.advanceTimersByTime(300);
    autosave.touch('/shapes.ts', 'b');
    vi.advanceTimersByTime(200);
    expect(writes).toEqual([['/index.ts', 'a']]);
    vi.advanceTimersByTime(300);
    expect(writes).toEqual([
      ['/index.ts', 'a'],
      ['/shapes.ts', 'b'],
    ]);
  });

  it('flush writes everything pending now and nothing twice', () => {
    const writes: [string, string][] = [];
    const autosave = createAutosave((key: string, value: string) => {
      writes.push([key, value]);
    });
    autosave.touch('/index.ts', 'a');
    autosave.touch('/shapes.ts', 'b');
    autosave.flush();
    expect(writes).toEqual([
      ['/index.ts', 'a'],
      ['/shapes.ts', 'b'],
    ]);
    vi.advanceTimersByTime(1000);
    expect(writes).toHaveLength(2);
    autosave.flush();
    expect(writes).toHaveLength(2);
  });

  it('forget drops a pending write for a deleted key; dispose flushes the rest', () => {
    const writes: [string, string][] = [];
    const autosave = createAutosave((key: string, value: string) => {
      writes.push([key, value]);
    });
    autosave.touch('/index.ts', 'a');
    autosave.touch('/gone.ts', 'x');
    autosave.forget('/gone.ts');
    autosave.dispose();
    expect(writes).toEqual([['/index.ts', 'a']]);
    autosave.touch('/index.ts', 'late');
    vi.advanceTimersByTime(1000);
    expect(writes, 'nothing after dispose').toEqual([['/index.ts', 'a']]);
  });
});

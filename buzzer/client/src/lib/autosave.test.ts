import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_DELAY_MS, Autosaver, type SaveStatus } from './autosave.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(save: (value: string) => Promise<void> = async () => {}) {
  const saved: string[] = [];
  const statuses: SaveStatus[] = [];
  const saver = new Autosaver<string>(
    async (value) => {
      await save(value);
      saved.push(value);
    },
    (status) => statuses.push(status),
  );
  return { saver, saved, statuses };
}

describe('Autosaver', () => {
  it('saves only after 500 ms without a change', async () => {
    const { saver, saved } = setup();
    saver.schedule('a');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual(['a']);
  });

  it('restarts the wait on each change and saves only the latest value', async () => {
    const { saver, saved } = setup();
    saver.schedule('a');
    await vi.advanceTimersByTimeAsync(400);
    saver.schedule('ab');
    await vi.advanceTimersByTimeAsync(400);
    saver.schedule('abc');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual(['abc']);
  });

  it('reports pending while a change waits, then saved', async () => {
    const { saver, statuses } = setup();
    saver.schedule('a');
    expect(statuses.at(-1)).toBe('pending');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(statuses.at(-1)).toBe('saved');
  });

  it('flush saves a waiting change at once, and nothing is saved twice', async () => {
    const { saver, saved } = setup();
    saver.schedule('a');
    await saver.flush();
    expect(saved).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    await saver.flush();
    expect(saved).toEqual(['a']);
  });

  it('a change made during a write is saved after it, in order', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { saver, saved, statuses } = setup((value) => (value === 'a' ? gate : Promise.resolve()));
    saver.schedule('a');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    saver.schedule('b');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(saved).toEqual([]);
    expect(statuses.at(-1)).toBe('pending');
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toEqual(['a', 'b']);
    expect(statuses.at(-1)).toBe('saved');
  });

  it('reports error when a write fails, and the next change saves again', async () => {
    const { saver, saved, statuses } = setup((value) =>
      value === 'bad' ? Promise.reject(new Error('quota')) : Promise.resolve(),
    );
    saver.schedule('bad');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(statuses.at(-1)).toBe('error');
    saver.schedule('good');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(saved).toEqual(['good']);
    expect(statuses.at(-1)).toBe('saved');
  });

  it('keeps a value whose write failed, so flush on leaving tries it again', async () => {
    let fail = true;
    const { saver, saved, statuses } = setup(() =>
      fail ? Promise.reject(new Error('busy')) : Promise.resolve(),
    );
    saver.schedule('a');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(statuses.at(-1)).toBe('error');
    fail = false;
    await saver.flush();
    expect(saved).toEqual(['a']);
    expect(statuses.at(-1)).toBe('saved');
  });
});

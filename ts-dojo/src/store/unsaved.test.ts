// The unsaved-text journal (§12 F8: "Files are autosaved per exercise and restored on return,
// including after a reload mid-edit"): autosave writes 500 ms after the last keystroke into
// IndexedDB, which is asynchronous and does not finish when the page unloads in that window, so
// `pagehide` also writes what is still waiting to localStorage, synchronously; the exercise
// takes it back on its next mount.
import { describe, expect, it } from 'vitest';
import {
  dropUnsaved,
  journalUnsaved,
  peekUnsaved,
  UNSAVED_KEY,
} from './unsaved';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    map,
  };
}

describe('the unsaved journal', () => {
  it('keeps the waiting texts per exercise, merges later ones and drops them once restored', () => {
    const storage = memoryStorage();
    expect(UNSAVED_KEY).toBe('ts-dojo:unsaved');
    expect(peekUnsaved('m/l/01', storage)).toEqual({});
    journalUnsaved('m/l/01', { '/index.ts': 'a' }, storage);
    journalUnsaved('m/l/02', { '/index.ts': 'x' }, storage);
    journalUnsaved('m/l/01', { '/tests.ts': 'b', '/index.ts': 'ab' }, storage);
    expect(peekUnsaved('m/l/01', storage)).toEqual({
      '/index.ts': 'ab',
      '/tests.ts': 'b',
    });
    dropUnsaved('m/l/01', storage);
    expect(peekUnsaved('m/l/01', storage)).toEqual({});
    expect(peekUnsaved('m/l/02', storage)).toEqual({ '/index.ts': 'x' });
    dropUnsaved('m/l/02', storage);
    expect(storage.map.has(UNSAVED_KEY)).toBe(false);
  });

  it('writes nothing for nothing waiting, and survives broken or blocked storage', () => {
    const storage = memoryStorage();
    journalUnsaved('m/l/01', {}, storage);
    expect(storage.map.size).toBe(0);
    storage.setItem(UNSAVED_KEY, 'not json');
    expect(peekUnsaved('m/l/01', storage)).toEqual({});
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() =>
      journalUnsaved('m/l/01', { '/a.ts': 'x' }, throwing),
    ).not.toThrow();
    expect(peekUnsaved('m/l/01', throwing)).toEqual({});
    expect(() => dropUnsaved('m/l/01', throwing)).not.toThrow();
    expect(peekUnsaved('m/l/01', null)).toEqual({});
  });
});

// The code font size (§7 `fontSize`, F10): a CSS custom property on <html> that the editor
// theme and the theory blocks read, applied before the first render and on every settings write.
import { afterEach, describe, expect, it } from 'vitest';
import { SETTINGS_KEY, writeSettings } from '@/store/settings';
import {
  applyFontSize,
  CODE_FONT_SIZE_PROPERTY,
  initFontSize,
  type FontSizeRoot,
} from './font-size.ts';

function fakeRoot(): FontSizeRoot & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    style: {
      setProperty: (name: string, value: string) => {
        values.set(name, value);
      },
    },
  };
}

const memory = (initial?: string) => {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(SETTINGS_KEY, initial);
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
});

describe('applyFontSize', () => {
  it('sets --code-font-size in px', () => {
    const root = fakeRoot();
    applyFontSize(root, 18);
    expect(CODE_FONT_SIZE_PROPERTY).toBe('--code-font-size');
    expect(root.values.get('--code-font-size')).toBe('18px');
  });
});

describe('initFontSize', () => {
  it('applies the stored size, or 14 px when there is none', () => {
    const stored = fakeRoot();
    stop = initFontSize({ root: stored, storage: memory('{"fontSize":20}') });
    expect(stored.values.get('--code-font-size')).toBe('20px');
    stop();
    const fresh = fakeRoot();
    stop = initFontSize({ root: fresh, storage: memory() });
    expect(fresh.values.get('--code-font-size')).toBe('14px');
  });

  it('follows every settings write until stopped, back to 14 px when the key is removed', () => {
    const root = fakeRoot();
    const storage = memory();
    stop = initFontSize({ root, storage });
    writeSettings({ fontSize: 22 }, storage);
    expect(root.values.get('--code-font-size')).toBe('22px');
    writeSettings({ fontSize: undefined }, storage);
    expect(root.values.get('--code-font-size')).toBe('14px');
    stop();
    stop = null;
    writeSettings({ fontSize: 11 }, storage);
    expect(root.values.get('--code-font-size')).toBe('14px');
  });
});

// Settings are one JSON object in localStorage under `ts-dojo:settings` (spec §7). F1 reads
// only `theme`; a missing key, broken JSON, a non-object or a throwing storage all read as {}.
import { describe, expect, it } from 'vitest';
import {
  isThemePreference,
  readSettings,
  SETTINGS_KEY,
  subscribeSettings,
  writeSettings,
} from './settings.ts';

const storageWith = (value: string | null) => ({
  getItem: (key: string) => (key === SETTINGS_KEY ? value : null),
});

describe('readSettings (§7)', () => {
  it('uses the §7 key', () => {
    expect(SETTINGS_KEY).toBe('ts-dojo:settings');
  });

  it('returns {} when the key is missing or the storage is absent', () => {
    expect(readSettings(storageWith(null))).toEqual({});
    expect(readSettings(null)).toEqual({});
    expect(readSettings(undefined)).toEqual({});
  });

  it('returns {} for invalid JSON or a non-object', () => {
    expect(readSettings(storageWith('{not json'))).toEqual({});
    expect(readSettings(storageWith('"dark"'))).toEqual({});
    expect(readSettings(storageWith('null'))).toEqual({});
    expect(readSettings(storageWith('[1]'))).toEqual({});
  });

  it('keeps a valid theme and drops an unknown one', () => {
    expect(readSettings(storageWith('{"theme":"dark"}'))).toEqual({
      theme: 'dark',
    });
    expect(readSettings(storageWith('{"theme":"light"}'))).toEqual({
      theme: 'light',
    });
    expect(readSettings(storageWith('{"theme":"system"}'))).toEqual({
      theme: 'system',
    });
    expect(readSettings(storageWith('{"theme":"sepia"}'))).toEqual({});
    expect(readSettings(storageWith('{"theme":3}'))).toEqual({});
  });

  it('returns {} when the storage throws (blocked or private storage)', () => {
    const throwing = {
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
    };
    expect(readSettings(throwing)).toEqual({});
  });

  it('isThemePreference accepts exactly system, light and dark', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});

describe('readSettings: the F3 keys', () => {
  it('keeps vimrc, relativeNumbers, lineNumbers and wrap with the right types and drops the rest', () => {
    expect(
      readSettings(
        storageWith(
          '{"vimrc":"imap jk <Esc>","relativeNumbers":false,"lineNumbers":true,"wrap":true,"fontSize":"big"}',
        ),
      ),
    ).toEqual({
      vimrc: 'imap jk <Esc>',
      relativeNumbers: false,
      lineNumbers: true,
      wrap: true,
    });
    expect(
      readSettings(storageWith('{"vimrc":3,"relativeNumbers":"yes","wrap":1}')),
    ).toEqual({});
  });
});

describe('readSettings: layout (F8)', () => {
  it('keeps split, theory or practice and drops anything else', () => {
    for (const layout of ['split', 'theory', 'practice']) {
      expect(readSettings(storageWith(JSON.stringify({ layout })))).toEqual({
        layout,
      });
    }
    expect(readSettings(storageWith('{"layout":"wide"}'))).toEqual({});
    expect(readSettings(storageWith('{"layout":1}'))).toEqual({});
  });
});

describe('writeSettings and subscribeSettings (§7, §4 ":set ... persisted")', () => {
  const memory = () => {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      store,
    };
  };

  it('merges a patch over the stored object and writes it under the §7 key', () => {
    const storage = memory();
    storage.setItem(SETTINGS_KEY, '{"theme":"dark","wrap":true}');
    const next = writeSettings({ relativeNumbers: false }, storage);
    expect(next).toEqual({ theme: 'dark', wrap: true, relativeNumbers: false });
    expect(JSON.parse(storage.store.get(SETTINGS_KEY) ?? '')).toEqual(next);
  });

  it('removes a key written as undefined', () => {
    const storage = memory();
    writeSettings({ vimrc: 'set nu' }, storage);
    expect(writeSettings({ vimrc: undefined }, storage)).toEqual({});
    expect(readSettings(storage)).toEqual({});
  });

  it('notifies subscribers with the merged settings until they unsubscribe', () => {
    const storage = memory();
    const seen: unknown[] = [];
    const unsubscribe = subscribeSettings((settings) => seen.push(settings));
    writeSettings({ theme: 'light' }, storage);
    unsubscribe();
    writeSettings({ theme: 'dark' }, storage);
    expect(seen).toEqual([{ theme: 'light' }]);
  });

  it('still returns and announces the merged value when the storage throws', () => {
    const throwing = {
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
      setItem: (): void => {
        throw new Error('SecurityError');
      },
    };
    expect(writeSettings({ wrap: true }, throwing)).toEqual({ wrap: true });
    expect(writeSettings({ wrap: true }, null)).toEqual({ wrap: true });
  });
});

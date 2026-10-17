// Settings are one JSON object in localStorage under `ts-dojo:settings` (spec §7). F1 reads
// only `theme`; a missing key, broken JSON, a non-object or a throwing storage all read as {}.
import { describe, expect, it } from 'vitest';
import { isThemePreference, readSettings, SETTINGS_KEY } from './settings.ts';

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

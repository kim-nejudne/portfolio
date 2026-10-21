// Settings are one JSON object in localStorage under `ts-dojo:settings` (spec §7). F1 reads
// only `theme`; a missing key, broken JSON, a non-object or a throwing storage all read as {}.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_OWNED_COMPILER_OPTIONS,
  compilerDefaultsProblems,
  FONT_SIZE,
  parseSettings,
  isThemePreference,
  sameSetting,
  TIMEOUT_RANGE,
  timeoutFor,
  readSettings,
  replaceSettings,
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

  it('replaceSettings writes exactly the given object and announces it (an import, F10)', () => {
    const storage = memory();
    storage.setItem(
      SETTINGS_KEY,
      '{"theme":"dark","vimrc":"set nu","wrap":true}',
    );
    const seen: unknown[] = [];
    const unsubscribe = subscribeSettings((settings) => seen.push(settings));
    expect(replaceSettings({ fontSize: 18 }, storage)).toEqual({
      fontSize: 18,
    });
    unsubscribe();
    expect(readSettings(storage)).toEqual({ fontSize: 18 });
    expect(seen).toEqual([{ fontSize: 18 }]);
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

describe("parseSettings: an imported file's settings (§7 Export and import, F9)", () => {
  it('keeps the known keys with valid values and drops the rest', () => {
    expect(
      parseSettings({
        theme: 'dark',
        vimrc: 'imap jk <Esc>',
        relativeNumbers: true,
        lineNumbers: false,
        wrap: true,
        layout: 'theory',
        fontSize: 'huge',
        unknown: 1,
      }),
    ).toEqual({
      theme: 'dark',
      vimrc: 'imap jk <Esc>',
      relativeNumbers: true,
      lineNumbers: false,
      wrap: true,
      layout: 'theory',
    });
    expect(
      parseSettings({ theme: 'sepia', layout: 'wide', wrap: 'no' }),
    ).toEqual({});
  });

  it('is {} for anything that is not an object', () => {
    for (const value of [null, undefined, 'dark', 3, ['theme']]) {
      expect(parseSettings(value)).toEqual({});
    }
  });
});

describe('readSettings and parseSettings: the F10 keys', () => {
  it('keeps fontSize as an integer from 10 to 24 px and drops anything else', () => {
    for (const fontSize of [10, 14, 24]) {
      expect(parseSettings({ fontSize })).toEqual({ fontSize });
    }
    for (const fontSize of [9, 25, 14.5, '14', null]) {
      expect(parseSettings({ fontSize })).toEqual({});
    }
    expect(FONT_SIZE).toEqual({ min: 10, max: 24, default: 14 });
  });

  it('keeps defaultTimeoutMs as an integer from 500 to 60000 ms and drops anything else', () => {
    for (const defaultTimeoutMs of [500, 5000, 60_000]) {
      expect(parseSettings({ defaultTimeoutMs })).toEqual({ defaultTimeoutMs });
    }
    for (const defaultTimeoutMs of [499, 60_001, 1000.5, '5000', -1]) {
      expect(parseSettings({ defaultTimeoutMs })).toEqual({});
    }
    expect(TIMEOUT_RANGE).toEqual({ min: 500, max: 60_000 });
  });

  it('keeps compilerDefaults when it is a tsconfig-shaped object', () => {
    const compilerDefaults = {
      noUncheckedIndexedAccess: true,
      target: 'es2022',
      lib: ['es2025', 'dom'],
      maxNodeModuleJsDepth: 0,
    };
    expect(
      readSettings(storageWith(JSON.stringify({ compilerDefaults }))),
    ).toEqual({ compilerDefaults });
    expect(parseSettings({ compilerDefaults: {} })).toEqual({
      compilerDefaults: {},
    });
  });

  it('drops compilerDefaults whole when it is not an object, holds a value of the wrong shape or sets a key ts-dojo owns', () => {
    for (const compilerDefaults of [
      null,
      'strict',
      ['strict'],
      { strict: null },
      { strict: { nested: true } },
      { lib: ['es2025', 3] },
      { strict: true, module: 'commonjs' },
      { moduleResolution: 'node16' },
      { isolatedModules: false },
      { importHelpers: true },
      { noEmitHelpers: true },
    ]) {
      expect(parseSettings({ compilerDefaults })).toEqual({});
    }
  });
});

describe('compilerDefaultsProblems (§2 options ts-dojo owns)', () => {
  it('lists nothing for a valid object', () => {
    expect(compilerDefaultsProblems({ strict: false })).toEqual([]);
  });

  it('names every bad value and every owned key', () => {
    expect(compilerDefaultsProblems('x')).toEqual([
      'compiler defaults must be a JSON object, like the compilerOptions of a tsconfig.json',
    ]);
    expect(
      compilerDefaultsProblems({ strict: null, module: 'esnext', lib: [1] }),
    ).toEqual([
      'strict must be true or false, a number, a string or a list of strings',
      'module is fixed by ts-dojo: code runs in the sandbox as ES modules, without tslib',
      'lib must be true or false, a number, a string or a list of strings',
    ]);
    expect(APP_OWNED_COMPILER_OPTIONS).toEqual([
      'module',
      'moduleResolution',
      'isolatedModules',
      'importHelpers',
      'noEmitHelpers',
    ]);
  });
});

describe('timeoutFor (§4 deadline, F10 default timeout)', () => {
  it('takes the exercise’s own timeoutMs first, then the setting, then 5 s', () => {
    expect(timeoutFor({ timeoutMs: 8000 }, { defaultTimeoutMs: 1000 })).toBe(
      8000,
    );
    expect(timeoutFor({}, { defaultTimeoutMs: 1000 })).toBe(1000);
    expect(timeoutFor({ timeoutMs: undefined }, {})).toBe(5000);
    expect(timeoutFor(null, { defaultTimeoutMs: 1500 })).toBe(1500);
    expect(timeoutFor(null, {})).toBe(5000);
  });
});

describe('sameSetting', () => {
  it('compares settings values structurally, objects regardless of key order', () => {
    expect(sameSetting('dark', 'dark')).toBe(true);
    expect(sameSetting(14, 15)).toBe(false);
    expect(sameSetting(undefined, undefined)).toBe(true);
    expect(
      sameSetting(
        { strict: false, lib: ['es2025'] },
        { lib: ['es2025'], strict: false },
      ),
    ).toBe(true);
    expect(
      sameSetting({ lib: ['es2025', 'dom'] }, { lib: ['dom', 'es2025'] }),
    ).toBe(false);
    expect(
      sameSetting({ strict: false }, { strict: false, target: 'es2022' }),
    ).toBe(false);
    expect(sameSetting({ strict: false }, undefined)).toBe(false);
  });
});

describe('subscribeSettings hears other tabs (§7, F10 "apply without a reload")', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('installs the storage listener itself, so a write in another tab reaches it', () => {
    const store = new Map<string, string>();
    const listeners: ((event: { key: string | null }) => void)[] = [];
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
      addEventListener: (
        type: string,
        listener: (event: { key: string | null }) => void,
      ) => {
        if (type === 'storage') listeners.push(listener);
      },
    });
    const seen: unknown[] = [];
    const unsubscribe = subscribeSettings((settings) => seen.push(settings));
    store.set(SETTINGS_KEY, '{"fontSize":18}');
    for (const listener of listeners) listener({ key: SETTINGS_KEY });
    for (const listener of listeners) listener({ key: 'something-else' });
    unsubscribe();
    expect(listeners).toHaveLength(1);
    expect(seen).toEqual([{ fontSize: 18 }]);
  });
});

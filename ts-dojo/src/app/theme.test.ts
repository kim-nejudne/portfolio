// Light and dark follow the system by default (spec §6 Theme and type); the preference lives in
// the §7 settings object. The resolver and the DOM application are pure so they run in Node.
import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  initTheme,
  resolveTheme,
  type ThemeRoot,
} from './theme.ts';

function fakeRoot(): ThemeRoot & { classes: Set<string> } {
  const classes = new Set<string>();
  return {
    classes,
    classList: {
      toggle(token: string, force?: boolean): boolean {
        const on = force ?? !classes.has(token);
        if (on) classes.add(token);
        else classes.delete(token);
        return on;
      },
    },
    style: { colorScheme: '' },
  };
}

describe('resolveTheme (§6)', () => {
  it('follows the system only for system or no preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme(undefined, true)).toBe('dark');
    expect(resolveTheme(undefined, false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });
});

describe('applyTheme', () => {
  it('adds the dark class and color-scheme for dark, removes them for light', () => {
    const root = fakeRoot();
    applyTheme(root, 'dark');
    expect(root.classes.has('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    applyTheme(root, 'light');
    expect(root.classes.has('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
  });
});

describe('initTheme', () => {
  function fakeEnv(stored: string | null, systemDark: boolean) {
    const root = fakeRoot();
    let listener: ((event: { matches: boolean }) => void) | null = null;
    const env = {
      root,
      storage: { getItem: () => stored },
      matchMedia: (query: string) => ({
        matches: query.includes('dark') ? systemDark : false,
        addEventListener: (
          _type: 'change',
          handler: (event: { matches: boolean }) => void,
        ) => {
          listener = handler;
        },
        removeEventListener: () => {
          listener = null;
        },
      }),
    };
    return {
      env,
      root,
      systemChange(matches: boolean) {
        listener?.({ matches });
      },
      get listening() {
        return listener !== null;
      },
    };
  }

  it('applies the system theme when nothing is stored and follows system changes', () => {
    const fake = fakeEnv(null, true);
    const stop = initTheme(fake.env);
    expect(fake.root.classes.has('dark')).toBe(true);
    fake.systemChange(false);
    expect(fake.root.classes.has('dark')).toBe(false);
    stop();
    expect(fake.listening).toBe(false);
  });

  it('applies a stored light or dark preference and ignores system changes', () => {
    const fake = fakeEnv('{"theme":"light"}', true);
    initTheme(fake.env);
    expect(fake.root.classes.has('dark')).toBe(false);
    fake.systemChange(true);
    expect(fake.root.classes.has('dark')).toBe(false);
    const dark = fakeEnv('{"theme":"dark"}', false);
    initTheme(dark.env);
    expect(dark.root.classes.has('dark')).toBe(true);
  });
});

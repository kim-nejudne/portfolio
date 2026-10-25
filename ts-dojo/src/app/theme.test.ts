// The scheme and the mode follow the §7 settings object (spec §6 Theme and type; the terminal
// restyle of 25 October 2026): the mode resolver, the scheme resolver and the DOM application
// are pure so they run in Node; initTheme is driven through a fake root, storage and media query.
import { describe, expect, it } from 'vitest';
import { schemeFor } from '@/theme/schemes';
import {
  applyTheme,
  initTheme,
  resolveScheme,
  resolveTheme,
  themeColorFor,
  type ThemeRoot,
} from './theme.ts';

function fakeRoot(): ThemeRoot & {
  classes: Set<string>;
  attributes: Map<string, string>;
} {
  const classes = new Set<string>();
  const attributes = new Map<string, string>();
  return {
    classes,
    attributes,
    classList: {
      toggle(token: string, force?: boolean): boolean {
        const on = force ?? !classes.has(token);
        if (on) classes.add(token);
        else classes.delete(token);
        return on;
      },
    },
    style: { colorScheme: '' },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
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

describe('resolveScheme', () => {
  it('keeps a known id and falls back to catppuccin otherwise', () => {
    expect(resolveScheme('gruvbox')).toBe('gruvbox');
    expect(resolveScheme('rose-pine')).toBe('rose-pine');
    expect(resolveScheme('sepia')).toBe('catppuccin');
    expect(resolveScheme(undefined)).toBe('catppuccin');
  });
});

describe('applyTheme', () => {
  it('sets the dark class, color-scheme and both data attributes', () => {
    const root = fakeRoot();
    applyTheme(root, 'dark', 'dracula');
    expect(root.classes.has('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    expect(root.attributes.get('data-mode')).toBe('dark');
    expect(root.attributes.get('data-scheme')).toBe('dracula');
    applyTheme(root, 'light');
    expect(root.classes.has('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
    expect(root.attributes.get('data-mode')).toBe('light');
    expect(root.attributes.get('data-scheme')).toBe('catppuccin');
  });
});

describe('themeColorFor', () => {
  it("is the scheme's background in the resolved mode", () => {
    expect(themeColorFor('gruvbox', 'dark')).toBe(schemeFor('gruvbox').dark.bg);
    expect(themeColorFor('gruvbox', 'light')).toBe(
      schemeFor('gruvbox').light.bg,
    );
  });
});

describe('initTheme', () => {
  function fakeEnv(stored: string | null, systemDark: boolean) {
    const root = fakeRoot();
    const themeColor = { content: '' };
    let listener: ((event: { matches: boolean }) => void) | null = null;
    const env = {
      root,
      storage: { getItem: () => stored },
      themeColor,
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
      themeColor,
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
    expect(fake.root.attributes.get('data-mode')).toBe('dark');
    expect(fake.root.attributes.get('data-scheme')).toBe('catppuccin');
    expect(fake.themeColor.content).toBe(schemeFor('catppuccin').dark.bg);
    fake.systemChange(false);
    expect(fake.root.classes.has('dark')).toBe(false);
    expect(fake.root.attributes.get('data-mode')).toBe('light');
    expect(fake.themeColor.content).toBe(schemeFor('catppuccin').light.bg);
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

  it('applies a stored scheme, with the theme-color of that scheme, and drops an unknown one', () => {
    const fake = fakeEnv('{"theme":"dark","scheme":"gruvbox"}', false);
    initTheme(fake.env);
    expect(fake.root.attributes.get('data-scheme')).toBe('gruvbox');
    expect(fake.themeColor.content).toBe(schemeFor('gruvbox').dark.bg);
    const unknown = fakeEnv('{"scheme":"sepia"}', false);
    initTheme(unknown.env);
    expect(unknown.root.attributes.get('data-scheme')).toBe('catppuccin');
  });
});

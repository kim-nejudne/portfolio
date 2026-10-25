// The colour scheme and the light/dark mode (spec §6 Theme and type; restyled 25 October 2026
// with the terminal look). Two settings in the §7 settings object: `theme`, the mode (`system`
// or nothing means prefers-color-scheme; `:set bg=` writes it too), and `scheme`, one of the
// ids in src/theme/schemes. Both go on <html>: `data-scheme` and `data-mode` (the resolved
// mode) select the token rule in the generated stylesheet (src/theme/css.ts), the `dark` class
// keeps Tailwind's variant, and `color-scheme` makes native controls match. public/theme-init.js
// sets the same before the first paint (the §10 CSP allows no inline script); this module
// takes over on load, validates the scheme id, follows the system while the mode is `system`,
// follows every settings write, and keeps <meta name="theme-color"> at the scheme's background.
import {
  readSettings,
  subscribeSettings,
  type Settings,
  type ThemePreference,
} from '@/store/settings';
import { MODE_ATTRIBUTE, SCHEME_ATTRIBUTE } from '@/theme/css';
import { DEFAULT_SCHEME, isSchemeId, schemeFor } from '@/theme/schemes';

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeRoot {
  classList: { toggle(token: string, force?: boolean): boolean };
  style: { colorScheme: string };
  setAttribute(name: string, value: string): void;
}

export interface ThemeMediaQuery {
  matches: boolean;
  addEventListener(
    type: 'change',
    listener: (event: { matches: boolean }) => void,
  ): void;
  removeEventListener(
    type: 'change',
    listener: (event: { matches: boolean }) => void,
  ): void;
}

export interface ThemeEnv {
  root: ThemeRoot;
  storage: Pick<Storage, 'getItem'> | null | undefined;
  matchMedia: (query: string) => ThemeMediaQuery;
  /** The `theme-color` meta element, when the document has one. */
  themeColor?: { content: string } | null | undefined;
}

export const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(
  preference: ThemePreference | undefined,
  systemDark: boolean,
): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemDark ? 'dark' : 'light';
}

/** The stored scheme id when it names a scheme, else the default. */
export function resolveScheme(scheme: string | undefined): string {
  return isSchemeId(scheme) ? scheme : DEFAULT_SCHEME;
}

export function applyTheme(
  root: ThemeRoot,
  theme: ResolvedTheme,
  scheme: string = DEFAULT_SCHEME,
): void {
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  root.setAttribute(MODE_ATTRIBUTE, theme);
  root.setAttribute(SCHEME_ATTRIBUTE, scheme);
}

/** The browser chrome's colour: the scheme's page background in the resolved mode. */
export function themeColorFor(scheme: string, theme: ResolvedTheme): string {
  return schemeFor(scheme)[theme].bg;
}

/**
 * Applies the stored scheme and mode now, keeps following the system while the mode is
 * `system` or absent, and follows every settings write. Returns the unsubscribe.
 */
export function initTheme(env: ThemeEnv = browserThemeEnv()): () => void {
  const media = env.matchMedia(DARK_QUERY);
  let systemDark = media.matches;
  const apply = (settings: Settings): void => {
    const theme = resolveTheme(settings.theme, systemDark);
    const scheme = resolveScheme(settings.scheme);
    applyTheme(env.root, theme, scheme);
    if (env.themeColor != null) {
      env.themeColor.content = themeColorFor(scheme, theme);
    }
  };
  apply(readSettings(env.storage));
  const onChange = (event: { matches: boolean }): void => {
    systemDark = event.matches;
    apply(readSettings(env.storage));
  };
  media.addEventListener('change', onChange);
  // `:set bg=dark` (F3), the Settings page (F10) and the status bar's pickers write `theme` and
  // `scheme`; follow every write.
  const unsubscribe = subscribeSettings(apply);
  return () => {
    media.removeEventListener('change', onChange);
    unsubscribe();
  };
}

export function browserThemeEnv(): ThemeEnv {
  let storage: Storage | null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return {
    root: document.documentElement,
    storage,
    matchMedia: (query) => window.matchMedia(query),
    themeColor: document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    ),
  };
}

// Light and dark, following the system by default (spec §6 Theme and type). The preference is
// `theme` in the §7 settings object; `system` or nothing means prefers-color-scheme. Tailwind's
// dark variant is `.dark` on <html> (globals.css), set here before the first render because the
// §10 CSP allows no inline script; `color-scheme` follows so native controls match.
import {
  readSettings,
  subscribeSettings,
  type ThemePreference,
} from '@/store/settings';

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeRoot {
  classList: { toggle(token: string, force?: boolean): boolean };
  style: { colorScheme: string };
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
}

export const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(
  preference: ThemePreference | undefined,
  systemDark: boolean,
): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemDark ? 'dark' : 'light';
}

export function applyTheme(root: ThemeRoot, theme: ResolvedTheme): void {
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

/**
 * Applies the stored preference now, keeps following the system while the preference is
 * `system` or absent, and follows every settings write. Returns the unsubscribe.
 */
export function initTheme(env: ThemeEnv = browserThemeEnv()): () => void {
  const media = env.matchMedia(DARK_QUERY);
  let systemDark = media.matches;
  const apply = (preference: ThemePreference | undefined): void => {
    applyTheme(env.root, resolveTheme(preference, systemDark));
  };
  apply(readSettings(env.storage).theme);
  const onChange = (event: { matches: boolean }): void => {
    systemDark = event.matches;
    apply(readSettings(env.storage).theme);
  };
  media.addEventListener('change', onChange);
  // `:set bg=dark` (F3) and the Settings page (F10) write `theme`; follow every write.
  const unsubscribe = subscribeSettings((settings) => {
    apply(settings.theme);
  });
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
  };
}

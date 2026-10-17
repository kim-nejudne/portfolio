// Settings are one JSON object in localStorage under `ts-dojo:settings` (spec §7): vimrc,
// relativeNumbers, fontSize, theme, defaultTimeoutMs, compilerDefaults, layout. F1 reads only
// `theme`; `:set bg=` (F3) and the Settings page (F10) write the object and widen this type.
export const SETTINGS_KEY = 'ts-dojo:settings';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export interface Settings {
  theme?: ThemePreference;
}

export type SettingsStorage = Pick<Storage, 'getItem'>;

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === 'string' &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

/** The stored settings, or {} when the key is missing, unreadable, not JSON or not an object. */
export function readSettings(
  storage: SettingsStorage | null | undefined,
): Settings {
  let raw: string | null;
  try {
    raw = storage?.getItem(SETTINGS_KEY) ?? null;
  } catch {
    return {};
  }
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const settings: Settings = {};
  const theme = (parsed as Record<string, unknown>)['theme'];
  if (isThemePreference(theme)) settings.theme = theme;
  return settings;
}

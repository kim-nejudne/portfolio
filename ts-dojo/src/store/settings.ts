// Settings are one JSON object in localStorage under `ts-dojo:settings` (spec §7): vimrc,
// relativeNumbers, fontSize, theme, defaultTimeoutMs, compilerDefaults, layout. F1 read `theme`;
// F3 reads and writes `vimrc`, `relativeNumbers`, `theme` (`:set bg=`) and, because §4 says
// `:set nu` and `:set wrap` persist too, `lineNumbers` and `wrap` (logged under "Spec
// questions"). `writeSettings` merges a patch and notifies `subscribeSettings` listeners in this
// tab; another tab's write arrives through the `storage` event. The Settings page (F10) widens
// this further.
export const SETTINGS_KEY = 'ts-dojo:settings';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export interface Settings {
  theme?: ThemePreference;
  /** The vimrc text (§4 Mappings and the vimrc); absent means the shipped default. */
  vimrc?: string;
  /** `:set rnu` / `:set nornu`. */
  relativeNumbers?: boolean;
  /** `:set nu` / `:set nonu`. */
  lineNumbers?: boolean;
  /** `:set wrap` / `:set nowrap`. */
  wrap?: boolean;
}

export type SettingsStorage = Pick<Storage, 'getItem'>;
export type WritableSettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

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
  const record = parsed as Record<string, unknown>;
  const settings: Settings = {};
  if (isThemePreference(record['theme'])) settings.theme = record['theme'];
  if (typeof record['vimrc'] === 'string') settings.vimrc = record['vimrc'];
  for (const key of ['relativeNumbers', 'lineNumbers', 'wrap'] as const) {
    const value = record[key];
    if (typeof value === 'boolean') settings[key] = value;
  }
  return settings;
}

/** A patch may name a key as undefined to remove it. */
export type SettingsPatch = { [K in keyof Settings]?: Settings[K] | undefined };

type Listener = (settings: Settings) => void;
const listeners = new Set<Listener>();

/**
 * Merges `patch` over the stored object and writes it back; a key set to undefined is removed.
 * Returns the new settings. A storage that throws (private mode, blocked) is treated as empty
 * and the write is dropped, but listeners still hear the merged value for this page load.
 */
export function writeSettings(
  patch: SettingsPatch,
  storage: WritableSettingsStorage | null | undefined = browserStorage(),
): Settings {
  const merged: SettingsPatch = { ...readSettings(storage), ...patch };
  for (const key of Object.keys(merged) as (keyof Settings)[]) {
    if (merged[key] === undefined) delete merged[key];
  }
  const next = merged as Settings;
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Nothing to do: the settings live in memory for this page load.
  }
  for (const listener of listeners) listener(next);
  return next;
}

/** Hears every write from this tab and, in a browser, writes from other tabs. */
export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let storageListening = false;

/** `window.localStorage`, or null when it throws (blocked or private storage). */
export function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    if (!storageListening) {
      storageListening = true;
      window.addEventListener('storage', (event) => {
        if (event.key !== SETTINGS_KEY && event.key !== null) return;
        const settings = readSettings(storage);
        for (const listener of listeners) listener(settings);
      });
    }
    return storage;
  } catch {
    return null;
  }
}

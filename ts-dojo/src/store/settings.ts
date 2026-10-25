// Settings are one JSON object in localStorage under `ts-dojo:settings` (spec §7): vimrc,
// relativeNumbers, fontSize, theme, defaultTimeoutMs, compilerDefaults, layout, and since the
// terminal restyle (25 October 2026, under "Spec questions") `scheme`, the colour scheme id
// from src/theme/schemes, read by src/app/theme.ts beside `theme`. F1 read `theme`;
// F3 reads and writes `vimrc`, `relativeNumbers`, `theme` (`:set bg=`) and, because §4 says
// `:set nu` and `:set wrap` persist too, `lineNumbers` and `wrap` (logged under "Spec
// questions"). F8 adds `layout`, the lesson page's last `:layout` choice, the default for a
// lesson that has none of its own (§6 "the layout choice is remembered"). F10 adds the Settings
// page's `fontSize` (the code size: editor and theory blocks), `defaultTimeoutMs` (the run
// deadline wherever content names none) and `compilerDefaults` (merged over the §2 defaults for
// `/repl` buffers only; an exercise keeps §2 and its own overrides). `writeSettings` merges a
// patch and notifies `subscribeSettings` listeners in this tab; another tab's write arrives
// through the `storage` event.
import { DEFAULT_TIMEOUT_MS } from '@/protocol/sandbox';
import type { CompilerOptionsJson } from '@/protocol/ts-ls';
import { isSchemeId } from '@/theme/schemes';

export const SETTINGS_KEY = 'ts-dojo:settings';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;

export const LAYOUT_MODES = ['split', 'theory', 'practice'] as const;
export type LayoutSetting = (typeof LAYOUT_MODES)[number];
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** The code font size in px (F10; §7 names the key, not the range). */
export const FONT_SIZE = { min: 10, max: 24, default: 14 } as const;

/** The default run deadline in ms (F10; §4's default is 5 s, `DEFAULT_TIMEOUT_MS`). */
export const TIMEOUT_RANGE = { min: 500, max: 60_000 } as const;

/**
 * Options the run machinery depends on, refused in `compilerDefaults`: the sandbox loads the
 * emitted ES modules as they are (§2 Decisions) and has no `tslib`.
 */
export const APP_OWNED_COMPILER_OPTIONS = [
  'module',
  'moduleResolution',
  'isolatedModules',
  'importHelpers',
  'noEmitHelpers',
] as const;

export interface Settings {
  /** The mode: light, dark, or the system's (§6 Theme and type). */
  theme?: ThemePreference;
  /** The colour scheme id (src/theme/schemes); absent means the default scheme. */
  scheme?: string;
  /** The vimrc text (§4 Mappings and the vimrc); absent means the shipped default. */
  vimrc?: string;
  /** `:set rnu` / `:set nornu`. */
  relativeNumbers?: boolean;
  /** `:set nu` / `:set nonu`. */
  lineNumbers?: boolean;
  /** `:set wrap` / `:set nowrap`. */
  wrap?: boolean;
  /** The last `:layout` on a lesson page (§6, §7 `layout`). */
  layout?: LayoutSetting;
  /** The editor's and the theory blocks' font size in px, FONT_SIZE.min to max. */
  fontSize?: number;
  /** The run deadline when content names none, TIMEOUT_RANGE.min to max ms. */
  defaultTimeoutMs?: number;
  /** tsconfig-shaped options merged over the §2 defaults for `/repl` buffers. */
  compilerDefaults?: CompilerOptionsJson;
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
  return parseSettings(parsed);
}

/**
 * The known keys with valid values from any value, {} for a non-object: what the store reads
 * and what an imported file's `settings` go through (§7 Export and import).
 */
export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const settings: Settings = {};
  if (isThemePreference(record['theme'])) settings.theme = record['theme'];
  if (isSchemeId(record['scheme'])) settings.scheme = record['scheme'];
  if (typeof record['vimrc'] === 'string') settings.vimrc = record['vimrc'];
  const layout = record['layout'];
  if (
    typeof layout === 'string' &&
    (LAYOUT_MODES as readonly string[]).includes(layout)
  ) {
    settings.layout = layout as LayoutSetting;
  }
  for (const key of ['relativeNumbers', 'lineNumbers', 'wrap'] as const) {
    const entry = record[key];
    if (typeof entry === 'boolean') settings[key] = entry;
  }
  const fontSize = record['fontSize'];
  if (isIntegerIn(fontSize, FONT_SIZE.min, FONT_SIZE.max)) {
    settings.fontSize = fontSize;
  }
  const timeout = record['defaultTimeoutMs'];
  if (isIntegerIn(timeout, TIMEOUT_RANGE.min, TIMEOUT_RANGE.max)) {
    settings.defaultTimeoutMs = timeout;
  }
  const compilerDefaults = record['compilerDefaults'];
  if (compilerDefaultsProblems(compilerDefaults).length === 0) {
    settings.compilerDefaults = compilerDefaults as CompilerOptionsJson;
  }
  return settings;
}

export function isIntegerIn(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

/**
 * Why a value cannot be `compilerDefaults`, in key order; [] when it can. The shape is the one
 * exercise.yaml's `compilerOptions` has; whether TypeScript accepts the options is the ts-ls
 * worker's `checkCompilerOptions`.
 */
export function compilerDefaultsProblems(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [
      'compiler defaults must be a JSON object, like the compilerOptions of a tsconfig.json',
    ];
  }
  const owned = new Set<string>(APP_OWNED_COMPILER_OPTIONS);
  const problems: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (owned.has(key)) {
      problems.push(
        `${key} is fixed by ts-dojo: code runs in the sandbox as ES modules, without tslib`,
      );
    } else if (!isOptionValue(entry)) {
      problems.push(
        `${key} must be true or false, a number, a string or a list of strings`,
      );
    }
  }
  return problems;
}

function isOptionValue(value: unknown): boolean {
  return (
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'string' ||
    (Array.isArray(value) &&
      value.every((item: unknown) => typeof item === 'string'))
  );
}

/** The §4 run deadline: the exercise's own `timeoutMs`, else the setting, else 5 s. */
export function timeoutFor(
  exercise: { timeoutMs?: number | undefined } | null,
  settings: Settings,
): number {
  return exercise?.timeoutMs ?? settings.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
}

/** Structural equality for settings values (JSON shapes); object keys in any order. */
export function sameSetting(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameSetting(item, b[index]))
    );
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => key in right && sameSetting(left[key], right[key]))
  );
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

/**
 * Writes exactly `settings` (keys it lacks go back to their defaults) and notifies like
 * `writeSettings`: an import makes the settings the file's (F10, Kim's decision).
 */
export function replaceSettings(
  settings: Settings,
  storage: WritableSettingsStorage | null | undefined = browserStorage(),
): Settings {
  const next = parseSettings(settings);
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // As in writeSettings: the settings live in memory for this page load.
  }
  for (const listener of listeners) listener(next);
  return next;
}

/** Hears every write from this tab and, in a browser, writes from other tabs. */
export function subscribeSettings(listener: Listener): () => void {
  // Installs the cross-tab `storage` listener (once), so another tab's write reaches a page
  // that never read the settings through `browserStorage()` itself.
  browserStorage();
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

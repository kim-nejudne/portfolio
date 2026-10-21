// The editor saves each setting as its own JSON text. Older versions saved some
// settings with the wrong type, and a text can be damaged.

// The texts as saved: the font size, the theme, and the window's width and height.
export type SavedSettings = {
  fontSize: string;
  theme: string;
  window: readonly [width: string, height: string];
};

// The settings the editor runs with.
export type Settings = {
  readonly fontSize: number;
  readonly theme: string;
  readonly window: readonly [width: number, height: number];
};

export const DEFAULTS = {
  fontSize: 14,
  theme: 'dark',
  window: [800, 600],
} as const;

// One saved value, whatever its JSON holds. A damaged text gives undefined.
export function parseValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// The saved number, or the fallback when the text holds anything else.
function readNumber(text: string, fallback: number): number {
  const value = parseValue(text);
  return typeof value === 'number' ? value : fallback;
}

// The saved string, or the fallback when the text holds anything else.
function readString(text: string, fallback: string): string {
  const value = parseValue(text);
  return typeof value === 'string' ? value : fallback;
}

// Each saved value that has the right type, and the default in place of any other.
export function readSettings(saved: SavedSettings): Settings {
  const [width, height] = saved.window;
  return {
    fontSize: readNumber(saved.fontSize, DEFAULTS.fontSize),
    theme: readString(saved.theme, DEFAULTS.theme),
    window: [
      readNumber(width, DEFAULTS.window[0]),
      readNumber(height, DEFAULTS.window[1]),
    ],
  };
}

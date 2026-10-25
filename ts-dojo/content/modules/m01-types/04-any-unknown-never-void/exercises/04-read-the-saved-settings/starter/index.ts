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
export function parseValue(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Each saved value that has the right type, and the default in place of any other.
export function readSettings(saved: SavedSettings): Settings {
  return {
    fontSize: parseValue(saved.fontSize),
    theme: parseValue(saved.theme),
    window: [parseValue(saved.window[0]), parseValue(saved.window[1])],
  };
}

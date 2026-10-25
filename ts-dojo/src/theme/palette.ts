// The colour tokens one terminal colour scheme provides, in one mode (spec §6 Theme and type,
// restyled 25 October 2026). Every scheme under ./schemes/ gives a light and a dark palette with
// the palette's published hex values; src/theme/css.ts turns them into the CSS custom properties
// globals.css maps the UI, the editor and the theory blocks onto. A new scheme is one file there
// plus one entry in ./schemes/index.ts.

/** The sixteen ANSI colours, as a terminal emulator names them. */
export interface AnsiColors {
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface Palette {
  /** The variant's own name, as the palette publishes it ("Latte", "Mocha", "One Dark"). */
  name: string;
  /** The page and editor background. */
  bg: string;
  /** Panels, cards, code blocks and the active line: one step off `bg`. */
  bgAlt: string;
  /** Body text. */
  fg: string;
  /** Secondary text: hints, status, comments. Readable against `bg` (WCAG AA). */
  fgMuted: string;
  /** Every 1px border and separator. */
  border: string;
  /** Links, the primary action, focus rings and the prompt glyph. Readable against `bg`. */
  accent: string;
  /** Text selection, the chosen item, the active tab's surface. */
  selection: string;
  /** The block cursor. */
  cursor: string;
  ansi: AnsiColors;
}

export interface Scheme {
  /** The `data-scheme` value and the settings value: lowercase, hyphenated. */
  id: string;
  /** The family's name, as the picker shows it. */
  label: string;
  light: Palette;
  dark: Palette;
}

export const ANSI_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const satisfies readonly (keyof AnsiColors)[];

/** `brightBlack` → `bright-black`: the CSS property suffix. */
export function ansiPropertyName(name: keyof AnsiColors): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** A colour as red, green and blue, each from 0 to 255. */
export type Rgb = [number, number, number];

/** Every colour of a theme, as a CSS hex string or as an Rgb triple. */
export type Palette = Record<'background' | 'text' | 'accent', string | Rgb>;

// The theme editor assigns new colours to these properties while the app runs.
export const palette = {
  background: '#fdf6e3',
  text: [101, 123, 131],
  accent: '#b58900',
} satisfies Palette;

/** The accent colour in upper case, as the CSS variables expect it. */
export function accentHex(): string {
  return palette.accent.toUpperCase();
}

/** The text colour as a CSS rgb() value. */
export function textRgb(): string {
  return `rgb(${palette.text.join(', ')})`;
}

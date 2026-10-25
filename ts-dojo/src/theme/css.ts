// The CSS the scheme palettes become (spec §6 Theme and type, restyled 25 October 2026): one
// rule per scheme and mode, selected by the `data-scheme` and `data-mode` attributes on <html>
// that src/app/theme.ts and public/theme-init.js set, each declaring the terminal tokens
// (`--bg`, `--fg`, `--accent`, the sixteen ANSI colours…). globals.css maps everything else onto
// these. The default scheme also fills the bare `:root` and `:root.dark`, so a page with no
// attributes yet, or an unknown id, still has colours. src/theme/node/vite-plugin.ts serves
// the result as a virtual stylesheet; this module is pure so Vitest can check it.
import {
  ANSI_NAMES,
  ansiPropertyName,
  type Palette,
  type Scheme,
} from './palette';
import { DEFAULT_SCHEME, SCHEMES } from './schemes';

export const SCHEME_ATTRIBUTE = 'data-scheme';
export const MODE_ATTRIBUTE = 'data-mode';

export function paletteDeclarations(palette: Palette): string[] {
  const lines = [
    `--bg: ${palette.bg};`,
    `--bg-alt: ${palette.bgAlt};`,
    `--fg: ${palette.fg};`,
    `--fg-muted: ${palette.fgMuted};`,
    `--border: ${palette.border};`,
    `--accent: ${palette.accent};`,
    `--selection: ${palette.selection};`,
    `--cursor: ${palette.cursor};`,
  ];
  for (const name of ANSI_NAMES) {
    lines.push(`--${ansiPropertyName(name)}: ${palette.ansi[name]};`);
  }
  return lines;
}

function rule(selectors: string[], palette: Palette): string {
  const body = paletteDeclarations(palette)
    .map((line) => `  ${line}`)
    .join('\n');
  return `${selectors.join(',\n')} {\n${body}\n}\n`;
}

export function schemeSelector(id: string, mode: 'light' | 'dark'): string {
  return `:root[${SCHEME_ATTRIBUTE}="${id}"][${MODE_ATTRIBUTE}="${mode}"]`;
}

/** The whole stylesheet, every scheme in both modes, the default scheme first as the fallback. */
export function schemesCss(schemes: readonly Scheme[] = SCHEMES): string {
  const parts: string[] = [
    '/* Generated from src/theme/schemes/ by src/theme/css.ts: the terminal colour tokens. */\n',
  ];
  for (const scheme of schemes) {
    const isDefault = scheme.id === DEFAULT_SCHEME;
    parts.push(
      rule(
        [...(isDefault ? [':root'] : []), schemeSelector(scheme.id, 'light')],
        scheme.light,
      ),
    );
    parts.push(
      rule(
        [
          ...(isDefault ? [':root.dark'] : []),
          schemeSelector(scheme.id, 'dark'),
        ],
        scheme.dark,
      ),
    );
  }
  return parts.join('\n');
}

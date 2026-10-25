// The colour schemes the picker offers, in picker order (spec §6 Theme and type, restyled
// 25 October 2026). Adding a scheme: one file beside these exporting a `Scheme`, one line in
// SCHEMES. The ids are the `data-scheme` values and the `scheme` setting (§7 settings object).
import type { Scheme } from '../palette';
import { catppuccin } from './catppuccin';
import { dracula } from './dracula';
import { everforest } from './everforest';
import { github } from './github';
import { gruvbox } from './gruvbox';
import { one } from './one';
import { rosePine } from './rose-pine';
import { solarized } from './solarized';
import { tokyoNight } from './tokyo-night';

export const SCHEMES: readonly Scheme[] = [
  catppuccin,
  gruvbox,
  solarized,
  tokyoNight,
  one,
  rosePine,
  github,
  everforest,
  dracula,
];

/** The scheme with no choice stored; public/theme-init.js names the same id. */
export const DEFAULT_SCHEME = 'catppuccin';

export const SCHEME_IDS: readonly string[] = SCHEMES.map((s) => s.id);

export function isSchemeId(value: unknown): value is string {
  return typeof value === 'string' && SCHEME_IDS.includes(value);
}

/** The scheme for an id, or the default when the id is unknown or missing. */
export function schemeFor(id: string | undefined): Scheme {
  return (
    SCHEMES.find((s) => s.id === id) ??
    (SCHEMES.find((s) => s.id === DEFAULT_SCHEME) as Scheme)
  );
}

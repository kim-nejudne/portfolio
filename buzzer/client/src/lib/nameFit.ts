/**
 * How a name fits its box on the Screen (F153): its width in ems, estimated from its length,
 * and what else shares its line. Names wrap rather than truncate, so a name wider than the
 * estimate still reads in full.
 */
interface NameFit {
  /** The face's average width of one character, in ems. */
  perChar: number;
  /** Ems on the line besides the name: the colour dot, its gap, any padding. */
  extra: number;
  /** Fit the longest word, where the name may wrap at a space; else the whole name on one line. */
  byWord: boolean;
  /** The floor, a `--screen-min-*` variable. */
  floor: string;
}

/** The buzz banner: Anybody 900 at 140% in capitals, about 1em a letter, one line. */
export const BANNER_NAME: NameFit = {
  perChar: 1.05,
  extra: 0.8,
  byWord: false,
  floor: 'var(--screen-min-name)',
};

/** A podium step: Archivo 600, about 0.6em a letter; the dot and the step's padding share the line. */
export const PODIUM_NAME: NameFit = {
  perChar: 0.62,
  extra: 1.7,
  byWord: true,
  floor: 'var(--screen-min-body)',
};

/**
 * The lobby's join address (F155), fitted by its longest part between slashes: Archivo 600, lower
 * case, digits and dots, about 0.6em a character. The floor is the mock's small print (13px), at 14.
 */
export const JOIN_ADDRESS: NameFit = {
  perChar: 0.6,
  extra: 0,
  byWord: false,
  floor: 'var(--screen-min-label)',
};

/** An avatar and its margin, in ems. */
const AVATAR_EMS = 1.3;

/**
 * The CSS font size for a name inside an `@container`: the inherited size, stepped down so the name
 * fits the container's width, never below the floor. shortcut: an estimate from the length, not a
 * measurement; a name of wide letters (W, M) may wrap to a second line instead.
 */
export function nameFitSize(name: string, fit: NameFit, avatar = false): string {
  const chars = fit.byWord ? Math.max(...name.split(/\s+/).map((w) => w.length)) : name.length;
  const ems = chars * fit.perChar + fit.extra + (avatar ? AVATAR_EMS : 0);
  return `max(${fit.floor}, min(1em, calc(100cqw / ${Number(ems.toFixed(2))})))`;
}

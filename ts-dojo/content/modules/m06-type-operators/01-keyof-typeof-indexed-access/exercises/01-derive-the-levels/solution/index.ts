export const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

/** Every key of LEVELS. */
export type Level = keyof typeof LEVELS;

/** Every value of LEVELS. */
export type Severity = (typeof LEVELS)[Level];

export function severity(level: Level): Severity {
  return LEVELS[level];
}

export function atLeast(level: Level, threshold: Level): boolean {
  return severity(level) >= severity(threshold);
}

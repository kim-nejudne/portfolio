export type Theme = 'light' | 'dark';

export type Settings = { theme?: Theme; pageSize?: number; beta: boolean };

/**
 * Turns `key=value` lines into a record. The key is the text before the first `=`, the value
 * everything after it. Lines without `=` are skipped, and a later line wins over an earlier one.
 */
export function parsePairs(lines: readonly string[]): Record<string, string> {
  throw new Error(`not implemented for ${lines.length} lines`);
}

/**
 * Reads the settings from the record. `theme` is set only for `light` or `dark`, and `pageSize`
 * only for a whole number from 1 to 100; otherwise the property is left out. `beta` is true
 * only when the value is `true`.
 */
export function readSettings(raw: Record<string, string>): Settings {
  throw new Error(`not implemented for ${Object.keys(raw).length} keys`);
}

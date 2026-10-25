export type Theme = 'light' | 'dark';

export type Settings = { theme?: Theme; pageSize?: number; beta: boolean };

/**
 * Turns `key=value` lines into a record. The key is the text before the first `=`, the value
 * everything after it. Lines without `=` are skipped, and a later line wins over an earlier one.
 */
export function parsePairs(lines: readonly string[]): Record<string, string> {
  const pairs: Record<string, string> = {};
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    if (key === undefined || rest.length === 0) {
      continue;
    }
    pairs[key] = rest.join('=');
  }
  return pairs;
}

/**
 * Reads the settings from the record. `theme` is set only for `light` or `dark`, and `pageSize`
 * only for a whole number from 1 to 100; otherwise the property is left out. `beta` is true
 * only when the value is `true`.
 */
export function readSettings(raw: Record<string, string>): Settings {
  const settings: Settings = { beta: raw['beta'] === 'true' };
  const theme = raw['theme'];
  if (theme === 'light' || theme === 'dark') {
    settings.theme = theme;
  }
  const pageSize = Number(raw['pageSize']);
  if (Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100) {
    settings.pageSize = pageSize;
  }
  return settings;
}

// A setting is a toggle when its value is a boolean, and a choice from a list otherwise.
// Both sides are wrapped, so a union such as Theme is tested as one type and gets one
// object with the whole union in value and options; boolean, which is true | false, too.
export type Setting<T> = [T] extends [boolean]
  ? { kind: 'toggle'; value: T }
  : { kind: 'choice'; value: T; options: readonly T[] };

export type Theme = 'light' | 'dark' | 'system';

export const darkMode: Setting<boolean> = { kind: 'toggle', value: false };

export const theme: Setting<Theme> = {
  kind: 'choice',
  value: 'system',
  options: ['light', 'dark', 'system'],
};

export const fontSize: Setting<12 | 14 | 16> = {
  kind: 'choice',
  value: 14,
  options: [12, 14, 16],
};

export function describe(setting: Setting<boolean> | Setting<Theme>): string {
  return setting.kind === 'toggle'
    ? `${setting.value ? 'on' : 'off'}`
    : `${setting.value} of ${setting.options.join(', ')}`;
}

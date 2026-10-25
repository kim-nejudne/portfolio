export type Settings = {
  theme: 'light' | 'dark';
  fontSize: number;
  vim: boolean;
};

export const DEFAULTS: Settings = { theme: 'dark', fontSize: 14, vim: true };

/** A copy of settings with the patch's properties on top; settings itself is left alone. */
export function applyPatch(
  settings: Settings,
  patch: Partial<Settings>,
): Settings {
  return { ...settings, ...patch };
}

export const larger = applyPatch(DEFAULTS, { fontSize: 18 });
export const light = applyPatch(DEFAULTS, { theme: 'light', vim: false });

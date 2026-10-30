// The Screen's sound level (Sound on / Quiet / Muted), switched with `M` or the control bar (F24)
// and kept in localStorage, so it survives a refresh. F38 plays the Screen's sounds at this level.
// Storage can be unavailable (private mode, blocked site data), so every access is guarded.

export const SOUND_LEVELS = ['on', 'quiet', 'muted'] as const;
export type SoundLevel = (typeof SOUND_LEVELS)[number];

const KEY = 'sketchy:sound';

export function nextSoundLevel(level: SoundLevel): SoundLevel {
  return SOUND_LEVELS[(SOUND_LEVELS.indexOf(level) + 1) % SOUND_LEVELS.length]!;
}

export function loadSoundLevel(): SoundLevel {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    return SOUND_LEVELS.find((l) => l === stored) ?? 'on';
  } catch {
    return 'on';
  }
}

export function saveSoundLevel(level: SoundLevel): void {
  try {
    globalThis.localStorage?.setItem(KEY, level);
  } catch {
    // Not kept: it still applies until the page reloads.
  }
}

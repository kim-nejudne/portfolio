// The Screen's sound level (Sound on / Quiet / Muted), switched with `M` or the control bar (F24)
// and kept in localStorage, so it survives a refresh. F38 plays the Screen's sounds at this level.
// Storage can be unavailable (private mode, blocked site data), so every access is guarded.

export const SOUND_LEVELS = ['on', 'quiet', 'muted'] as const;
export type SoundLevel = (typeof SOUND_LEVELS)[number];

const KEY = 'sketchy:sound';

// The level when storage can't be written: it lasts until the page is closed.
let memoryLevel: SoundLevel = 'on';
const listeners = new Set<(level: SoundLevel) => void>();

export function nextSoundLevel(level: SoundLevel): SoundLevel {
  return SOUND_LEVELS[(SOUND_LEVELS.indexOf(level) + 1) % SOUND_LEVELS.length]!;
}

export function loadSoundLevel(): SoundLevel {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    return SOUND_LEVELS.find((l) => l === stored) ?? memoryLevel;
  } catch {
    return memoryLevel;
  }
}

export function saveSoundLevel(level: SoundLevel): void {
  memoryLevel = level;
  try {
    globalThis.localStorage?.setItem(KEY, level);
  } catch {
    // Kept in memory only, until the page is closed.
  }
  for (const listener of listeners) listener(level);
}

/** Calls `listener` with every new level. Returns the unsubscribe. */
export function subscribeSoundLevel(listener: (level: SoundLevel) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Forgets the in-memory level, for tests. */
export function resetSoundLevel(): void {
  memoryLevel = 'on';
  listeners.clear();
}

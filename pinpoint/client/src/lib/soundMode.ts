// The Screen's sound level, cycled with `M` and kept on this device (spec: Sound and haptics).
// The sounds feature (F56) reads it to set Howler's volume.

export const SOUND_MODES = ['Sound', 'Quiet', 'Muted'] as const;
export type SoundMode = (typeof SOUND_MODES)[number];

const KEY = 'pinpoint:sound';

export function loadSoundMode(): SoundMode {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return SOUND_MODES.find((m) => m === raw) ?? 'Sound';
  } catch {
    return 'Sound';
  }
}

/** Sound → Quiet → Muted → Sound, stored; returns the new mode. */
export function cycleSoundMode(): SoundMode {
  const next = SOUND_MODES[(SOUND_MODES.indexOf(loadSoundMode()) + 1) % SOUND_MODES.length]!;
  try {
    globalThis.localStorage?.setItem(KEY, next);
  } catch {
    // Without storage the mode lasts until reload.
  }
  return next;
}

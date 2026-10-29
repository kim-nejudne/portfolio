import { useSyncExternalStore } from 'react';
import { getSoundLevel, subscribeSoundLevel, type SoundLevel } from './sounds.js';

/** This device's sound level, re-rendering when the button or `M` changes it. */
export function useSoundLevel(): SoundLevel {
  return useSyncExternalStore(subscribeSoundLevel, getSoundLevel);
}

import type { Howl } from 'howler';
import { loadSoundMode, type SoundMode } from './soundMode.js';

// The Screen's sounds (spec: Sound and haptics), made by `scripts/make-sounds.mjs`.
export const SOUND_NAMES = ['flap', 'chime', 'tick', 'thud', 'fanfare'] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

/** Howler's global volume per mode: Sound 100%, Quiet 40%, Muted 0. */
export const SOUND_MODE_VOLUME: Record<SoundMode, number> = { Sound: 1, Quiet: 0.4, Muted: 0 };

// Howler loads on demand, so only a Screen downloads it. Phones never call `startSounds`, so
// every `playSound` there does nothing.
let howler: Promise<typeof import('howler')> | null = null;
let howlerModule: typeof import('howler') | null = null;
let howlerGlobal: typeof import('howler').Howler | null = null;
let starting: Promise<void> | null = null;
let sounds: Map<SoundName, Howl> | null = null;
// The clatter on now (looped) and when it stops: overlapping rows stretch one clatter, never stack.
let flap: { id: number; stopAt: number; timer: ReturnType<typeof setTimeout> } | null = null;

function loadHowler(): Promise<typeof import('howler')> {
  howler ??= import('howler').then((m) => (howlerModule = m));
  return howler;
}

/**
 * Fetches Howler ahead of Click to start, so `startSounds` can unlock audio inside the click itself
 * (WebKit only resumes an AudioContext synchronously within the gesture). Plays nothing.
 */
export function preloadSounds(): void {
  loadHowler().catch(() => {});
}

/**
 * Loads every sound and unlocks audio, at the stored mode's volume. Call it from Click to start:
 * browsers only start audio after a user gesture. If Howler fails to load the Screen stays silent.
 */
export function startSounds(): Promise<void> {
  starting ??= begin();
  return starting;
}

async function begin(): Promise<void> {
  try {
    // With Howler preloaded nothing is awaited before `resume()`, so it runs inside the click.
    const { Howl, Howler } = howlerModule ?? (await loadHowler());
    Howler.volume(SOUND_MODE_VOLUME[loadSoundMode()]);
    howlerGlobal = Howler;
    sounds = new Map(
      SOUND_NAMES.map((n) => [n, new Howl({ src: [`/sounds/${n}.wav`], loop: n === 'flap' })]),
    );
    // Howler would otherwise wait for the next gesture to resume a suspended AudioContext.
    if (Howler.ctx?.state === 'suspended') await Howler.ctx.resume();
  } catch {
    // No audio: the game works without it.
  }
}

/** Sets the volume for `mode` (after `M` cycles it). */
export function applySoundMode(mode: SoundMode): void {
  howlerGlobal?.volume(SOUND_MODE_VOLUME[mode]);
}

/** Plays `name`. Does nothing before `startSounds`, so nothing plays off the Screen. */
export function playSound(name: SoundName): void {
  const howl = sounds?.get(name);
  if (!howl) return;
  // The playtest reads this line to check which sounds fired.
  if (import.meta.env.DEV) console.debug(`[sound] ${name}`);
  howl.play();
}

/** Plays the flap clatter for `ms` (the row's flap length), or stretches the one already on. */
export function playFlap(ms: number): void {
  const howl = sounds?.get('flap');
  if (!howl) return;
  const stopAt = Date.now() + ms;
  if (flap && stopAt <= flap.stopAt) return;
  if (flap) clearTimeout(flap.timer);
  else if (import.meta.env.DEV) console.debug('[sound] flap');
  const id = flap?.id ?? howl.play();
  const timer = setTimeout(() => {
    howl.stop(id);
    flap = null;
  }, ms);
  flap = { id, stopAt, timer };
}

/** Forgets everything loaded, for tests. */
export function resetSounds(): void {
  if (flap) clearTimeout(flap.timer);
  flap = null;
  sounds = null;
  howler = null;
  howlerModule = null;
  howlerGlobal = null;
  starting = null;
}

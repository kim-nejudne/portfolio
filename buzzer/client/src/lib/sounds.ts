import type { Howl } from 'howler';
import type { Fx } from '../../../shared/types.js';

export type SoundName = 'buzz' | 'correct' | 'wrong' | 'timeUp' | 'join' | 'practice' | 'fanfare';

export const SOUND_NAMES: readonly SoundName[] = [
  'buzz',
  'correct',
  'wrong',
  'timeUp',
  'join',
  'practice',
  'fanfare',
];

/** Where each sound is served from (`client/public/sounds`, made by `scripts/make-sounds.mjs`). */
export function soundUrl(name: SoundName): string {
  return `/sounds/${name}.wav`;
}

/**
 * The sound an `fx` event plays. FINAL's fanfare is not an `fx`.
 * SPEC-QUESTION: the spec gives Wrong "buzz sound" but lists a separate wrong sound; `wrong.wav`
 * is the low game-show buzzer, `buzz.wav` the ring-in (DECISIONS, F31).
 * A lobby test buzz plays `practice.wav`, a quiet tick (DECISIONS F60).
 */
export function soundForFx(fx: Fx): SoundName {
  return fx.kind;
}

/** The Screen's sound levels, in the order the sound button and `M` cycle them (UI spec, Screen view). */
export type SoundLevel = 'on' | 'quiet' | 'muted';

export const SOUND_LEVELS: readonly SoundLevel[] = ['on', 'quiet', 'muted'];

/** Howler's global volume for each level: Quiet is 40 % (DECISIONS F62). */
export const SOUND_LEVEL_VOLUME: Record<SoundLevel, number> = { on: 1, quiet: 0.4, muted: 0 };

export const SOUND_LEVEL_LABEL: Record<SoundLevel, string> = {
  on: 'Sound on',
  quiet: 'Quiet',
  muted: 'Muted',
};

// Per device, like the host tokens. Storage can be unavailable, so every access is guarded.
const LEVEL_KEY = 'buzzr:soundLevel';
// The level when storage cannot be written: it lasts until the page is closed.
let memoryLevel: SoundLevel = 'on';
const levelListeners = new Set<() => void>();

function isSoundLevel(value: unknown): value is SoundLevel {
  return SOUND_LEVELS.includes(value as SoundLevel);
}

/** This device's sound level: the stored one, else Sound on. */
export function getSoundLevel(): SoundLevel {
  try {
    const stored = localStorage.getItem(LEVEL_KEY);
    if (isSoundLevel(stored)) return stored;
  } catch {
    // Fall back to the level kept in memory.
  }
  return memoryLevel;
}

/** Moves to the next level (Sound on, Quiet, Muted, then Sound on), keeps it and applies it. */
export function cycleSoundLevel(): void {
  const current = getSoundLevel();
  const next = SOUND_LEVELS[(SOUND_LEVELS.indexOf(current) + 1) % SOUND_LEVELS.length]!;
  memoryLevel = next;
  try {
    localStorage.setItem(LEVEL_KEY, next);
  } catch {
    // Kept in memory only.
  }
  howlerGlobal?.volume(SOUND_LEVEL_VOLUME[next]);
  for (const listener of levelListeners) listener();
}

/** Calls `listener` after every level change. Returns the unsubscribe, for `useSyncExternalStore`. */
export function subscribeSoundLevel(listener: () => void): () => void {
  levelListeners.add(listener);
  return () => levelListeners.delete(listener);
}

// Howler loads on demand, so only a Screen downloads it.
let howler: Promise<typeof import('howler')> | null = null;
let howlerGlobal: typeof import('howler').Howler | null = null;
let sounds: Map<SoundName, Howl> | null = null;

function loadHowler(): Promise<typeof import('howler')> {
  howler ??= import('howler');
  return howler;
}

/** Starts downloading Howler early, so `startSounds` can finish inside the click that calls it. */
export function preloadSounds(): void {
  loadHowler().catch(() => {});
}

/**
 * Loads every sound and unlocks audio. Call it from a click or key press: browsers only let a
 * page start audio after a user gesture. If Howler fails to load, the Screen stays silent.
 */
export async function startSounds(): Promise<void> {
  if (sounds) return;
  try {
    const { Howl, Howler } = await loadHowler();
    // The stored level applies before any sound can play.
    Howler.volume(SOUND_LEVEL_VOLUME[getSoundLevel()]);
    howlerGlobal = Howler;
    sounds ??= new Map(SOUND_NAMES.map((name) => [name, new Howl({ src: [soundUrl(name)] })]));
    // Howler would otherwise wait for the next gesture to resume a suspended AudioContext.
    if (Howler.ctx?.state === 'suspended') await Howler.ctx.resume();
  } catch {
    // No audio: the game works without it.
  }
}

/** Plays `name`. Does nothing before `startSounds`. */
export function playSound(name: SoundName): void {
  // The playtest reads this line to check which sounds fired.
  if (import.meta.env.DEV) console.debug(`[sound] ${name}`);
  sounds?.get(name)?.play();
}

/** Forgets the loaded sounds and the in-memory level, for tests. */
export function resetSounds(): void {
  sounds = null;
  howler = null;
  howlerGlobal = null;
  memoryLevel = 'on';
}

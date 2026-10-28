import type { Howl } from 'howler';
import type { Fx } from '../../../shared/types.js';

export type SoundName = 'buzz' | 'correct' | 'wrong' | 'join' | 'fanfare';

export const SOUND_NAMES: readonly SoundName[] = ['buzz', 'correct', 'wrong', 'join', 'fanfare'];

/** Where each sound is served from (`client/public/sounds`, made by `scripts/make-sounds.mjs`). */
export function soundUrl(name: SoundName): string {
  return `/sounds/${name}.wav`;
}

/**
 * The sound an `fx` event plays, or null for a silent one. FINAL's fanfare is not an `fx`.
 * SPEC-QUESTION: the spec gives Wrong "buzz sound" but lists a separate wrong sound; `wrong.wav`
 * is the low game-show buzzer, `buzz.wav` the ring-in (DECISIONS, F31).
 */
export function soundForFx(fx: Fx): SoundName | null {
  // The time's-up sound arrives with the Screen's countdown (F36).
  return fx.kind === 'timeUp' ? null : fx.kind;
}

// Howler loads on demand, so only a Screen downloads it.
let howler: Promise<typeof import('howler')> | null = null;
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

/** Forgets the loaded sounds, for tests. */
export function resetSounds(): void {
  sounds = null;
  howler = null;
}

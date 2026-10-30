// The Screen's sounds (UI by role and phase, Screen: Sound), ported from Buzzr's `sounds.ts`.
// Howler and the files load on demand, so only a Screen that was tapped to start downloads them;
// phones never import this module.

import type { Howl } from 'howler';
import type { Fx, Phase, TimerView, TurnEndReason } from '../../../shared/types.js';
import { loadSoundLevel, subscribeSoundLevel, type SoundLevel } from './soundPref.js';

export type SoundName = 'join' | 'yourTurn' | 'correct' | 'tick' | 'timeUp' | 'reveal' | 'fanfare';

export const SOUND_NAMES: readonly SoundName[] = [
  'join',
  'yourTurn',
  'correct',
  'tick',
  'timeUp',
  'reveal',
  'fanfare',
];

/** Where each sound is served from (`client/public/sounds`, made by `scripts/make-sounds.mjs`). */
export function soundUrl(name: SoundName): string {
  return `/sounds/${name}.wav`;
}

/** Howler's global volume for each level: Quiet is 40 %, as in Buzzr. */
export const SOUND_LEVEL_VOLUME: Record<SoundLevel, number> = { on: 1, quiet: 0.4, muted: 0 };

/** The last-10-s tick plays at each whole second from this much time left down to 1 s. */
export const TICK_FROM_MS = 10_000;
/** The reveal sting waits this long after the time-up sound, which is 0.6 s long. */
export const STING_AFTER_TIME_UP_MS = 600;

/**
 * The sound an `fx` event plays on the Screen, or null. Only `join` and `correct` sound; the
 * others are phase changes (`transitionSounds`) or phone-only.
 */
export function soundForFx(fx: Fx): SoundName | null {
  if (fx.kind === 'join') return 'join';
  if (fx.kind === 'correct') return 'correct';
  return null;
}

/** What the Screen's sounds follow in each snapshot. */
export interface SoundState {
  phase: Phase;
  turnId: number | null;
  endReason: TurnEndReason | null;
}

export interface Cue {
  name: SoundName;
  delayMs: number;
}

/**
 * The sounds a change of snapshot plays. `prev` is null for the Screen's first snapshot, which
 * plays nothing: a Screen opened mid-game doesn't chime for a turn that started before it.
 * - A new turn (CHOOSING, or DRAWING when its word was chosen ahead): the "your turn" chime.
 * - Into REVEAL: the sting as the word pops in, after the time-up sound when the clock ran out.
 * - Into FINAL: the fanfare.
 * SPEC-QUESTION: the spec lists the sounds but not their moments; DECISIONS 60.
 */
export function transitionSounds(prev: SoundState | null, next: SoundState): Cue[] {
  if (!prev) return [];
  const cues: Cue[] = [];
  const inTurn = next.phase === 'CHOOSING' || next.phase === 'DRAWING';
  if (inTurn && next.turnId !== null && next.turnId !== prev.turnId) {
    cues.push({ name: 'yourTurn', delayMs: 0 });
  }
  if (next.phase === 'REVEAL' && prev.phase !== 'REVEAL') {
    if (next.endReason === 'time') {
      cues.push({ name: 'timeUp', delayMs: 0 });
      cues.push({ name: 'reveal', delayMs: STING_AFTER_TIME_UP_MS });
    } else {
      cues.push({ name: 'reveal', delayMs: 0 });
    }
  }
  if (next.phase === 'FINAL' && prev.phase !== 'FINAL') cues.push({ name: 'fanfare', delayMs: 0 });
  return cues;
}

/**
 * The next last-10-s tick: the whole second it marks and how long until then, or null when none
 * is left. `leftMs` is the time left on the drawing clock; `lastTick` the second last ticked this
 * turn (11 before any), so a resync from a new snapshot never ticks a second twice. A tick already
 * passed is skipped, not played late.
 */
export function nextTick(
  leftMs: number,
  lastTick: number,
): { second: number; inMs: number } | null {
  const second = Math.min(lastTick - 1, Math.floor(leftMs / 1000), TICK_FROM_MS / 1000);
  if (second < 1) return null;
  return { second, inMs: Math.max(0, leftMs - second * 1000) };
}

/** A snapshot as the Screen's sounds read it; `receivedAt` is `performance.now()` on arrival. */
export interface SoundInput extends SoundState {
  timer: TimerView | null;
  receivedAt: number;
}

export interface ScreenSounds {
  /** Plays what the change to this snapshot calls for, and (re)schedules the ticks. */
  update(input: SoundInput): void;
  /** Cancels a waiting sting and the next tick. */
  stop(): void;
}

/**
 * The Screen's phase sounds and last-10-s ticks, driven by its snapshots. The ticks count down
 * locally from the latest snapshot's timer like `useCountdown`, stop while paused, and resume
 * from the clock the resume snapshot gives.
 */
export function createScreenSounds(
  play: (name: SoundName) => void,
  now: () => number = () => performance.now(),
): ScreenSounds {
  let last: SoundState | null = null;
  const pending = new Set<ReturnType<typeof setTimeout>>();
  let tickTimer: ReturnType<typeof setTimeout> | undefined;
  // The second last ticked, per turn, so a new snapshot mid-countdown doesn't tick it again.
  let tickTurn: number | null = null;
  let lastTick = TICK_FROM_MS / 1000 + 1;

  const scheduleTick = (timer: TimerView, receivedAt: number) => {
    const tick = nextTick(timer.remainingMs - (now() - receivedAt), lastTick);
    if (!tick) return;
    tickTimer = setTimeout(() => {
      lastTick = tick.second;
      play('tick');
      scheduleTick(timer, receivedAt);
    }, tick.inMs);
  };

  return {
    update({ phase, turnId, endReason, timer, receivedAt }) {
      const next = { phase, turnId, endReason };
      for (const cue of transitionSounds(last, next)) {
        if (cue.delayMs === 0) {
          play(cue.name);
          continue;
        }
        const id = setTimeout(() => {
          pending.delete(id);
          play(cue.name);
        }, cue.delayMs);
        pending.add(id);
      }
      last = next;

      clearTimeout(tickTimer);
      if (phase !== 'DRAWING' || !timer?.running || turnId === null) return;
      if (tickTurn !== turnId) {
        tickTurn = turnId;
        lastTick = TICK_FROM_MS / 1000 + 1;
      }
      scheduleTick(timer, receivedAt);
    },
    stop() {
      clearTimeout(tickTimer);
      for (const id of pending) clearTimeout(id);
      pending.clear();
    },
  };
}

// Howler loads on demand, so only a Screen downloads it.
type HowlerModule = typeof import('howler');
let howler: Promise<HowlerModule> | null = null;
// The module once it has arrived, so a tap can start audio without leaving its gesture.
let loaded: HowlerModule | null = null;
let sounds: Map<SoundName, Howl> | null = null;
let unsubscribe: (() => void) | null = null;
let disarm: (() => void) | null = null;

function loadHowler(): Promise<HowlerModule> {
  howler ??= import('howler').then((mod) => (loaded = mod));
  return howler;
}

/** Starts downloading Howler early, so `startSounds` can finish inside the tap that calls it. */
export function preloadSounds(): void {
  loadHowler().catch(() => {
    howler = null;
  });
}

/**
 * Resumes the AudioContext and plays a one-sample silent buffer, which is what iOS Safari needs
 * to unlock audio. Only works inside a user gesture; elsewhere it quietly does nothing.
 */
function unlock(ctx: AudioContext | undefined): void {
  if (!ctx || ctx.state === 'running') return;
  try {
    const silence = ctx.createBufferSource();
    silence.buffer = ctx.createBuffer(1, 1, 22050);
    silence.connect(ctx.destination);
    silence.start(0);
  } catch {
    // Not allowed yet: the next gesture tries again.
  }
  ctx.resume().catch(() => {});
}

/**
 * Every later tap, click or key press unlocks audio again while it isn't running: when the tap to
 * start came before Howler arrived, or iOS interrupted the context (a call, a lock, an app switch).
 */
function armUnlock(ctx: () => AudioContext | undefined): () => void {
  if (typeof window === 'undefined') return () => {};
  const target = window;
  const retry = () => unlock(ctx());
  const types = ['pointerdown', 'keydown', 'touchend'] as const;
  for (const type of types) target.addEventListener(type, retry, { capture: true, passive: true });
  return () => {
    for (const type of types) target.removeEventListener(type, retry, { capture: true });
  };
}

function begin({ Howl, Howler }: HowlerModule): void {
  if (!sounds) {
    // The Screen is plugged in and holds a wake lock: a suspended context would make the first
    // tick of a long turn late (Howler suspends after 30 s of silence).
    Howler.autoSuspend = false;
    // The stored level applies before any sound can play, and every change after it.
    Howler.volume(SOUND_LEVEL_VOLUME[loadSoundLevel()]);
    unsubscribe ??= subscribeSoundLevel((level) => Howler.volume(SOUND_LEVEL_VOLUME[level]));
    sounds = new Map(
      SOUND_NAMES.map((name) => [
        name,
        new Howl({
          src: [soundUrl(name)],
          onloaderror: () => {
            if (import.meta.env.DEV) console.debug(`[sound] ${name} failed to load`);
          },
        }),
      ]),
    );
    disarm ??= armUnlock(() => Howler.ctx);
  }
  unlock(Howler.ctx);
}

/**
 * Loads every sound and unlocks audio. Call it from a tap or key press (Tap to start): browsers
 * only let a page start audio after a user gesture. With Howler already here (`preloadSounds`) it
 * all happens inside the gesture; otherwise the next tap or key press finishes the unlock. If
 * Howler fails to load, the Screen stays silent and the game works without it.
 */
export function startSounds(): Promise<void> {
  // iOS: play through the ringer switch, like a video, rather than as a ringtone-class sound.
  const nav = globalThis.navigator as (Navigator & { audioSession?: { type: string } }) | undefined;
  if (nav?.audioSession) nav.audioSession.type = 'playback';
  try {
    if (loaded) return Promise.resolve(begin(loaded));
  } catch {
    return Promise.resolve();
  }
  return loadHowler()
    .then(begin)
    .catch(() => {
      howler = null;
      if (import.meta.env.DEV) console.debug('[sound] Howler failed to load');
    });
}

/** Plays `name`. Does nothing before `startSounds`, or for a tick whose file isn't loaded yet. */
export function playSound(name: SoundName): void {
  // The playtest reads this line to check which sounds fired.
  if (import.meta.env.DEV) console.debug(`[sound] ${name}`);
  const sound = sounds?.get(name);
  // A tick queued while its file decodes would play late, on the wrong second.
  if (name === 'tick' && sound?.state() !== 'loaded') return;
  sound?.play();
}

/** Forgets the loaded sounds and the unlock listeners, for tests. */
export function resetSounds(): void {
  unsubscribe?.();
  unsubscribe = null;
  disarm?.();
  disarm = null;
  sounds = null;
  howler = null;
  loaded = null;
}

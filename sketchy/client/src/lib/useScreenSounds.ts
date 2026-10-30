import { useEffect, useMemo } from 'react';
import type { ScreenView } from '../../../shared/types.js';
import { createScreenSounds, playSound } from './sounds.js';

/**
 * Plays the Screen's phase sounds (the "your turn" chime, time-up, the reveal sting, the final
 * fanfare) and the last-10-s tick from the latest snapshot. `receivedAt` is `performance.now()`
 * when it arrived, as for `useCountdown`. The `fx` sounds (join, correct) play where `fx` arrives.
 * Nothing sounds before Tap to start: `playSound` is silent until `startSounds`.
 */
export function useScreenSounds(view: ScreenView | null, receivedAt: number): void {
  const sounds = useMemo(() => createScreenSounds(playSound), []);

  useEffect(() => {
    if (!view) return;
    sounds.update({
      phase: view.phase,
      turnId: view.turn?.id ?? null,
      endReason: view.turn?.endReason ?? null,
      timer: view.turn?.timer ?? null,
      receivedAt,
    });
  }, [sounds, view, receivedAt]);

  useEffect(() => () => sounds.stop(), [sounds]);
}

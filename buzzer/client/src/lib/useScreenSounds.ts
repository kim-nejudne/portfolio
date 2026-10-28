import { useEffect, useRef } from 'react';
import type { Phase } from '../../../shared/types.js';
import { useRoomStore } from './roomStore.js';
import { playSound, soundForFx } from './sounds.js';

/**
 * Plays the Screen's sounds: one per `fx` event, and the fanfare when the game reaches FINAL.
 * `phase` is null until the first state arrives. Only what happens after mount plays: an `fx`
 * already in the store, or a Screen whose first state is FINAL, stays quiet.
 */
export function useScreenSounds(phase: Phase | null): void {
  const event = useRoomStore((state) => state.fx);
  const playedSeq = useRef(event?.seq ?? 0);
  const lastPhase = useRef(phase);

  useEffect(() => {
    if (!event || event.seq <= playedSeq.current) return;
    playedSeq.current = event.seq;
    const sound = soundForFx(event.fx);
    if (sound) playSound(sound);
  }, [event]);

  useEffect(() => {
    // SPEC-QUESTION: the spec names a "final fanfare" but no event; it plays on the change into FINAL (DECISIONS, F31).
    const reached = lastPhase.current !== null && lastPhase.current !== 'FINAL';
    if (phase === 'FINAL' && reached) playSound('fanfare');
    lastPhase.current = phase;
  }, [phase]);
}

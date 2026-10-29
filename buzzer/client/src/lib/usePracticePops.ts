import { useEffect, useState } from 'react';
import { useRoomStore } from './roomStore.js';

/**
 * Each player's latest lobby test buzz, as the `fx` sequence number it arrived with. A chip keyed
 * by it replays its bump on every test buzz, even when two players press in quick succession. Only
 * events after mount count, so a remount never replays one already in the store.
 */
export function usePracticePops(): ReadonlyMap<string, number> {
  const [pops, setPops] = useState<ReadonlyMap<string, number>>(() => new Map());

  useEffect(
    () =>
      useRoomStore.subscribe(({ fx: event }, previous) => {
        if (!event || event === previous.fx || event.fx.kind !== 'practice') return;
        const { playerId } = event.fx;
        setPops((current) => new Map(current).set(playerId, event.seq));
      }),
    [],
  );

  return pops;
}

import { create } from 'zustand';
import type { PlayerFx, ScreenFx, View } from '#shared/types.js';

/** The latest role-filtered snapshot. Pages render from this and hold no game logic. */
export interface RoomState {
  view: View | null;
  /** `serverNow − Date.now()` at the latest snapshot: add it to `Date.now()` to read the server clock. */
  clockOffset: number;
  /** Why this page cannot show the room ("This game has ended", a refused join), or null. */
  error: string | null;
  /** The latest one-off `fx`; `seq` counts up so the same event twice still replays. */
  fx: { fx: ScreenFx | PlayerFx; seq: number } | null;
}

const INITIAL: RoomState = { view: null, clockOffset: 0, error: null, fx: null };

export const useRoomStore = create<RoomState>()(() => INITIAL);

export function resetRoomStore(): void {
  useRoomStore.setState(INITIAL, true);
}

/** The server's clock now, from the latest snapshot's offset. */
export function serverNow(): number {
  return Date.now() + useRoomStore.getState().clockOffset;
}

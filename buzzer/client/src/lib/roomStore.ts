import { create } from 'zustand';
import type { Fx, View } from '../../../shared/types.js';

/** The last one-off `fx` event. `seq` counts up, so the same event twice still replays. */
export interface FxEvent {
  fx: Fx;
  seq: number;
}

/** The latest role-filtered snapshot from the server. Pages render from this and hold no game logic. */
export interface RoomState {
  view: View | null;
  /** Why the join failed (for example "Room not found"), or null. */
  error: string | null;
  /** The latest `fx`, for sounds and animations. Null until one arrives. */
  fx: FxEvent | null;
}

export const useRoomStore = create<RoomState>()(() => ({ view: null, error: null, fx: null }));

export function resetRoomStore(): void {
  useRoomStore.setState({ view: null, error: null, fx: null });
}

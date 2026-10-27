import { create } from 'zustand';
import type { View } from '../../../shared/types.js';

/** The latest role-filtered snapshot from the server. Pages render from this and hold no game logic. */
export interface RoomState {
  view: View | null;
  /** Why the join failed (for example "Room not found"), or null. */
  error: string | null;
}

export const useRoomStore = create<RoomState>()(() => ({ view: null, error: null }));

export function resetRoomStore(): void {
  useRoomStore.setState({ view: null, error: null });
}

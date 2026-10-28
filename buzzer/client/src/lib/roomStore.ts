import { create } from 'zustand';
import type { Fx, View } from '../../../shared/types.js';

/** The last one-off `fx` event. `seq` counts up, so the same event twice still replays. */
export interface FxEvent {
  fx: Fx;
  seq: number;
}

/**
 * The socket's link to the server, for the connection dot, the Screen's banner and the Host's
 * Players tab: `connecting` while it is down and Socket.IO is retrying (or on the first connect),
 * or while it has gone silent (unanswered pings, the browser's `offline` event); `offline` once
 * that has lasted `OFFLINE_AFTER_MS` (F33, F41).
 */
export type Connection = 'connected' | 'connecting' | 'offline';

/** The latest role-filtered snapshot from the server. Pages render from this and hold no game logic. */
export interface RoomState {
  view: View | null;
  /** Why the join failed (for example "Room not found"), or null. */
  error: string | null;
  /** The latest `fx`, for sounds and animations. Null until one arrives. */
  fx: FxEvent | null;
  connection: Connection;
  /** Counts `host:paired` events: a change means another host device just joined (F38). */
  hostJoins: number;
}

export const useRoomStore = create<RoomState>()(() => ({
  view: null,
  error: null,
  fx: null,
  connection: 'connecting',
  hostJoins: 0,
}));

export function resetRoomStore(): void {
  useRoomStore.setState({
    view: null,
    error: null,
    fx: null,
    connection: 'connecting',
    hostJoins: 0,
  });
}

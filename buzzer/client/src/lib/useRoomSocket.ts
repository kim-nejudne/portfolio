import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import {
  GAME_ENDED_ERROR,
  PLAYER_KICKED_ERROR,
  ROOM_NOT_FOUND_ERROR,
} from '../../../shared/constants.js';
import type { Ack } from '../../../shared/types.js';
import { resetRoomStore, useRoomStore } from './roomStore.js';
import { createSocket, type GameSocket } from './socket.js';

/** How long the socket may be down, retrying, before the connection dot turns from amber to red. */
export const OFFLINE_AFTER_MS = 5000;

/** Sends this page's join event (`screen:join`, `host:join` or `player:join`) and passes the ack on. */
export type JoinRoom = (socket: GameSocket, ack: (res: Ack) => void) => void;

/** Adds listeners to a fresh socket before it connects. Returns a cleanup run on unmount. */
export type AttachSocket = (socket: GameSocket) => () => void;

/**
 * Keeps one socket to `code` open while the page is mounted. It joins on every connect, so an
 * automatic reconnect rejoins, and writes each `state` snapshot and `fx` event into the room
 * store. A `kicked` event becomes the `PLAYER_KICKED_ERROR` error, the same one a rejoin after a
 * kick gets; the server disconnects the socket
 * right after, and Socket.IO does not reconnect after that (DECISIONS F21). The returned
 * ref holds the open socket, for event handlers that send actions; it is null while unmounted.
 * `attach` must be stable: a new one opens a new socket.
 *
 * The game is over for good on `room:closed` (the room expired), or when a rejoin after a
 * `state` is refused with "Room not found" (the server restarted and lost the room). Both become
 * `GAME_ENDED_ERROR`. The server disconnects after `room:closed`, so nothing reconnects.
 *
 * It also keeps the store's `connection` up to date for the connection dot: `connected` on each
 * connect, `connecting` while the socket is down, and `offline` after `OFFLINE_AFTER_MS` down.
 */
export function useRoomSocket(
  code: string,
  join: JoinRoom,
  makeSocket: () => GameSocket = createSocket,
  attach?: AttachSocket,
): RefObject<GameSocket | null> {
  const socketRef = useRef<GameSocket | null>(null);
  const sendJoin = useEffectEvent((socket: GameSocket) => {
    join(socket, (res) => {
      if (res.ok) return;
      // SPEC-QUESTION: "Room not found" reads as ended only for a device that was in the room (DECISIONS, F32).
      // This page was in the room a moment ago, so it has not vanished: it ended.
      const lost = res.error === ROOM_NOT_FOUND_ERROR && useRoomStore.getState().view !== null;
      useRoomStore.setState({ error: lost ? GAME_ENDED_ERROR : res.error });
    });
  });

  useEffect(() => {
    const socket = makeSocket();
    socketRef.current = socket;
    let offlineTimer: ReturnType<typeof setTimeout> | undefined;
    const goingOffline = () => {
      clearTimeout(offlineTimer);
      offlineTimer = setTimeout(
        () => useRoomStore.setState({ connection: 'offline' }),
        OFFLINE_AFTER_MS,
      );
    };
    socket.on('state', (view) => useRoomStore.setState({ view, error: null }));
    socket.on('fx', (fx) =>
      useRoomStore.setState((state) => ({ fx: { fx, seq: (state.fx?.seq ?? 0) + 1 } })),
    );
    socket.on('kicked', () => useRoomStore.setState({ error: PLAYER_KICKED_ERROR }));
    socket.on('room:closed', () => useRoomStore.setState({ error: GAME_ENDED_ERROR }));
    socket.on('connect', () => {
      clearTimeout(offlineTimer);
      useRoomStore.setState({ connection: 'connected' });
      sendJoin(socket);
    });
    socket.on('disconnect', () => {
      useRoomStore.setState({ connection: 'connecting' });
      goingOffline();
    });
    const detach = attach?.(socket);
    // The first connect can fail too (server down): the same clock runs until it succeeds.
    goingOffline();
    socket.connect();
    return () => {
      detach?.();
      socket.disconnect();
      clearTimeout(offlineTimer);
      socketRef.current = null;
      resetRoomStore();
    };
  }, [code, makeSocket, attach]);

  return socketRef;
}

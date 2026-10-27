import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import type { Ack } from '../../../shared/types.js';
import { resetRoomStore, useRoomStore } from './roomStore.js';
import { createSocket, type GameSocket } from './socket.js';

/** Sends this page's join event (`screen:join`, `host:join` or `player:join`) and passes the ack on. */
export type JoinRoom = (socket: GameSocket, ack: (res: Ack) => void) => void;

/**
 * Keeps one socket to `code` open while the page is mounted. It joins on every connect, so an
 * automatic reconnect rejoins, and writes each `state` snapshot into the room store. The returned
 * ref holds the open socket, for event handlers that send actions; it is null while unmounted.
 */
export function useRoomSocket(
  code: string,
  join: JoinRoom,
  makeSocket: () => GameSocket = createSocket,
): RefObject<GameSocket | null> {
  const socketRef = useRef<GameSocket | null>(null);
  const sendJoin = useEffectEvent((socket: GameSocket) => {
    join(socket, (res) => {
      if (!res.ok) useRoomStore.setState({ error: res.error });
    });
  });

  useEffect(() => {
    const socket = makeSocket();
    socketRef.current = socket;
    socket.on('state', (view) => useRoomStore.setState({ view, error: null }));
    socket.on('connect', () => sendJoin(socket));
    socket.connect();
    return () => {
      socket.disconnect();
      socketRef.current = null;
      resetRoomStore();
    };
  }, [code, makeSocket]);

  return socketRef;
}

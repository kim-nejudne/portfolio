import { useEffect, useEffectEvent } from 'react';
import type { Ack } from '../../../shared/types.js';
import { resetRoomStore, useRoomStore } from './roomStore.js';
import { createSocket, type GameSocket } from './socket.js';

/** Sends this page's join event (`screen:join`, `host:join` or `player:join`) and passes the ack on. */
export type JoinRoom = (socket: GameSocket, ack: (res: Ack) => void) => void;

/**
 * Keeps one socket to `code` open while the page is mounted. It joins on every connect, so an
 * automatic reconnect rejoins, and writes each `state` snapshot into the room store.
 */
export function useRoomSocket(
  code: string,
  join: JoinRoom,
  makeSocket: () => GameSocket = createSocket,
): void {
  const sendJoin = useEffectEvent((socket: GameSocket) => {
    join(socket, (res) => {
      if (!res.ok) useRoomStore.setState({ error: res.error });
    });
  });

  useEffect(() => {
    const socket = makeSocket();
    socket.on('state', (view) => useRoomStore.setState({ view, error: null }));
    socket.on('connect', () => sendJoin(socket));
    socket.connect();
    return () => {
      socket.disconnect();
      resetRoomStore();
    };
  }, [code, makeSocket]);
}

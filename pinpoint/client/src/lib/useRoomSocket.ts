import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import { GAME_ENDED_ERROR, KICKED_ERROR } from '#shared/constants.js';
import type { Ack } from '#shared/types.js';
import { resetRoomStore, useRoomStore } from './roomStore.js';
import { createSocket, type GameSocket } from './socket.js';

/** Sends this page's join event (`screen:join` or `player:join`) and passes the ack on. */
export type JoinRoom = (socket: GameSocket, ack: (res: Ack) => void) => void;

/**
 * Keeps one socket to `code` open while the page is mounted (adapted from Buzzr). It joins on every
 * connect, so a reconnect rejoins, and writes each `state` (with the clock offset) and `fx` into the
 * room store, with the connection state. A refused join, `kicked` or `room:closed` becomes the
 * store's `error`. Returns the open socket, for the page's own events.
 */
export function useRoomSocket(
  code: string,
  join: JoinRoom,
  makeSocket = createSocket,
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
    socket.on('state', (view) =>
      useRoomStore.setState({ view, clockOffset: view.serverNow - Date.now(), error: null }),
    );
    socket.on('fx', (fx) =>
      useRoomStore.setState((s) => ({ fx: { fx, seq: (s.fx?.seq ?? 0) + 1 } })),
    );
    socket.on('room:closed', () => useRoomStore.setState({ error: GAME_ENDED_ERROR }));
    socket.on('kicked', () => useRoomStore.setState({ error: KICKED_ERROR }));
    socket.on('connect', () => {
      useRoomStore.setState({ connection: 'connected' });
      sendJoin(socket);
    });
    // `active` stays true while Socket.IO will retry; a server-side disconnect ends it.
    socket.on('disconnect', () =>
      useRoomStore.setState({ connection: socket.active ? 'connecting' : 'offline' }),
    );
    socket.connect();
    return () => {
      socket.disconnect();
      socketRef.current = null;
      resetRoomStore();
    };
  }, [code, makeSocket]);
  return socketRef;
}

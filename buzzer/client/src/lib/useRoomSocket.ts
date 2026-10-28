import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import {
  GAME_ENDED_ERROR,
  PLAYER_KICKED_ERROR,
  ROOM_NOT_FOUND_ERROR,
} from '../../../shared/constants.js';
import type { Ack } from '../../../shared/types.js';
import { keepPinging } from './ping.js';
import { resetRoomStore, useRoomStore } from './roomStore.js';
import { createSocket, type GameSocket } from './socket.js';

/** How long the socket may be down, retrying, before the connection dot turns from amber to red. */
export const OFFLINE_AFTER_MS = 5000;

/** Sends this page's join event (`screen:join`, `host:join` or `player:join`) and passes the ack on. */
export type JoinRoom = (socket: GameSocket, ack: (res: Ack) => void) => void;

/**
 * Keeps one socket to `code` open while the page is mounted. It joins on every connect, so an
 * automatic reconnect rejoins, writes each `state` snapshot and `fx` event into the room store,
 * and counts `host:paired` events in `hostJoins` (F38). A `kicked` event becomes the
 * `PLAYER_KICKED_ERROR` error, the same one a rejoin after a kick gets; the server disconnects the
 * socket right after, and Socket.IO does not reconnect after that (DECISIONS F21). The returned
 * ref holds the open socket, for event handlers that send actions; it is null while unmounted.
 *
 * The game is over for good on `room:closed` (the room expired), or when a rejoin after a
 * `state` is refused with "Room not found" (the server restarted and lost the room). Both become
 * `GAME_ENDED_ERROR`. The server disconnects after `room:closed`, so nothing reconnects.
 *
 * Every role pings (`keepPinging`): the server times player RTTs from it (DECISIONS F17), and
 * every page hears a silent drop through the acks (F41).
 *
 * It also keeps the store's `connection` up to date for the connection dot, the Screen's banner
 * and the Host's Players tab: `connected` on each connect and each ping ack; `connecting` on a
 * disconnect, on `PINGS_LOST` unanswered pings, or on the browser's `offline` event; and
 * `offline` after `OFFLINE_AFTER_MS` of that. The browser's `online` event changes nothing:
 * Socket.IO's reconnect or the next ack decides.
 */
export function useRoomSocket(
  code: string,
  join: JoinRoom,
  makeSocket: () => GameSocket = createSocket,
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
    // The link looks down: amber now (red stays red), and red once it has been down for
    // OFFLINE_AFTER_MS. A second sign of the same outage does not restart that clock.
    const linkDown = () => {
      if (useRoomStore.getState().connection === 'connected') {
        useRoomStore.setState({ connection: 'connecting' });
      }
      offlineTimer ??= setTimeout(
        () => useRoomStore.setState({ connection: 'offline' }),
        OFFLINE_AFTER_MS,
      );
    };
    const linkUp = () => {
      clearTimeout(offlineTimer);
      offlineTimer = undefined;
      if (useRoomStore.getState().connection !== 'connected') {
        useRoomStore.setState({ connection: 'connected' });
      }
    };
    socket.on('state', (view) => useRoomStore.setState({ view, error: null }));
    socket.on('fx', (fx) =>
      useRoomStore.setState((state) => ({ fx: { fx, seq: (state.fx?.seq ?? 0) + 1 } })),
    );
    socket.on('kicked', () => useRoomStore.setState({ error: PLAYER_KICKED_ERROR }));
    socket.on('host:paired', () =>
      useRoomStore.setState((state) => ({ hostJoins: state.hostJoins + 1 })),
    );
    socket.on('room:closed', () => useRoomStore.setState({ error: GAME_ENDED_ERROR }));
    socket.on('connect', () => {
      linkUp();
      sendJoin(socket);
    });
    socket.on('disconnect', linkDown);
    const stopPinging = keepPinging(socket, { onAck: linkUp, onLost: linkDown });
    window.addEventListener('offline', linkDown);
    // The first connect can fail too (server down): the same clock runs until it succeeds.
    linkDown();
    socket.connect();
    return () => {
      stopPinging();
      window.removeEventListener('offline', linkDown);
      socket.disconnect();
      clearTimeout(offlineTimer);
      socketRef.current = null;
      resetRoomStore();
    };
  }, [code, makeSocket]);

  return socketRef;
}

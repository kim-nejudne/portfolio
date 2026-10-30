// The phone tells the server when its page is hidden (phone locked, app switched) and shown again
// (F40, `player:visibility`). For the drawer, 2 s hidden is the `drawerAway` pause, as a dropped
// socket is; for anyone else it changes nothing anyone sees.
//
// Only `visibilitychange`: browsers fire it (hidden) before `pagehide` too. A page closed, swiped
// away or put in the bfcache drops its socket, and the server's disconnect is the backstop for a
// report that never got out.

import type { VisibilitySource } from './ping.js';
import type { GameSocket } from './socket.js';

/**
 * Reports every change while the phone has joined (`joined()`) and is connected; not buffered while
 * offline. The join itself carries `hidden`, so a reconnect needs no report. Returns a stop.
 */
export function watchVisibility(
  socket: GameSocket,
  joined: () => boolean,
  page: VisibilitySource | undefined = typeof document === 'undefined' ? undefined : document,
): () => void {
  const onChange = () => {
    if (page && joined() && socket.connected)
      socket.emit('player:visibility', { hidden: page.hidden }, () => undefined);
  };
  page?.addEventListener('visibilitychange', onChange);
  return () => page?.removeEventListener('visibilitychange', onChange);
}

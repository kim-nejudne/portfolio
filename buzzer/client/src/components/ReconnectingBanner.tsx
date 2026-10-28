import { useRoomStore } from '../lib/roomStore.js';

/**
 * The Screen's "Reconnecting…" banner (F41): across the top once its own socket has been down for
 * `OFFLINE_AFTER_MS`, gone on the next connect or ack. The last snapshot stays underneath. A TV has
 * no one close enough to read a dot, so it gets a banner instead.
 */
export function ReconnectingBanner() {
  const offline = useRoomStore((state) => state.connection) === 'offline';
  if (!offline) return null;
  return (
    <p
      role="status"
      className="fixed inset-x-0 top-0 z-40 bg-warn py-[1.6vh] text-center font-display text-[3.2vw] text-accent-ink shadow-lg"
    >
      Reconnecting…
    </p>
  );
}

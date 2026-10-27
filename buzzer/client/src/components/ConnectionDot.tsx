import { useRoomStore, type Connection } from '../lib/roomStore.js';

const DOT: Record<Connection, { color: string; label: string }> = {
  connected: { color: 'bg-win', label: 'Connected' },
  connecting: { color: 'bg-warn', label: 'Reconnecting…' },
  offline: { color: 'bg-buzz', label: 'Offline' },
};

/**
 * The small green / amber / red dot for the page's socket (UI spec, Player view). The ring keeps
 * it visible on any player colour. The label is for screen readers and the hover title.
 */
export function ConnectionDot() {
  const connection = useRoomStore((state) => state.connection);
  const { color, label } = DOT[connection];
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      data-connection={connection}
      className={`inline-block size-3 shrink-0 rounded-full ring-2 ring-bg ${color}`}
    />
  );
}

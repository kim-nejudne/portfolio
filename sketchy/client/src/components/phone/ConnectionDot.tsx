import type { Connection } from '../../lib/connection.js';
import type { CopyKey, Translate } from '../../lib/copy.js';

const DOT: Record<Connection, { color: string; label: CopyKey }> = {
  connected: { color: 'bg-[#2DC653]', label: 'connected' },
  connecting: { color: 'bg-[#FFD166]', label: 'reconnecting' },
  offline: { color: 'bg-[#EF476F]', label: 'offline' },
};

/**
 * The phone's green / amber / red dot (Guesser phone), ported from Buzzr
 * (buzzer/client/src/components/ConnectionDot.tsx). It sits in the top-right corner, inside the
 * views' own padding, so it covers nothing; the ring keeps it visible on any background. Not a live
 * region: the "Reconnecting…" pill already announces an outage.
 */
export function ConnectionDot({ connection, t }: { connection: Connection; t: Translate }) {
  const { color, label } = DOT[connection];
  return (
    <span
      role="img"
      aria-label={t(label)}
      title={t(label)}
      data-connection={connection}
      className={`pointer-events-none absolute top-[calc(env(safe-area-inset-top)+4px)] right-[calc(env(safe-area-inset-right)+4px)] z-[45] size-2 rounded-full ring-2 ring-[#1D1B22] ${color}`}
    />
  );
}

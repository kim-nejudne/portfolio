import type { Connection } from '../../lib/connection.js';
import type { CopyKey, Translate } from '../../lib/copy.js';

const DOT: Record<Connection, { color: string; label: CopyKey }> = {
  connected: { color: 'bg-success ring-ink', label: 'connected' },
  connecting: { color: 'bg-amber ring-ink', label: 'reconnecting' },
  // Hollow, so it differs from the green dot by shape too (the two have about the same lightness).
  offline: { color: 'bg-paper ring-red', label: 'offline' },
};

/**
 * The phone's green / amber / red dot (Guesser phone), ported from Buzzr
 * (buzzer/client/src/components/ConnectionDot.tsx). It sits in the top-right corner, inside the
 * views' own padding, so it covers nothing; the `ink` ring keeps green and amber visible on paper. The lights are the
 * sketchbook's own green and amber tokens, and offline is a hollow red-pen ring (DECISIONS 90). Not a live
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
      className={`pointer-events-none absolute top-[calc(env(safe-area-inset-top)+4px)] right-[calc(env(safe-area-inset-right)+4px)] z-[45] size-2 rounded-full ring-2 ${color}`}
    />
  );
}

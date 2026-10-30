import { useCopy } from '../lib/copy.js';
import { useRoomStore } from '../lib/roomStore.js';

/**
 * The Screen's "Reconnecting…" banner (F41): a strip under the header once its own socket has been
 * down for `OFFLINE_AFTER_MS`, gone on the next connect or ack. The last snapshot stays below it,
 * and the header's join address stays readable above it (SCR-16). A TV has no one close enough to
 * read a dot, so it gets a banner instead.
 */
export function ReconnectingBanner() {
  const offline = useRoomStore((state) => state.connection) === 'offline';
  const t = useCopy();
  if (!offline) return null;
  return (
    <p
      role="status"
      className="shrink-0 bg-warn py-[1.6vh] text-center font-display text-[max(var(--screen-min-body),min(3.2vw,5.7vh))] text-accent-ink shadow-lg"
    >
      {t('reconnecting')}
    </p>
  );
}

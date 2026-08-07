import { useState } from 'react';
import { useQueue } from '../lib/useQueue';
import { setOnline, isOnline } from '../lib/api/queue';
import { SyncSheet } from './SyncSheet';

export function SyncIndicator() {
  const { pending, online } = useQueue();
  const [open, setOpen] = useState(false);

  let label: string;
  let dotColor: string;
  if (!online) {
    label = 'OFFLINE';
    dotColor = 'var(--color-utang)';
  } else if (pending.length > 0) {
    label = `${pending.length} PENDING`;
    dotColor = 'var(--color-ink)';
  } else {
    label = 'SYNCED';
    dotColor = 'var(--color-bayad)';
  }

  return (
    <>
      <button
        type="button"
        className="flex flex-col items-center justify-center text-[11px] mono uppercase text-ink"
        style={{ minHeight: 'var(--tap-min)' }}
        onClick={() => setOpen(true)}
        aria-live="polite"
        aria-label={`Sync status: ${label}. Tap to view details.`}
        data-testid="sync-indicator"
      >
        <span
          aria-hidden
          className={pending.length > 0 && online ? 'anim-pending' : ''}
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 8,
            background: dotColor,
            marginBottom: 4,
          }}
        />
        <span>{label}</span>
      </button>
      {open && (
        <SyncSheet
          onClose={() => setOpen(false)}
          onToggleOnline={() => setOnline(!isOnline())}
        />
      )}
    </>
  );
}

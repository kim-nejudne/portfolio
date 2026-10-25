// "Reload for the new version" (§9 Offline), in the header while a new version waits. The button
// is the only way the page reloads for an update; it is in the Tab order like the header's link.
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { startUpdates } from './service-worker';

export function UpdatePrompt() {
  const updates = startUpdates();
  const waiting = useSyncExternalStore(
    updates.subscribe,
    () => updates.waiting,
    () => false,
  );
  if (!waiting) return null;
  return (
    <span className="flex items-center gap-2 text-foreground">
      <span role="status" aria-label="update">
        Reload for the new version
      </span>
      <Button
        size="xs"
        variant="outline"
        onClick={() => {
          updates.reload();
        }}
      >
        Reload
      </Button>
    </span>
  );
}

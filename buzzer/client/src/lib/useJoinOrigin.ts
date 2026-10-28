import { useEffect, useState } from 'react';
import { fetchConfig } from './api.js';

/**
 * The server's `joinOrigin` from `GET /api/config` (F42): undefined while it loads, then the origin
 * or null. A failed request counts as null, so the Screen falls back to its own origin.
 */
export function useJoinOrigin(): string | null | undefined {
  const [joinOrigin, setJoinOrigin] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void fetchConfig().then((config) => {
      if (!cancelled) setJoinOrigin(config?.joinOrigin ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return joinOrigin;
}

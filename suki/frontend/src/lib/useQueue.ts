// Subscribes a component to the queue snapshot.
import { useEffect, useState } from 'react';
import { subscribe } from './api/queue';
import type { QueueSnapshot } from '@suki/domain';

export function useQueue(): QueueSnapshot {
  const [snap, setSnap] = useState<QueueSnapshot>({ pending: [], online: true });
  useEffect(() => subscribe(setSnap), []);
  return snap;
}

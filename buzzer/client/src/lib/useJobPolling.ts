import { useEffect, useRef } from 'react';
import type { GenerateJob } from '../../../shared/types.js';
import { loadJob } from './adminCategories.js';
import { ended } from './generationJob.js';

/** How often a running job is asked for its progress (F111). */
export const JOB_POLL_MS = 2000;

/**
 * Follows a generation every 2 s while `jobId` is set (F111, F120): `onUpdate` with each read
 * while it runs, then `onEnded` once when it is done, failed or cancelled. A missed poll (a blip,
 * a restart) is tried again; a 401 has already signed out. The callbacks need not be stable.
 */
export function useJobPolling(
  jobId: string | null,
  onUpdate: (job: GenerateJob) => void,
  onEnded: (job: GenerateJob) => void,
): void {
  const callbacks = useRef({ onUpdate, onEnded });
  useEffect(() => {
    callbacks.current = { onUpdate, onEnded };
  });

  useEffect(() => {
    if (jobId === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const poll = () => {
      timer = setTimeout(() => {
        loadJob(jobId).then(
          (next) => {
            if (stopped) return;
            if (ended(next)) {
              callbacks.current.onEnded(next);
            } else {
              callbacks.current.onUpdate(next);
              poll();
            }
          },
          () => {
            if (!stopped) poll();
          },
        );
      }, JOB_POLL_MS);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId]);
}

import { useEffect, useState } from 'react';
import { serverNow } from './roomStore.js';

/** The server's clock, re-read every `everyMs` so a timer drawn from `endsAt` stays current. */
export function useServerNow(everyMs = 250): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

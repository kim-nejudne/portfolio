// Consistent async data hook. No spinner-blocking; components render a
// hairline placeholder until the first value arrives.
import { useEffect, useState } from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; loaded: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fn().then((v) => {
      if (cancelled) return;
      setData(v);
      setLoaded(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loaded };
}

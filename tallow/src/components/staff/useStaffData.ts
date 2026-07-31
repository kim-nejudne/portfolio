import { useCallback, useEffect, useState } from 'react';
import { CoverSummary, Reservation } from '../../types';
import { adminFetch } from '../../lib/session';

interface UseStaffDataArgs {
  authenticated: boolean;
  selectedDate: string;
  onError: (err: unknown, fallback: string) => void;
}

/**
 * Owns the service-day data behind the console: the cover summary and the
 * reservation book for the selected date.
 */
export function useStaffData({ authenticated, selectedDate, onError }: UseStaffDataArgs) {
  const [summary, setSummary] = useState<CoverSummary | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/reservations?date=${selectedDate}`);
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
      if (data.reservations) setReservations(data.reservations);
    } catch (err) {
      onError(err, 'Failed to load staff data.');
    } finally {
      setLoading(false);
    }
  }, [authenticated, selectedDate, onError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, reservations, loading, refresh };
}

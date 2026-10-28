import { useCallback, useEffect, useState } from 'react';

/** How long a toast stays up. */
export const TOAST_MS = 3000;

interface ToastMessage {
  text: string;
  /** Counts up per toast, so the same text shown twice restarts the timer. */
  id: number;
}

/** A brief message that hides itself after `TOAST_MS`. `show` replaces any toast still showing. */
export function useToast(): { toast: ToastMessage | null; show: (text: string) => void } {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const show = useCallback(
    (text: string) => setToast((current) => ({ text, id: (current?.id ?? 0) + 1 })),
    [],
  );
  return { toast, show };
}

/** Pinned to the bottom of the viewport, above the page. */
export function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null;
  return (
    <p
      key={toast.id}
      role="alert"
      className="fixed inset-x-4 bottom-6 mx-auto max-w-md rounded-2xl border-2 border-buzz bg-surface px-4 py-3 text-center text-lg shadow-lg"
    >
      {toast.text}
    </p>
  );
}

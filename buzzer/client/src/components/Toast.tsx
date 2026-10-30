import { useCallback, useEffect, useState } from 'react';

/** How long a toast stays up. */
export const TOAST_MS = 3000;

/** An error or refusal (the default), or a confirmation that something was done. */
export type ToastTone = 'error' | 'done';

interface ToastMessage {
  text: string;
  tone: ToastTone;
  /** Counts up per toast, so the same text shown twice restarts the timer. */
  id: number;
}

/** A brief message that hides itself after `TOAST_MS`. `show` replaces any toast still showing. */
export function useToast(): {
  toast: ToastMessage | null;
  show: (text: string, tone?: ToastTone) => void;
} {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const show = useCallback(
    (text: string, tone: ToastTone = 'error') =>
      setToast((current) => ({ text, tone, id: (current?.id ?? 0) + 1 })),
    [],
  );
  return { toast, show };
}

/** Pinned to the bottom of the viewport, above the page. A confirmation is green and polite. */
export function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null;
  const done = toast.tone === 'done';
  return (
    <p
      key={toast.id}
      role={done ? 'status' : 'alert'}
      className={`fixed inset-x-4 bottom-6 z-40 mx-auto max-w-md rounded-2xl border-2 bg-surface px-4 py-3 text-center text-lg shadow-lg ${done ? 'border-win' : 'border-buzz'}`}
    >
      {toast.text}
    </p>
  );
}

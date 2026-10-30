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

/**
 * Where a toast sits and how big it is: pinned to the bottom of a phone-sized page, or on the
 * Screen above the host bar, readable from the couch (SCR-14). The Screen variant is placed in the
 * box that sets `--bar-reserve`.
 */
const VARIANTS = {
  page: 'fixed inset-x-4 bottom-6 max-w-md rounded-2xl px-4 py-3 text-lg',
  screen:
    'absolute inset-x-0 bottom-[calc(var(--bar-reserve,0px)+2vh)] w-fit max-w-[min(60vw,900px)] rounded-[0.8em] px-[1em] py-[0.6em] text-[max(18px,min(1.6vw,2.8vh))]',
};

/** A brief message above the page. A confirmation is green and polite. */
export function Toast({
  toast,
  variant = 'page',
}: {
  toast: ToastMessage | null;
  variant?: keyof typeof VARIANTS;
}) {
  if (!toast) return null;
  const done = toast.tone === 'done';
  return (
    <p
      key={toast.id}
      role={done ? 'status' : 'alert'}
      className={`z-40 mx-auto border-2 bg-surface text-center shadow-lg ${VARIANTS[variant]} ${done ? 'border-win' : 'border-buzz'}`}
    >
      {toast.text}
    </p>
  );
}

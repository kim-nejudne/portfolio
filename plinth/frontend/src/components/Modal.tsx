import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id of the heading inside the panel */
  labelledBy: string;
  testId: string;
  children: ReactNode;
}

/**
 * Native <dialog> in the top layer: focus trap, Esc, focus restore and
 * inertness come from the platform. Entrance/exit is CSS only
 * (@starting-style + allow-discrete) so it never runs under reduced motion.
 */
export default function Modal({
  open,
  onClose,
  labelledBy,
  testId,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      data-testid={testId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="modal-shell fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-center justify-center border-none bg-transparent p-4 text-ink open:flex md:p-8"
    >
      <div className="modal-panel relative max-h-full w-full max-w-2xl overflow-y-auto border border-ink bg-bone p-6 md:p-10">
        <button
          type="button"
          onClick={onClose}
          data-testid={`${testId}-close`}
          className="absolute right-4 top-4 border border-ink px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-ink hover:text-bone md:right-6 md:top-6"
        >
          Close
        </button>
        {children}
      </div>
    </dialog>
  );
}

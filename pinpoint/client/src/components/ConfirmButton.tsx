import { useState } from 'react';

/**
 * A button for an action that can't be taken back (copied from Buzzr): the first press arms it and
 * shows Cancel beside it, with focus on the armed button; only the second press acts. No browser dialog.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  ariaLabel,
  onConfirm,
  disabled,
  className,
  cancelClassName = className,
  reviewKey,
}: {
  label: string;
  /** The armed button's text, for example "Confirm remove". */
  confirmLabel: string;
  /** The accessible name, when `label` alone is ambiguous (one per card). */
  ariaLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  className: string;
  cancelClassName?: string;
  /** `data-review-key` on the unarmed button, for a key shortcut to press. */
  reviewKey?: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        data-review-key={reviewKey}
        aria-label={ariaLabel}
        onClick={() => setArmed(true)}
        disabled={disabled}
        className={className}
      >
        {label}
      </button>
    );
  }
  return (
    <span className="flex flex-wrap gap-2">
      <button
        type="button"
        // The button pressed is gone, so focus moves to the one that acts.
        autoFocus
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        disabled={disabled}
        className={className}
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setArmed(false)} className={cancelClassName}>
        Cancel
      </button>
    </span>
  );
}

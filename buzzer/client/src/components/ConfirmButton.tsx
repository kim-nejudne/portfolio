import { useState } from 'react';

interface ConfirmButtonProps {
  label: string;
  /** The armed button's text, for example "Confirm kick". */
  confirmLabel: string;
  /** The accessible name, when `label` alone is ambiguous (several Kick buttons in a list). */
  ariaLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  className: string;
}

/**
 * A button for an action that can't be taken back, such as kicking a player or ending the game.
 * The first tap arms it and shows Cancel beside it; only the second tap acts. No browser dialog.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  ariaLabel,
  onConfirm,
  disabled,
  className,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
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
    <span className="flex gap-2">
      <button
        type="button"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        disabled={disabled}
        className={`${className} border-red-400 text-red-400`}
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setArmed(false)} className={className}>
        Cancel
      </button>
    </span>
  );
}

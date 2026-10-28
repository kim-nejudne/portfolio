import { useState, type ReactNode } from 'react';

interface ConfirmButtonProps {
  label: string;
  /** The armed button's text, for example "Confirm kick". */
  confirmLabel: string;
  /** The accessible name, when `label` alone is ambiguous (several Kick buttons in a list). */
  ariaLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  className: string;
  /** Shown before `label` on the unarmed button, such as an icon. */
  icon?: ReactNode;
  /** The box round the armed Confirm and Cancel pair. */
  armedClassName?: string;
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
  icon,
  armedClassName = 'flex gap-2',
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
        {icon}
        {label}
      </button>
    );
  }
  return (
    <span className={armedClassName}>
      <button
        type="button"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        disabled={disabled}
        // `!` keeps the danger red under the hover style's ink border.
        className={`${className} border-buzz text-buzz not-disabled:hover:border-buzz!`}
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setArmed(false)} className={className}>
        Cancel
      </button>
    </span>
  );
}

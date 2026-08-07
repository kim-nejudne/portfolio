import React from 'react';

export interface RadioGridOption<T extends string | number> {
  value: T;
  /**
   * The full spoken name for this choice — "19:30, 12 covers open", not "19:30".
   * The visual cell can be terse because the surrounding grid gives it context;
   * an option read out on its own cannot.
   */
  label: string;
  /** Rendered inside the cell. */
  content: React.ReactNode;
  disabled?: boolean;
}

interface RadioGridProps<T extends string | number> {
  /** Spoken name for the group as a whole. */
  legend: string;
  /** Radio group name; must be unique on the page. */
  name: string;
  value: T | null;
  options: RadioGridOption<T>[];
  onChange: (value: T) => void;
  gridClassName: string;
  cellClassName: (state: { checked: boolean; disabled: boolean }) => string;
}

/**
 * A grid of mutually exclusive choices built on real radio inputs.
 *
 * The scaffold drew these as <button> grids, which look identical and behave
 * nothing alike: no group name, no checked state, no arrow-key traversal, and
 * nothing telling a screen reader the choices are exclusive. The inputs are
 * visually hidden rather than replaced, so all of that comes from the platform
 * and the printed styling still sits on the label.
 *
 * Unavailable options are aria-disabled rather than disabled: a sitting that is
 * fully committed is information a guest wants, and a truly disabled input is
 * skipped silently by the keyboard and never read at all.
 */
export function RadioGrid<T extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
  gridClassName,
  cellClassName,
}: RadioGridProps<T>) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className={gridClassName}>
        {options.map((option) => {
          const disabled = Boolean(option.disabled);
          const checked = value === option.value;

          return (
            <label
              key={option.value}
              className={`${cellClassName({ checked, disabled })} ${
                disabled ? 'cursor-not-allowed' : 'cursor-pointer'
              } has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#7A2322]`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                aria-disabled={disabled || undefined}
                onChange={() => {
                  if (disabled) return;
                  onChange(option.value);
                }}
                className="sr-only"
              />
              <span className="sr-only">{option.label}</span>
              <span aria-hidden="true">{option.content}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

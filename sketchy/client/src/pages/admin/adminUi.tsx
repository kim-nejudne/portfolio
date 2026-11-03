// The admin's shared pieces (F80, F81): the taped card, labelled fields and the error line, in the
// sketchbook look. Lazy-loaded with `/admin` only.

import { useId, type ComponentProps, type ReactNode } from 'react';
import { Tape } from '../../components/sketch/Tape.js';

export const INPUT =
  'sketch-border min-h-12 w-full min-w-0 bg-paper px-4 text-[22px] text-ink outline-none placeholder:text-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen';
export const LINK_BUTTON =
  'min-h-11 self-start text-lg text-pen underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen';

export const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** A refusal under a form, in `ink` after a red-pen ✗, as on the landing page. */
export function ErrorLine({ id, text }: { id: string; text: string | null }) {
  return (
    <p id={id} role="alert" className="text-lg leading-snug text-ink">
      {text && (
        <>
          <span aria-hidden className="text-red">
            ✗{' '}
          </span>
          {text}
        </>
      )}
    </p>
  );
}

/** A taped paper card, like the landing page's. */
export function Card({ children, labelledBy }: { children: ReactNode; labelledBy?: string }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="relative grid gap-3 rounded-[3px] border-[2.5px] border-ink bg-paper px-5 pt-6 pb-5 shadow-[4px_5px_0_var(--color-ink)]"
    >
      <Tape place="top" />
      {children}
    </section>
  );
}

/**
 * A labelled input. `errorId` names the form's error line, read with the field; `error` marks it
 * invalid.
 */
export function Field({
  label,
  hint,
  errorId,
  error = false,
  ...input
}: {
  label: string;
  hint?: string;
  errorId?: string;
  error?: boolean;
} & ComponentProps<'input'>) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : '', errorId ?? ''].filter(Boolean).join(' ');
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[22px] leading-tight">
        {label}
      </label>
      <input
        id={id}
        className={INPUT}
        aria-describedby={describedBy || undefined}
        aria-invalid={error || undefined}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-base leading-snug text-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

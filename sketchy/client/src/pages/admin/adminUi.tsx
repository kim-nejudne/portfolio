// The admin's shared pieces (F80, F81): the taped card, labelled fields and the error line, in the
// sketchbook look, and the request hook, level picker and alternates parser the category editor
// and word generation (F83) share. Lazy-loaded with `/admin` only.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react';
import type { WordLevel } from '../../../../shared/types.js';
import { Tape } from '../../components/sketch/Tape.js';
import { AdminApiError } from './adminApi.js';

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

export const LEVELS: readonly { value: WordLevel; label: string }[] = [
  { value: 1, label: 'Easy' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Hard' },
];

/** The alternates field: comma separated, trimmed, empties dropped. The server checks the rest. */
export function parseAlts(text: string): string[] {
  return text
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a !== '');
}

/** Called when a call comes back 401: the session ended, so `/admin` shows the sign-in again. */
export const SessionEnded = createContext<() => void>(() => undefined);

export interface Refusal {
  text: string;
  field?: string;
  /** An import's problems with the file, one line each. */
  issues?: readonly string[];
}

/**
 * One form's request: busy while it runs, the refusal (and the field it names) after. A 401 hands
 * back to the sign-in instead.
 */
export function useAction() {
  const sessionEnded = useContext(SessionEnded);
  // In a ref, so `run` stays the same function for the form's life and effects that use it don't
  // run again when the page above re-renders.
  const ended = useRef(sessionEnded);
  useEffect(() => {
    ended.current = sessionEnded;
  }, [sessionEnded]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Refusal | null>(null);
  const run = useCallback(
    <T,>(request: () => Promise<T>, done: (result: T) => void, failed?: () => void) => {
      setBusy(true);
      setError(null);
      request()
        .then((result) => {
          setBusy(false);
          done(result);
        })
        .catch((err: unknown) => {
          setBusy(false);
          failed?.();
          if (err instanceof AdminApiError && err.status === 401) return ended.current();
          setError({
            text: err instanceof Error ? err.message : String(err),
            field: err instanceof AdminApiError ? err.field : undefined,
            issues: err instanceof AdminApiError ? err.issues : undefined,
          });
        });
    },
    [],
  );
  return { busy, error, run, clear: () => setError(null) };
}

/** After a refusal, focus the field it names (marked `aria-invalid`), so the fix starts there. */
export function useFocusInvalid(form: RefObject<HTMLFormElement | null>, error: Refusal | null) {
  useEffect(() => {
    if (error) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [form, error]);
}

/**
 * A submit that can't be used right now stays focusable (`aria-disabled`, not `disabled`), so
 * focus isn't dropped to the page when it goes dead after a save; its handler ignores it.
 */
export const dead = (isDead: boolean) => ({ 'aria-disabled': isDead || undefined });
export const DEAD = 'aria-disabled:opacity-50';

export const CHECKBOX =
  'mt-1 size-6 shrink-0 accent-pen focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen';

export function LevelSelect({
  value,
  onChange,
  label = 'Level',
  errorId,
  error = false,
}: {
  value: WordLevel;
  onChange: (level: WordLevel) => void;
  label?: string;
  errorId?: string;
  error?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[22px] leading-tight">
        {label}
      </label>
      <select
        id={id}
        className={INPUT}
        value={value}
        aria-describedby={errorId}
        aria-invalid={error || undefined}
        onChange={(event) => onChange(Number(event.target.value) as WordLevel)}
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

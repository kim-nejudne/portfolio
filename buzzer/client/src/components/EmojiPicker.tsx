import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { parseOtherEmoji, QUIZ_EMOJI } from '../lib/categoryEmoji.js';
import { HOVER } from '../lib/hover.js';
import { BUTTON_SMALL, CARD, FIELD } from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const CELL = `flex size-11 items-center justify-center rounded-xl border-2 border-transparent text-2xl transition not-disabled:active:scale-95 disabled:opacity-40 aria-pressed:border-accent ${HOVER}`;

interface EmojiPickerProps {
  /** The category's name, for the button's accessible name. */
  name: string;
  emoji: string | null;
  /** Saves the pick; rejects with the message to show. */
  onSave: (emoji: string) => Promise<unknown>;
}

/**
 * A category's emoji on its page (F130): a 44×44 button showing it, or a dashed "+" when it has
 * none. It opens a popover with a grid of quiz emoji and an "Other" field for any single emoji. A
 * pick saves at once. Esc and a press outside close it, and focus returns to the button, unless the
 * press outside went to another control. Neither closes it while a save is on its way. A failed
 * save shows its message in the popover, and the old emoji stays.
 */
export function EmojiPicker({ name, emoji, onSave }: EmojiPickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [otherError, setOtherError] = useState<string | null>(null);
  // The emoji just saved, shown until the page reads the category again.
  const [saved, setSaved] = useState<{ from: string | null; value: string } | null>(null);
  const shown = saved && saved.from === emoji ? saved.value : emoji;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Read by the document listener, which is bound once per opening.
  const savingRef = useRef(false);

  function close(refocus: boolean) {
    setOpen(false);
    setError(null);
    setOther('');
    setOtherError(null);
    if (refocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (savingRef.current || wrapperRef.current?.contains(event.target as Node)) return;
      close(false);
      // After the press has moved focus: back to the button, unless it went to another control.
      setTimeout(() => {
        const at = document.activeElement;
        if (at === null || at === document.body) buttonRef.current?.focus();
      }, 0);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // On opening, focus the current emoji in the grid, or the first.
  useEffect(() => {
    if (!open) return;
    const grid = gridRef.current;
    const current = grid?.querySelector<HTMLElement>('[aria-pressed="true"]');
    (current ?? grid?.querySelector<HTMLElement>('button'))?.focus();
  }, [open]);

  function save(next: string) {
    if (next === shown) {
      close(true);
      return;
    }
    setSaving(true);
    savingRef.current = true;
    setError(null);
    onSave(next).then(
      () => {
        setSaving(false);
        savingRef.current = false;
        setSaved({ from: emoji, value: next });
        close(true);
      },
      (err: unknown) => {
        setSaving(false);
        savingRef.current = false;
        setError(message(err));
      },
    );
  }

  function saveOther(event: FormEvent) {
    event.preventDefault();
    const parsed = parseOtherEmoji(other);
    if ('error' in parsed) {
      setOtherError(parsed.error);
      return;
    }
    setOtherError(null);
    save(parsed.emoji);
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' || !open || saving) return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  }

  return (
    <div ref={wrapperRef} className="relative shrink-0" onKeyDown={onKey}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Change emoji for ${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        className={`flex size-11 items-center justify-center rounded-xl border-2 transition active:scale-95 ${HOVER} ${
          shown
            ? 'border-edge bg-surface text-2xl'
            : 'border-dashed border-muted text-2xl text-muted'
        }`}
      >
        <span aria-hidden>{shown ?? '+'}</span>
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={`Emoji for ${name}`}
          className={`${CARD} absolute top-full left-0 z-20 mt-2 flex w-max max-w-[calc(100vw-2rem)] flex-col gap-3 p-4 shadow-lg`}
        >
          <div
            ref={gridRef}
            role="group"
            aria-label="Emoji"
            className="grid grid-cols-6 gap-1 sm:grid-cols-8"
          >
            {QUIZ_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={e === shown}
                disabled={saving}
                onClick={() => save(e)}
                className={CELL}
              >
                {e}
              </button>
            ))}
          </div>
          <form onSubmit={saveOther} className="flex flex-col gap-1" noValidate>
            <label htmlFor={`${id}-other`} className="text-sm font-bold text-muted">
              Other
            </label>
            <div className="flex gap-2">
              <input
                id={`${id}-other`}
                value={other}
                onChange={(event) => {
                  setOther(event.target.value);
                  setOtherError(null);
                }}
                aria-invalid={otherError !== null}
                aria-describedby={otherError ? `${id}-other-error` : undefined}
                autoComplete="off"
                spellCheck={false}
                placeholder="Any emoji"
                disabled={saving}
                className={`${FIELD} w-36 flex-1 placeholder:text-muted`}
              />
              <button type="submit" disabled={saving} className={BUTTON_SMALL}>
                Save
              </button>
            </div>
            {otherError && (
              <p id={`${id}-other-error`} className="text-buzz">
                {otherError}
              </p>
            )}
          </form>
          {saving && <p className="text-muted">Saving…</p>}
          {error && (
            <p role="alert" className="text-buzz">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

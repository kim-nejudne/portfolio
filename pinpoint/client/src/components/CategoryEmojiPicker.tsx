import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CATEGORY_EMOJI, parseOtherEmoji } from '../lib/adminCategory.js';
import { BUTTON_SECONDARY, INPUT, message } from '../lib/adminUi.js';

const HOVER = '[@media(hover:hover)]:hover:bg-board-bg';
const CELL = `flex size-12 items-center justify-center rounded-button border-2 border-transparent text-2xl active:scale-95 disabled:opacity-40 aria-pressed:border-amber ${HOVER}`;

interface Props {
  /** The category's name, for the accessible names. */
  name: string;
  emoji: string | null;
  /** Saves the pick (null removes it); rejects with the message to show. */
  onSave: (emoji: string | null) => Promise<unknown>;
}

/**
 * The emoji before a category's name (spec: Category page, after Buzzr's `EmojiPicker`): a 48 px
 * button showing it, or a dashed "+" without one. It opens a popover with a grid and an "Other"
 * field for any single emoji; a pick saves at once. Esc and a press outside close it (not while
 * saving), and a failed save shows its message there, keeping the old emoji.
 */
export function CategoryEmojiPicker({ name, emoji, onSave }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [otherError, setOtherError] = useState<string | null>(null);
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

  function save(next: string | null) {
    if (next === emoji) return close(true);
    setSaving(true);
    savingRef.current = true;
    setError(null);
    onSave(next).then(
      () => {
        setSaving(false);
        savingRef.current = false;
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
    if ('error' in parsed) return setOtherError(parsed.error);
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
        className={`flex size-12 items-center justify-center rounded-button border-2 text-2xl active:scale-95 ${HOVER} ${
          emoji ? 'border-line bg-board-panel' : 'border-dashed border-text-dim text-text-dim'
        }`}
      >
        <span aria-hidden>{emoji ?? '+'}</span>
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={`Emoji for ${name}`}
          className="absolute top-full left-0 z-20 mt-2 flex w-max max-w-[calc(100vw-1rem)] flex-col gap-3 rounded-card border border-line bg-board-panel p-3"
        >
          <div ref={gridRef} role="group" aria-label="Emoji" className="grid grid-cols-6 gap-1">
            {CATEGORY_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={e === emoji}
                disabled={saving}
                onClick={() => save(e)}
                className={CELL}
              >
                {e}
              </button>
            ))}
          </div>
          <form onSubmit={saveOther} className="flex flex-col gap-1" noValidate>
            <label htmlFor={`${id}-other`} className="font-semibold text-text-dim">
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
                className={`${INPUT} w-36 flex-1`}
              />
              <button type="submit" disabled={saving} className={BUTTON_SECONDARY}>
                Save
              </button>
            </div>
            {otherError && (
              <p id={`${id}-other-error`} className="text-delayed">
                {otherError}
              </p>
            )}
          </form>
          {emoji && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save(null)}
              className={`${BUTTON_SECONDARY} self-start`}
            >
              Remove emoji
            </button>
          )}
          {saving && <p className="text-text-dim">Saving…</p>}
          {error && (
            <p role="alert" className="text-delayed">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Phase, QuestionSet } from '../../../shared/types.js';
import { NewGameTakenError } from '../lib/api.js';
import { checkPlayable, hostNextSet, SetImagesError, uploadSetImages } from '../lib/hostRoom.js';
import { setDetail } from '../lib/setLabels.js';
import { BUTTON_PRIMARY } from '../lib/ui.js';
import { SetBrowser } from './SetBrowser.js';

type Status =
  | { kind: 'loading' }
  | { kind: 'failed' }
  // `sets` lists this browser's sets, then the built-ins from index `firstBuiltIn` on.
  | { kind: 'picking'; sets: QuestionSet[]; firstBuiltIn: number; starting: boolean };

interface NewGamePickerProps {
  code: string;
  hostToken: string;
  /** The room's phase: the picker closes itself when another device starts the next game first. */
  phase: Phase;
  onClose: () => void;
  /** Shows a message after the picker has closed, such as the 409's (the Screen's or remote's toast). */
  onNotice: (text: string) => void;
  /** The dialog's box, for sizing per device. */
  className?: string;
}

/**
 * **New game** after the final results (DECISIONS F49–F50): pick one of this browser's saved sets
 * or a built-in one (DECISIONS F54),
 * choose whether scores carry over, then the room returns to the lobby with the new set. It stays
 * open while the images upload, so the parent keeps it mounted across the switch to LOBBY.
 */
export function NewGamePicker({
  code,
  hostToken,
  phase,
  onClose,
  onNotice,
  className = '',
}: NewGamePickerProps) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keepScores, setKeepScores] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once this device has sent a set, the room leaving FINAL is its own doing, not a reason to close.
  const [submitted, setSubmitted] = useState(false);
  // The set already in the room after an image upload failed: a retry uploads only its images.
  const [uploadPending, setUploadPending] = useState<QuestionSet | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    // Dexie loads only once a host opens the picker. A paired phone has the built-ins too.
    import('../lib/db.js')
      .then(({ listHostableSets }) => listHostableSets())
      .then(
        ({ mine, builtIn }) => {
          if (!live) return;
          const sets = [...mine, ...builtIn];
          setSelectedId(sets[0]?.id ?? null);
          setStatus({ kind: 'picking', sets, firstBuiltIn: mine.length, starting: false });
        },
        () => live && setStatus({ kind: 'failed' }),
      );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => headingRef.current?.focus(), []);

  const starting = status.kind === 'picking' && status.starting;

  useEffect(() => {
    if (phase !== 'FINAL' && !submitted) onClose();
  }, [phase, submitted, onClose]);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    // Esc belongs to the dialog, so nothing behind it acts on the press.
    event.stopImmediatePropagation();
    if (!starting) onClose();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener, { capture: true });
    return () => window.removeEventListener('keydown', listener, { capture: true });
  }, []);

  async function start(picking: Extract<Status, { kind: 'picking' }>) {
    const { sets } = picking;
    const set = uploadPending ?? sets.find((s) => s.id === selectedId);
    if (!set) return;
    setStatus({ ...picking, starting: true });
    setSubmitted(true);
    setError(null);
    try {
      if (uploadPending) await uploadSetImages(code, hostToken, set);
      else await hostNextSet(code, hostToken, set, keepScores);
      onClose();
    } catch (caught) {
      if (caught instanceof NewGameTakenError) {
        onNotice(caught.message);
        return onClose();
      }
      if (caught instanceof SetImagesError) {
        setUploadPending(set);
        setError(`${caught.message} The new game is set up; retry to send its images.`);
      } else {
        setError((caught as Error).message);
      }
      setStatus({ ...picking, starting: false });
    }
  }

  const locked = starting || uploadPending !== null;

  // On body: the Screen's stage is a positioned box, which would confine a fixed child.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/85 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-game-heading"
        className={`flex max-h-full w-full max-w-md flex-col gap-4 rounded-[20px] border-2 border-edge bg-surface p-6 text-lg ${className}`}
      >
        <h2
          id="new-game-heading"
          ref={headingRef}
          tabIndex={-1}
          className="shrink-0 font-display text-3xl outline-none"
        >
          New game
        </h2>
        {status.kind === 'loading' && <p className="text-muted">Loading your sets…</p>}
        {status.kind === 'failed' && (
          <p role="alert" className="text-buzz">
            Could not load the saved sets in this browser.
          </p>
        )}
        {status.kind === 'picking' && (
          <SetBrowser
            mode="select"
            id="new-game"
            legend="Question set"
            sets={status.sets}
            selectedId={selectedId}
            onSelect={setSelectedId}
            disabled={locked}
            detail={(set) =>
              // Drafts stay pickable, as on Host a game: choosing one says what to fix (DECISIONS F50).
              setDetail(set, status.sets.indexOf(set) >= status.firstBuiltIn, checkPlayable(set).ok)
            }
            // The scroller is a div: a fieldset won't shrink as a flex child, and its default
            // min-content width would push the rows past the dialog.
            listClassName="min-h-0 overflow-x-hidden overflow-y-auto [scrollbar-color:var(--color-edge)_transparent]"
            className="min-h-0"
          />
        )}
        <label className="flex shrink-0 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={keepScores}
            onChange={(event) => setKeepScores(event.target.checked)}
            disabled={locked}
            className="size-5 accent-accent"
          />
          Keep scores
        </label>
        <button
          type="button"
          onClick={() => status.kind === 'picking' && void start(status)}
          disabled={status.kind !== 'picking' || starting || selectedId === null}
          className={`${BUTTON_PRIMARY} shrink-0 text-2xl`}
        >
          {starting
            ? uploadPending
              ? 'Sending images…'
              : 'Starting new game…'
            : uploadPending
              ? 'Retry images'
              : 'Start new game'}
        </button>
        {error && (
          <p role="alert" className="text-center text-buzz">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={starting}
          className="shrink-0 text-muted underline underline-offset-4 hover:text-ink disabled:opacity-40"
        >
          Cancel
        </button>
      </section>
    </div>,
    document.body,
  );
}

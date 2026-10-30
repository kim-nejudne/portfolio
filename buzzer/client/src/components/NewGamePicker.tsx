import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Phase, QuestionSet } from '../../../shared/types.js';
import { NewGameTakenError } from '../lib/api.js';
import { loadBuiltInSets } from '../lib/builtInSets.js';
import { hostableRows } from '../lib/hostable.js';
import {
  checkPlayable,
  hostNextSet,
  imagesOf,
  SetImagesError,
  uploadSetImages,
} from '../lib/hostRoom.js';
import { setDetail } from '../lib/setLabels.js';
import { BuiltInSetsError } from './BuiltInSetsError.js';
import { GameBuilder, type BuiltGame } from './GameBuilder.js';
import { SetBrowser } from './SetBrowser.js';
import { SetPicker } from './SetPicker.js';
import { SetPreview } from './SetPreview.js';

type Status =
  | { kind: 'loading' }
  | { kind: 'failed' }
  // `builtIn` is null when the server's built-ins could not be fetched (DECISIONS F104).
  | {
      kind: 'picking';
      mine: QuestionSet[];
      builtIn: readonly QuestionSet[] | null;
      starting: boolean;
      retrying: boolean;
    };

interface NewGamePickerProps {
  code: string;
  hostToken: string;
  /** The room's phase: the picker closes itself when another device starts the next game first. */
  phase: Phase;
  onClose: () => void;
  /** Shows a message after the picker has closed, such as the 409's (the Screen's or remote's toast). */
  onNotice: (text: string) => void;
  /**
   * Offers **Preview** per set (DECISIONS F56). Only the Host remote passes it: a preview shows
   * answers, and the Screen is public.
   */
  preview?: boolean;
  /** Offers **Build a game** (DECISIONS F57). Only the Host remote passes it, as with `preview`. */
  builder?: boolean;
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
  preview = false,
  builder = false,
  className = '',
}: NewGamePickerProps) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  // The picked row's key (`hostableRows`): a My set and a built-in may share an id.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [keepScores, setKeepScores] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once this device has sent a set, the room leaving FINAL is its own doing, not a reason to close.
  const [submitted, setSubmitted] = useState(false);
  // The set already in the room after an image upload failed: a retry uploads only its images.
  const [uploadPending, setUploadPending] = useState<BuiltGame | null>(null);
  const [previewing, setPreviewing] = useState<QuestionSet | null>(null);
  const [building, setBuilding] = useState(false);
  // A built game is on its way to the room (the builder shows its own progress).
  const [sendingBuilt, setSendingBuilt] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    // Dexie loads only once a host opens the picker. A paired phone has the built-ins too.
    import('../lib/db.js')
      .then(({ listHostableSets }) => listHostableSets())
      .then(
        ({ mine, builtIn }) => {
          if (!live) return;
          const first = hostableRows(mine, builtIn);
          setSelectedKey(first.sets[0] ? first.keyOf(first.sets[0]) : null);
          setStatus({ kind: 'picking', mine, builtIn, starting: false, retrying: false });
        },
        () => live && setStatus({ kind: 'failed' }),
      );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => headingRef.current?.focus(), []);

  const picking = status.kind === 'picking' ? status : null;
  const mine = picking?.mine ?? null;
  const builtInSets = picking?.builtIn ?? null;
  const rows = useMemo(() => hostableRows(mine ?? [], builtInSets), [mine, builtInSets]);
  const selected = rows.sets.find((set) => rows.keyOf(set) === selectedKey);

  const starting = (status.kind === 'picking' && status.starting) || sendingBuilt;
  const locked = starting || uploadPending !== null;

  useEffect(() => {
    if (phase !== 'FINAL' && !submitted) onClose();
  }, [phase, submitted, onClose]);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    // An open preview takes Esc for itself.
    if (event.key !== 'Escape' || previewing) return;
    // Esc belongs to the dialog, so nothing behind it acts on the press.
    event.stopImmediatePropagation();
    if (!starting) onClose();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener, { capture: true });
    return () => window.removeEventListener('keydown', listener, { capture: true });
  }, []);

  /**
   * Sends `game` to the room. A 409 or a failed image upload is handled here; any other Error is
   * thrown for the caller to show.
   */
  async function send(game: BuiltGame) {
    setSubmitted(true);
    setError(null);
    try {
      if (uploadPending) await uploadSetImages(code, hostToken, game.set, game.loadImage);
      else await hostNextSet(code, hostToken, game.set, keepScores, game.loadImage);
      onClose();
    } catch (caught) {
      if (caught instanceof NewGameTakenError) {
        onNotice(caught.message);
        return onClose();
      }
      if (!(caught instanceof SetImagesError)) throw caught;
      setUploadPending(game);
      setBuilding(false);
      setError(`${caught.message} The new game is set up; retry to send its images.`);
    }
  }

  /** **Retry** after the built-ins failed to load: My sets stay listed meanwhile. */
  function retryBuiltIns() {
    const update = (retrying: boolean, builtIn?: readonly QuestionSet[]) =>
      setStatus((current) =>
        current.kind === 'picking'
          ? { ...current, retrying, builtIn: builtIn ?? current.builtIn }
          : current,
      );
    update(true);
    loadBuiltInSets().then(
      (builtIn) => {
        update(false, builtIn);
        // A browser with no sets of its own now has something picked, as on opening.
        setSelectedKey((key) => key ?? (builtIn[0] ? `built-in:${builtIn[0].id}` : null));
      },
      () => update(false),
    );
  }

  async function start(picking: Extract<Status, { kind: 'picking' }>) {
    const game = uploadPending ?? (selected && { set: selected, loadImage: imagesOf(selected) });
    if (!game) return;
    setStatus({ ...picking, starting: true });
    try {
      await send(game);
    } catch (caught) {
      setError((caught as Error).message);
    }
    setStatus({ ...picking, starting: false });
  }

  async function startBuilt(game: BuiltGame) {
    setSendingBuilt(true);
    try {
      await send(game);
    } finally {
      setSendingBuilt(false);
    }
  }

  const keepScoresBox = (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={keepScores}
        onChange={(event) => setKeepScores(event.target.checked)}
        disabled={locked}
        className="size-5 accent-accent"
      />
      Keep scores
    </label>
  );

  const detail = (set: QuestionSet) =>
    // Drafts stay pickable, as on Host a game: choosing one says what to fix (DECISIONS F50).
    setDetail(set, rows.isBuiltIn(set), checkPlayable(set).ok);
  const heading = (
    <h2
      id="new-game-heading"
      ref={headingRef}
      tabIndex={-1}
      className="font-display text-3xl outline-none"
    >
      New game
    </h2>
  );

  // On body: the Screen's stage is a positioned box, which would confine a fixed child.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/85 p-4 short:p-2">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-game-heading"
        // Behind an open preview, nothing in the picker takes focus or clicks.
        inert={previewing !== null}
        // The whole dialog scrolls, list included, so a short window reaches every control (LND-06).
        className={`flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto overscroll-contain rounded-[20px] border-2 border-edge bg-surface p-6 text-lg [scrollbar-color:var(--color-edge)_transparent] short:max-w-2xl md:max-w-3xl lg:max-w-5xl ${className}`}
      >
        {picking && building ? (
          <>
            {heading}
            <GameBuilder
              sources={rows.sets}
              hostLabel="Start new game"
              hostingLabel="Starting new game…"
              onHost={startBuilt}
              onSaved={(saved) => {
                // The saved game joins this browser's sets, first and picked.
                setStatus({ ...picking, mine: [saved, ...picking.mine] });
                setSelectedKey(`mine:${saved.id}`);
                setBuilding(false);
              }}
              onBack={() => setBuilding(false)}
            >
              {keepScoresBox}
            </GameBuilder>
          </>
        ) : (
          <SetPicker
            inDialog
            heading={heading}
            back={{ label: 'Cancel', onClick: onClose, disabled: starting }}
            onBuild={
              builder && picking && !locked
                ? () => {
                    setBuilding(true);
                    setError(null);
                  }
                : undefined
            }
            browser={
              <>
                {status.kind === 'loading' && <p className="text-muted">Loading your sets…</p>}
                {status.kind === 'failed' && (
                  <p role="alert" className="text-buzz">
                    Could not load the saved sets in this browser.
                  </p>
                )}
                {picking?.builtIn === null && (
                  <BuiltInSetsError onRetry={retryBuiltIns} retrying={picking.retrying} />
                )}
                {picking && rows.sets.length > 0 && (
                  <SetBrowser
                    mode="select"
                    id="new-game"
                    legend="Question set"
                    sets={rows.sets}
                    keyOf={rows.keyOf}
                    selectedId={selectedKey}
                    onSelect={setSelectedKey}
                    disabled={locked}
                    detail={detail}
                  />
                )}
              </>
            }
            selected={selected && { set: selected, detail: detail(selected) }}
            onPreview={preview && !locked ? setPreviewing : undefined}
            extra={keepScoresBox}
            message={
              error && (
                <p role="alert" className="text-center text-buzz">
                  {error}
                </p>
              )
            }
            action={{
              label: starting
                ? uploadPending
                  ? 'Sending images…'
                  : 'Starting new game…'
                : uploadPending
                  ? 'Retry images'
                  : 'Start new game',
              onClick: () => picking && void start(picking),
              disabled: picking === null || starting || (selected === undefined && !uploadPending),
            }}
          >
            {previewing && (
              <SetPreview
                set={previewing}
                // The set is the picked one, so the preview's next step is the picker's own.
                actionLabel="Start new game"
                onAction={() => picking && void start(picking)}
                onClose={() => setPreviewing(null)}
              />
            )}
          </SetPicker>
        )}
      </section>
    </div>,
    document.body,
  );
}

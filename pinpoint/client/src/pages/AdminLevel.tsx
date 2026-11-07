import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link, useParams } from 'react-router';
import {
  DISPLAY_NAME_MAX,
  FACT_MAX,
  NOTE_MAX,
  PLACE_NAME_MAX,
  WIKIDATA_QUERY_MAX,
} from '#shared/constants.js';
import { guessingCredit } from '#shared/credits.js';
import { boxContains } from '#shared/geo.js';
import { draftBoxAndStyle } from '#shared/publish.js';
import type {
  AdminJobsResponse,
  Category,
  Difficulty,
  GenerationJob,
  LatLng,
  Place,
  PlaceKind,
  ScreenPrompt,
  WikidataCandidate,
} from '#shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { Photo } from '../components/Photo.js';
import { ScreenGuessing } from '../components/ScreenGame.js';
import { PlaceMiniMap } from '../components/PlaceMiniMap.js';
import { categoriesChanged, LEVEL_LABELS, LEVELS } from '../lib/adminCategories.js';
import { loadCategory } from '../lib/adminCategory.js';
import {
  JOBS_POLL_MS,
  cancelJob,
  loadJobs,
  startAdd,
  startReplace,
  undoReplace,
} from '../lib/adminJobs.js';
import {
  addPlaceById,
  isTyping,
  placeChanges,
  placeWarnings,
  removePlace,
  reviewAction,
  reviewedContent,
  savePlace,
  searchWikidata,
  swapPhoto,
  setLevelReviewed,
  stepCard,
} from '../lib/adminLevel.js';
import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CARD,
  INPUT,
  LINK,
  message,
} from '../lib/adminUi.js';
import {
  NONE_FOLLOWED,
  addJobs,
  cardJob,
  follow,
  followedActive,
  ordinal,
  progressLine,
  started,
  type CardJob,
  type FollowedJobs,
} from '../lib/levelJobs.js';

const SKELETON = 'rounded-card border border-line bg-board-panel motion-safe:animate-pulse';
const OUTSIDE = 'The pin must stay inside the box';
/** Polls missed in a row before the page says it cannot reach the server. */
const MISSES_SHOWN = 3;
const NOUN: Record<PlaceKind, string> = { city: 'city', landmark: 'landmark' };
/** Whether Replace and Add can start a job: yes, not today (the cap), never (no key), or not known yet. */
type CanReplace = 'yes' | 'limit' | 'off' | 'unknown';
const TABS: [PlaceKind, string][] = [
  ['city', 'Cities'],
  ['landmark', 'Landmarks'],
];

/** A typed coordinate, or NaN for an empty or malformed field. */
const coord = (text: string) => (text.trim() === '' ? NaN : Number(text));

function Counter({ text, max }: { text: string; max: number }) {
  return (
    <span className="text-text-dim tabular-nums">
      {text.length}/{max}
    </span>
  );
}

/** Replace's and Add's optional note for the writer ("too obscure"), at most 200 characters. */
function NoteForm({
  label,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  onSubmit: (note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      aria-label={submitLabel}
      className="flex flex-col gap-3"
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Escape' && !sending) {
          event.preventDefault();
          onCancel();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        setSending(true);
        setError(null);
        // On success the parent closes the form.
        onSubmit(note).catch((err: unknown) => {
          setSending(false);
          setError(message(err));
        });
      }}
    >
      <label className="flex flex-col gap-1 font-semibold">
        <span className="flex justify-between gap-3">
          {label} <Counter text={note} max={NOTE_MAX} />
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          autoFocus
          className={INPUT}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={sending} className={BUTTON_PRIMARY}>
          {sending ? 'Sending…' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={sending} className={BUTTON_SECONDARY}>
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-delayed">
          {error}
        </p>
      )}
    </form>
  );
}

/** "Queued · 2nd", or a pulsing dot while it runs, with Cancel. */
function JobLine({
  job,
  doing,
  cancelLabel,
  cancelling,
  onCancel,
}: {
  job: Extract<CardJob, { kind: 'queued' | 'running' }>;
  doing: string;
  cancelLabel: string;
  cancelling: boolean;
  onCancel: () => void;
}) {
  let text: string;
  if (cancelling) text = 'Cancelling…';
  else if (job.kind === 'running') text = `${doing}…`;
  else text = job.position === null ? 'Queued' : `Queued · ${ordinal(job.position)}`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p role="status" className="mr-auto flex items-center gap-2 font-semibold">
        {job.kind === 'running' && (
          <span aria-hidden className="text-amber motion-safe:animate-pulse">
            ●
          </span>
        )}
        {text}
      </p>
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelling}
        aria-label={cancelLabel}
        className={BUTTON_SECONDARY}
      >
        Cancel
      </button>
    </div>
  );
}

const adminPhotoUrl = (id: string) => `/api/admin/photos/${encodeURIComponent(id)}`;
/** A 4:3 frame a photo is contained in. */
const PHOTO_FRAME =
  'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-card border border-line bg-board-bg';

function NamesPlaceBadge() {
  return (
    <span className="rounded-button border border-delayed px-2 text-delayed">Names the place</span>
  );
}

/**
 * A landmark's photo (4:3, contained) with its credit, and **Swap photo** from the stored
 * candidates, whose thumbnails load from Commons in this browser. On a pick the server downloads,
 * strips, stores and sign-checks it.
 */
// SPEC-QUESTION: DECISIONS 59 (Swap photo beside the photo, a flagged pick kept and badged)
function LandmarkPhoto({
  category,
  level,
  place,
  disabled,
  onSaved,
}: {
  category: Category;
  level: Difficulty;
  place: Place;
  disabled: boolean;
  onSaved: (c: Category) => void;
}) {
  const swapRef = useRef<HTMLButtonElement>(null);
  const [picking, setPicking] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidates = place.photoCandidates ?? [];
  const { photo } = place;

  function close() {
    setPicking(false);
    swapRef.current?.focus();
  }

  function pick(commonsFile: string) {
    setSwapping(commonsFile);
    setError(null);
    swapPhoto(category.id, level, place.id, commonsFile).then(
      (next) => {
        setSwapping(null);
        onSaved(next);
        close();
      },
      (err: unknown) => {
        setSwapping(null);
        setError(message(err));
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {photo ? (
        <figure className="flex max-w-md flex-col gap-1">
          <div className={PHOTO_FRAME}>
            <Photo
              src={adminPhotoUrl(photo.id)}
              alt={`Photo of ${place.name}`}
              className="size-full object-contain"
              fallback={<p className="text-text-dim">Photo unavailable</p>}
            />
          </div>
          <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-dim">
            <span>
              Photo: {photo.author} ·{' '}
              <a
                href={photo.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center font-semibold text-text underline underline-offset-4 [@media(hover:hover)]:hover:text-amber"
              >
                {photo.licence}
              </a>
            </span>
            {photo.signCheck === 'flagged' && <NamesPlaceBadge />}
          </figcaption>
        </figure>
      ) : (
        <p className="text-delayed">No photo</p>
      )}
      <button
        type="button"
        ref={swapRef}
        onClick={() => {
          if (swapping !== null) return; // kept enabled, so focus can return to it after a swap
          setError(null);
          setPicking((on) => !on);
        }}
        disabled={disabled || candidates.length === 0}
        aria-expanded={picking}
        aria-label={`${candidates.length ? 'Swap photo' : 'No other photos'} for ${place.name}`}
        className={`${BUTTON_SECONDARY} self-start`}
      >
        {candidates.length ? 'Swap photo' : 'No other photos'}
      </button>
      {picking && !disabled && (
        <fieldset
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === 'Escape' && swapping === null) {
              event.preventDefault();
              close();
            }
          }}
          className="flex flex-col gap-3"
        >
          <legend className="mb-2 font-semibold">Swap photo for {place.name}</legend>
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {candidates.map((c, i) => (
              <li key={c.commonsFile} className="flex flex-col gap-1">
                <div className={PHOTO_FRAME}>
                  <Photo
                    src={c.thumbUrl}
                    alt={`Photo ${i + 1} by ${c.author}`}
                    className="size-full object-contain"
                    fallback={
                      <p className="p-2 text-center text-text-dim">Couldn't load from Commons</p>
                    }
                  />
                </div>
                <p className="break-words text-text-dim">
                  {c.author} · {c.licence} · {c.width} × {c.height}
                </p>
                {c.namesPlace && (
                  <span className="self-start">
                    <NamesPlaceBadge />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => pick(c.commonsFile)}
                  disabled={swapping !== null}
                  autoFocus={i === 0}
                  aria-label={`Use photo ${i + 1} by ${c.author}${c.namesPlace ? ' (names the place)' : ''}`}
                  className={BUTTON_SECONDARY}
                >
                  {swapping === c.commonsFile ? 'Swapping…' : 'Use this photo'}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-delayed">
          {error}
        </p>
      )}
    </div>
  );
}

const STAGE_W = 1920;
const PREVIEW_ROUND = {
  number: 1,
  total: 10,
  multiplier: 1,
  endsAt: null,
  gate: 'boarding',
} as const;

/**
 * **Preview**: the place as the Screen draws its guessing prompt (flaps, or the photo with its
 * guessing credit), the Screen's own component on its 1920 × 1080 stage, scaled to the card.
 */
function PlacePreview({ place }: { place: Place }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Measured before paint, so the stage never shows at scale 0.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setWidth(frame.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const prompt: ScreenPrompt =
    place.kind === 'landmark' && place.photo
      ? {
          kind: 'picture',
          photoUrl: adminPhotoUrl(place.photo.id),
          credit: guessingCredit(place.photo, place),
        }
      : { kind: 'name', displayName: place.displayName };
  return (
    <figure className="flex flex-col gap-1">
      <div
        ref={frameRef}
        // A scaled copy of the Screen: the caption describes it, so readers skip the copy.
        aria-hidden="true"
        data-testid="preview-stage"
        className="relative aspect-video w-full overflow-hidden rounded-card border border-line bg-board-bg"
      >
        <div
          className="absolute top-0 left-0 flex origin-top-left flex-col"
          style={{ width: STAGE_W, height: 1080, transform: `scale(${width / STAGE_W})` }}
        >
          <ScreenGuessing
            view={{ players: [], paused: null }}
            round={{ ...PREVIEW_ROUND, lockedIn: [], prompt }}
          />
        </div>
      </div>
      <figcaption className="text-text-dim">
        Preview: the Screen while players guess {place.name}
      </figcaption>
    </figure>
  );
}

const replaceText = (can: CanReplace) => (can === 'limit' ? 'Daily limit reached' : 'Replace');

/** One place: what it is, its map and warnings, Edit, Replace and Remove; Edit opens the form in place. */
function PlaceCard({
  category,
  level,
  place,
  origin,
  job,
  canReplace,
  cancelling,
  onSaved,
  onRemoved,
  onReplace,
  onCancelJob,
  onUndo,
}: {
  category: Category;
  level: Difficulty;
  place: Place;
  origin: LatLng | undefined;
  /** Its latest replacement on this visit, or "added". */
  job: CardJob | null;
  canReplace: CanReplace;
  cancelling: boolean;
  onSaved: (c: Category) => void;
  onRemoved: (c: Category) => void;
  onReplace: (note: string) => Promise<void>;
  onCancelJob: (jobId: string) => Promise<void>;
  onUndo: (jobId: string) => Promise<void>;
}) {
  const id = useId();
  const box = draftBoxAndStyle(category).box;
  const editRef = useRef<HTMLButtonElement>(null);
  const replaceRef = useRef<HTMLButtonElement>(null);
  const [form, setForm] = useState<Record<
    'name' | 'displayName' | 'fact' | 'lat' | 'lng',
    string
  > | null>(null);
  const [dropRefused, setDropRefused] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  // A queued or running replacement owns the place until it ends.
  const pending = job?.kind === 'queued' || job?.kind === 'running';

  function closeReplace() {
    setReplacing(false);
    requestAnimationFrame(() => replaceRef.current?.focus());
  }

  /** Cancel or Undo: busy until the answer; a refusal shows on the card. */
  function act(run: () => Promise<void>) {
    setError(null);
    setWorking(true);
    run().then(
      () => setWorking(false),
      (err: unknown) => {
        setWorking(false);
        setError(message(err));
      },
    );
  }

  const lat = form ? coord(form.lat) : place.lat;
  const lng = form ? coord(form.lng) : place.lng;
  const pinOk = Number.isFinite(lat) && Number.isFinite(lng) && boxContains(box, { lat, lng });
  // While editing, the warnings follow the moved pin and the typed display name.
  const shown: Place =
    form && pinOk
      ? { ...place, lat, lng, displayName: form.displayName.trim() || place.displayName }
      : place;
  const warnings = placeWarnings(category, level, shown, origin);

  function open() {
    setForm({
      name: place.name,
      displayName: place.displayName,
      fact: place.fact,
      lat: String(place.lat),
      lng: String(place.lng),
    });
    setDropRefused(false);
    setError(null);
  }

  function close() {
    setForm(null);
    setDropRefused(false);
    // The form's last button is gone; Edit takes focus back.
    requestAnimationFrame(() => editRef.current?.focus());
  }

  const changes =
    form && pinOk
      ? placeChanges(place, {
          name: form.name,
          displayName: form.displayName,
          fact: form.fact,
          lat,
          lng,
        })
      : {};
  const filled =
    form !== null &&
    form.name.trim() !== '' &&
    form.fact.trim() !== '' &&
    (place.kind !== 'city' || form.displayName.trim() !== '');
  const canSave = filled && pinOk && Object.keys(changes).length > 0 && !working;

  function save(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setWorking(true);
    setError(null);
    savePlace(category.id, level, place.id, changes).then(
      (next) => {
        setWorking(false);
        onSaved(next);
        close();
      },
      (err: unknown) => {
        setWorking(false);
        setError(message(err));
      },
    );
  }

  function remove() {
    setWorking(true);
    setError(null);
    removePlace(category.id, level, place.id).then(onRemoved, (err: unknown) => {
      setWorking(false);
      setError(message(err));
    });
  }

  const field = (key: 'name' | 'displayName' | 'fact' | 'lat' | 'lng', value: string) => {
    if (!form) return;
    setForm({ ...form, [key]: value });
    if (key === 'lat' || key === 'lng') setDropRefused(false);
  };

  const pinError = form && (!pinOk || dropRefused) ? OUTSIDE : null;

  return (
    <li>
      <article
        id={`card-${place.id}`}
        aria-labelledby={`${id}-name`}
        // Focusable for J/K; the scroll margin keeps a card clear of the sticky footer.
        tabIndex={-1}
        data-review-card=""
        className={`${CARD} scroll-mt-4 scroll-mb-56 p-4 md:p-6`}
      >
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={`${id}-name`} className="text-xl font-bold break-words">
              {place.name}
            </h2>
            {job?.kind === 'added' && (
              <span className="rounded-button border border-amber px-2 text-amber">Added</span>
            )}
          </div>
          {place.kind === 'city' && place.displayName !== place.name && (
            <p className="text-text-dim">
              Shown as <span className="font-semibold text-text">{place.displayName}</span>
            </p>
          )}
          <p className="text-text-dim">
            {place.countryName} ·{' '}
            <a
              href={`https://www.wikidata.org/wiki/${place.wikidataId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center font-semibold text-text underline underline-offset-4 [@media(hover:hover)]:hover:text-amber"
            >
              {place.wikidataId}
            </a>
            {place.coordsSource === 'admin' && ' · Pin placed by admin'}
          </p>
        </div>
        {pending && (
          <JobLine
            job={job}
            doing={`Writing a new ${NOUN[place.kind]}`}
            cancelLabel={`Cancel replacing ${place.name}`}
            cancelling={cancelling || working}
            onCancel={() => act(() => onCancelJob(job.jobId))}
          />
        )}
        {job?.kind === 'replaced' && (
          <div className="flex flex-wrap items-center gap-3">
            <p role="status" className="mr-auto font-semibold text-on-time">
              Replaced {job.old.name}
            </p>
            <button
              type="button"
              onClick={() => act(() => onUndo(job.jobId))}
              disabled={working}
              aria-label={`Undo replacing ${job.old.name}`}
              className={BUTTON_SECONDARY}
            >
              Undo
            </button>
          </div>
        )}
        {job?.kind === 'failed' && (
          <p role="alert" className="text-delayed">
            The replacement failed: {job.error}
          </p>
        )}
        {!form && (
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span>{place.fact}</span>
            <Counter text={place.fact} max={FACT_MAX} />
          </p>
        )}

        <PlaceMiniMap
          name={place.name}
          box={box}
          at={pinOk ? { lat, lng } : place}
          onMove={
            form
              ? (to) => {
                  setForm((f) => f && { ...f, lat: String(to.lat), lng: String(to.lng) });
                  setDropRefused(false);
                }
              : undefined
          }
          onRefused={() => setDropRefused(true)}
        />

        {place.kind === 'landmark' && (
          <LandmarkPhoto
            category={category}
            level={level}
            place={place}
            disabled={working || pending || form !== null}
            onSaved={onSaved}
          />
        )}

        {warnings.length > 0 && (
          <ul aria-label={`Warnings for ${place.name}`} className="flex flex-col gap-1">
            {warnings.map((w) => (
              <li key={w} className="text-amber">
                <span aria-hidden>⚠ </span>
                {w}
              </li>
            ))}
          </ul>
        )}

        {previewing && <PlacePreview place={place} />}

        {form ? (
          <form
            onSubmit={save}
            onKeyDown={(event: KeyboardEvent) => {
              if (event.key === 'Escape' && !working) {
                event.preventDefault();
                close();
              }
            }}
            aria-label={`Edit ${place.name}`}
            className="flex flex-col gap-3"
            noValidate
          >
            <label className="flex flex-col gap-1 font-semibold">
              Name
              <input
                value={form.name}
                onChange={(e) => field('name', e.target.value)}
                maxLength={PLACE_NAME_MAX}
                autoFocus
                className={INPUT}
              />
            </label>
            {place.kind === 'city' && (
              <label className="flex flex-col gap-1 font-semibold">
                Display name
                <input
                  value={form.displayName}
                  onChange={(e) => field('displayName', e.target.value)}
                  maxLength={DISPLAY_NAME_MAX}
                  className={INPUT}
                />
              </label>
            )}
            <label className="flex flex-col gap-1 font-semibold">
              <span className="flex justify-between gap-3">
                Fact <Counter text={form.fact} max={FACT_MAX} />
              </span>
              <input
                value={form.fact}
                onChange={(e) => field('fact', e.target.value)}
                maxLength={FACT_MAX}
                className={INPUT}
              />
            </label>
            <fieldset className="flex flex-col gap-1">
              <legend className="font-semibold">Pin: drag it on the map or type it</legend>
              <div className="grid grid-cols-2 gap-3">
                {(['lat', 'lng'] as const).map((key) => (
                  <label key={key} className="flex flex-col gap-1 font-semibold">
                    {key === 'lat' ? 'Latitude' : 'Longitude'}
                    <input
                      type="number"
                      step="0.00001"
                      inputMode="decimal"
                      value={form[key]}
                      onChange={(e) => field(key, e.target.value)}
                      aria-invalid={pinError !== null}
                      aria-describedby={`${id}-pin`}
                      className={`${INPUT} board-face tabular-nums`}
                    />
                  </label>
                ))}
              </div>
              {/* A fixed slot, so the form doesn't jump as the pin goes in and out of the box. */}
              <p id={`${id}-pin`} role="alert" className="min-h-7 text-delayed">
                {pinError}
              </p>
            </fieldset>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={!canSave} className={BUTTON_PRIMARY}>
                {working ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={close} disabled={working} className={BUTTON_SECONDARY}>
                Cancel
              </button>
            </div>
          </form>
        ) : replacing ? (
          <NoteForm
            label="Why replace? (optional)"
            submitLabel="Replace"
            onCancel={closeReplace}
            onSubmit={(note) =>
              onReplace(note).then(() => {
                // Replace is disabled while the job waits: the card keeps J/K's place.
                setReplacing(false);
                document.getElementById(`card-${place.id}`)?.focus();
              })
            }
          />
        ) : (
          // The destructive action last (client.md).
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              ref={editRef}
              onClick={open}
              disabled={working || pending}
              aria-label={`Edit ${place.name}`}
              aria-keyshortcuts="E"
              data-review-key="edit"
              className={BUTTON_SECONDARY}
            >
              Edit
            </button>
            <button
              type="button"
              ref={replaceRef}
              onClick={() => {
                setError(null);
                setReplacing(true);
              }}
              disabled={working || pending || canReplace !== 'yes'}
              aria-label={
                canReplace === 'yes' || canReplace === 'unknown'
                  ? `Replace ${place.name}`
                  : `Replace ${place.name} (${canReplace === 'limit' ? 'daily limit reached' : 'off'})`
              }
              aria-keyshortcuts="R"
              data-review-key="replace"
              className={BUTTON_SECONDARY}
            >
              {replaceText(canReplace)}
            </button>
            {(place.kind === 'city' || place.photo) && (
              <button
                type="button"
                onClick={() => setPreviewing((on) => !on)}
                aria-expanded={previewing}
                aria-label={`${previewing ? 'Hide the preview of' : 'Preview'} ${place.name}`}
                className={BUTTON_SECONDARY}
              >
                {previewing ? 'Hide preview' : 'Preview'}
              </button>
            )}
            <ConfirmButton
              label="Remove"
              confirmLabel="Confirm remove"
              ariaLabel={`Remove ${place.name}`}
              onConfirm={remove}
              disabled={working || pending}
              reviewKey="remove"
              className={BUTTON_DANGER}
              cancelClassName={BUTTON_SECONDARY}
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-delayed">
            {error}
          </p>
        )}
      </article>
    </li>
  );
}

const where = (c: WikidataCandidate) =>
  [
    c.country ?? 'Country unclear',
    c.lat === null || c.lng === null
      ? 'no coordinates'
      : `${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`,
  ].join(' · ');

/**
 * **Add by name** at the bottom of a tab (spec: Level review): search Wikidata, pick one of up to 7
 * candidates, type the fact, and the server runs Locate's checks on it. No LLM, so no daily limit.
 */
function AddByName({
  category,
  level,
  kind,
  onAdded,
}: {
  category: Category;
  level: Difficulty;
  kind: PlaceKind;
  onAdded: (c: Category) => void;
}) {
  const id = useId();
  const openRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<WikidataCandidate[] | null>(null);
  const [picked, setPicked] = useState<WikidataCandidate | null>(null);
  const [fact, setFact] = useState('');
  const [working, setWorking] = useState<'search' | 'add' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const noun = kind === 'city' ? 'city' : 'landmark';

  function close() {
    setOpen(false);
    setQuery('');
    setCandidates(null);
    setPicked(null);
    setFact('');
    setError(null);
    requestAnimationFrame(() => openRef.current?.focus());
  }

  function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || working) return;
    setWorking('search');
    setError(null);
    setPicked(null);
    searchWikidata(query.trim(), category.id).then(
      (found) => {
        setWorking(null);
        setCandidates(found);
      },
      (err: unknown) => {
        setWorking(null);
        setError(message(err));
      },
    );
  }

  const canAdd = picked !== null && fact.trim() !== '' && working === null;

  function add(event: FormEvent) {
    event.preventDefault();
    if (!canAdd) return;
    setWorking('add');
    setError(null);
    addPlaceById(category.id, level, {
      kind,
      wikidataId: picked.wikidataId,
      fact: fact.trim(),
    }).then(
      (next) => {
        setWorking(null);
        setAdded(`Added ${picked.name}.`);
        onAdded(next);
        close();
      },
      (err: unknown) => {
        setWorking(null);
        setError(message(err));
      },
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <p role="status" className="text-amber empty:hidden">
        {open ? null : added}
      </p>
      {!open ? (
        <button
          type="button"
          ref={openRef}
          onClick={() => {
            setOpen(true);
            setAdded(null);
          }}
          className={`${BUTTON_SECONDARY} self-start`}
        >
          Add by name
        </button>
      ) : (
        <section
          aria-labelledby={`${id}-title`}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === 'Escape' && working === null) {
              event.preventDefault();
              close();
            }
          }}
          className={`${CARD} p-4 md:p-6`}
        >
          <h2 id={`${id}-title`} className="text-xl font-bold">
            Add a {noun} by name
          </h2>
          <form role="search" onSubmit={search} className="flex flex-col gap-1" noValidate>
            <label htmlFor={`${id}-q`} className="font-semibold">
              Name on Wikidata
            </label>
            <div className="flex flex-wrap gap-3">
              <input
                id={`${id}-q`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={WIKIDATA_QUERY_MAX}
                autoFocus
                className={`${INPUT} flex-1 basis-60`}
              />
              <button
                type="submit"
                disabled={!query.trim() || working !== null}
                className={BUTTON_SECONDARY}
              >
                {working === 'search' ? 'Searching…' : 'Search'}
              </button>
            </div>
          </form>

          {candidates?.length === 0 && (
            <p role="status" className="text-text-dim">
              Nothing on Wikidata matches that name.
            </p>
          )}
          {candidates && candidates.length > 0 && (
            <form onSubmit={add} className="flex flex-col gap-3" noValidate>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 font-semibold">Pick the {noun}</legend>
                <p role="status" className="text-text-dim">
                  {candidates.length === 1 ? '1 match' : `${candidates.length} matches`}
                </p>
                {candidates.map((c) => (
                  <label
                    key={c.wikidataId}
                    className="flex min-h-12 cursor-pointer items-start gap-3 rounded-button border border-line p-3 has-[:checked]:border-amber"
                  >
                    <input
                      type="radio"
                      name={`${id}-pick`}
                      checked={picked?.wikidataId === c.wikidataId}
                      onChange={() => setPicked(c)}
                      className="mt-1.5 size-5 shrink-0 accent-amber"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold break-words">
                        {c.name} <span className="font-normal text-text-dim">{c.wikidataId}</span>
                      </span>
                      {c.description && <span className="break-words">{c.description}</span>}
                      <span className="text-text-dim tabular-nums">{where(c)}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="flex flex-col gap-1 font-semibold">
                <span className="flex justify-between gap-3">
                  Fact <Counter text={fact} max={FACT_MAX} />
                </span>
                <input
                  value={fact}
                  onChange={(e) => setFact(e.target.value)}
                  maxLength={FACT_MAX}
                  className={INPUT}
                />
              </label>
              {working === null && !canAdd && (
                <p className="text-text-dim">
                  {picked ? 'Type a fact to add it.' : `Pick a ${noun} to add it.`}
                </p>
              )}
              <button type="submit" disabled={!canAdd} className={`${BUTTON_PRIMARY} self-start`}>
                {working === 'add' ? 'Adding…' : picked ? `Add ${picked.name}` : `Add the ${noun}`}
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="text-delayed">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={close}
            disabled={working !== null}
            className={`${BUTTON_SECONDARY} self-start`}
          >
            Cancel
          </button>
        </section>
      )}
    </div>
  );
}

/** **Add a place** at the bottom of a tab: Claude writes one, with an optional note (spec: Level review). */
function AddPlace({
  kind,
  jobs,
  canReplace,
  off,
  isCancelling,
  onAdd,
  onCancelJob,
}: {
  kind: PlaceKind;
  jobs: CardJob[];
  canReplace: CanReplace;
  /** Why generation is off, shown beside the disabled button. */
  off: string | null;
  isCancelling: (jobId: string) => boolean;
  onAdd: (note: string) => Promise<void>;
  onCancelJob: (jobId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noun = NOUN[kind];
  return (
    <section aria-label={`Add a ${noun}`} className="mt-4 flex flex-col gap-3">
      {jobs.map((job, i) =>
        job.kind === 'failed' ? (
          <p key={job.jobId} role="alert" className="text-delayed">
            Could not add a {noun}: {job.error}
          </p>
        ) : job.kind === 'queued' || job.kind === 'running' ? (
          <div key={job.jobId} className={`${CARD} p-4`}>
            <JobLine
              job={job}
              doing={`Writing a new ${noun}`}
              cancelLabel={`Cancel adding ${noun} ${i + 1}`}
              cancelling={isCancelling(job.jobId)}
              onCancel={() => {
                setError(null);
                onCancelJob(job.jobId).catch((err: unknown) => setError(message(err)));
              }}
            />
          </div>
        ) : null,
      )}
      {adding ? (
        <div className={`${CARD} p-4`}>
          <NoteForm
            label={`Anything the new ${noun} should be? (optional)`}
            submitLabel={`Add a ${noun}`}
            onCancel={() => setAdding(false)}
            onSubmit={(note) => onAdd(note).then(() => setAdding(false))}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAdding(true);
          }}
          disabled={canReplace !== 'yes'}
          className={`${BUTTON_SECONDARY} self-start`}
        >
          {canReplace === 'limit' ? 'Daily limit reached' : 'Add a place'}
        </button>
      )}
      {canReplace === 'off' && off && <p className="text-text-dim">{off}</p>}
      {error && (
        <p role="alert" className="text-delayed">
          {error}
        </p>
      )}
    </section>
  );
}

/** The footer that stays on screen: **Mark ‹level› reviewed** (or the mark and Unmark), and the keys. */
function ReviewFooter({
  category,
  level,
  progress,
  left,
  unreachable,
  onSaved,
}: {
  category: Category;
  level: Difficulty;
  /** "2 replacing · 1 adding", or "". */
  progress: string;
  /** The replacements left today, or why there are none. */
  left: string;
  unreachable: boolean;
  onSaved: (c: Category) => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = category.draft[level];
  const name = LEVEL_LABELS[level];

  function mark(reviewed: boolean) {
    setWorking(true);
    setError(null);
    setLevelReviewed(category.id, level, reviewed).then(
      (next) => {
        setWorking(false);
        onSaved(next);
        categoriesChanged();
      },
      (err: unknown) => {
        setWorking(false);
        setError(message(err));
      },
    );
  }

  return (
    <footer className="sticky bottom-0 z-[1000] flex flex-col gap-2 border-t border-line bg-board-bg py-3">
      <div className="flex flex-wrap items-center gap-3">
        {!draft ? (
          <p className="text-text-dim">{name} is live. An edit starts a draft of it.</p>
        ) : draft.reviewed ? (
          <>
            <p className="font-semibold text-amber">✓ {name} is reviewed.</p>
            <button
              type="button"
              onClick={() => mark(false)}
              disabled={working}
              className={BUTTON_SECONDARY}
            >
              Mark not reviewed
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => mark(true)}
            disabled={working}
            className={BUTTON_PRIMARY}
          >
            Mark {name} reviewed
          </button>
        )}
        <p className="hidden text-text-dim lg:block">
          Keys: <kbd className="font-semibold text-text">J</kbd>/
          <kbd className="font-semibold text-text">K</kbd> move ·{' '}
          <kbd className="font-semibold text-text">E</kbd> edit ·{' '}
          <kbd className="font-semibold text-text">R</kbd> replace ·{' '}
          <kbd className="font-semibold text-text">Delete</kbd> remove
        </p>
      </div>
      {/* Its height is kept while the first job read is out, so the footer doesn't jump. */}
      <p className="flex min-h-7 flex-wrap gap-x-3">
        {progress && (
          <span role="status" className="font-semibold">
            {progress}
          </span>
        )}
        <span className="text-text-dim">{left}</span>
      </p>
      {unreachable && (
        <p role="alert" className="text-delayed">
          Can’t reach the server. Still trying every 2 seconds…
        </p>
      )}
      {error && (
        <p role="alert" className="text-delayed">
          {error}
        </p>
      )}
    </footer>
  );
}

type Load = { kind: 'failed'; error: string } | { kind: 'ready'; category: Category };

/**
 * `/admin/categories/:id/:level` (spec: Level review): Cities and Landmarks tabs with a card per
 * place, Edit, Replace, Remove, warnings, Add a place, the sticky footer and the keys J/K, E, R and
 * Delete. Keyed by the level, so leaving it forgets its jobs and with them every Undo.
 */
export function AdminLevel() {
  const { id = '', level = '' } = useParams();
  return <LevelPage key={`${id}/${level}`} />;
}

function LevelPage() {
  const { id = '', level: levelParam = '' } = useParams();
  const level = LEVELS.find((l) => l === levelParam);
  const [attempt, setAttempt] = useState(0);
  const key = `${id}#${attempt}`;
  const [answer, setAnswer] = useState<(Load & { key: string }) | null>(null);
  const load: Load | { kind: 'loading' } = answer?.key === key ? answer : { kind: 'loading' };
  const [tab, setTab] = useState<PlaceKind>('city');
  const tabsId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  // Where Wikidata put each place, as first seen on this page (spec: "Moved 23 km from Wikidata").
  // SPEC-QUESTION: DECISIONS 42 (a pin moved in an earlier visit has no origin to measure from)
  const [origins, setOrigins] = useState(() => new Map<string, LatLng>());
  // The card to focus after a removal, by position.
  const focusAt = useRef<number | null>(null);
  // The replacements and additions followed on this visit. The ref is the truth for async answers.
  const followedRef = useRef<FollowedJobs>(NONE_FOLLOWED);
  const [followed, setFollowedState] = useState<FollowedJobs>(NONE_FOLLOWED);
  const [allowance, setAllowance] = useState<AdminJobsResponse | null>(null);
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(new Set());
  const [misses, setMisses] = useState(0);
  const setFollowed = useCallback((next: FollowedJobs) => {
    followedRef.current = next;
    setFollowedState(next);
  }, []);

  function show(category: Category) {
    setAnswer({ key, kind: 'ready', category });
    setOrigins((known) => {
      const next = new Map(known);
      for (const l of LEVELS) {
        for (const p of reviewedContent(category, l)?.places ?? []) {
          // With the Q-id: a replacement keeps the old place's id but is somewhere else.
          const k = `${l}:${p.id}:${p.wikidataId}`;
          if (p.coordsSource === 'wikidata' && !next.has(k))
            next.set(k, { lat: p.lat, lng: p.lng });
        }
      }
      return next;
    });
  }

  useEffect(() => {
    let current = true;
    loadCategory(id).then(
      (category) => current && show(category),
      (err: unknown) => current && setAnswer({ key, kind: 'failed', error: message(err) }),
    );
    return () => {
      current = false;
    };
    // `show` reads only `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key]);

  /** A poll's (or a cancel's) jobs: when one of this level's ends done, the level is read again. */
  const take = useCallback(
    (jobs: readonly GenerationJob[]) => {
      const mine = jobs.filter((j) => j.levels[0]?.level === levelParam);
      const { followed: next, ended } = follow(followedRef.current, mine);
      setFollowed(next);
      if (ended.some((j) => j.state === 'done')) {
        loadCategory(id).then(
          (c) => {
            show(c);
            categoriesChanged();
          },
          () => setMisses((n) => n + 1),
        );
      }
    },
    // `show` reads only `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, levelParam, key, setFollowed],
  );

  const poll = useCallback(() => {
    loadJobs(id).then(
      (data) => {
        setMisses(0);
        setAllowance(data);
        take(data.jobs);
      },
      () => setMisses((n) => n + 1),
    );
  }, [id, take]);

  // Jobs queued or running from an earlier visit or another tab are followed from the first read.
  useEffect(poll, [poll]);

  const busy = [...followed.values()].some(followedActive);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(poll, JOBS_POLL_MS);
    return () => clearInterval(timer);
  }, [busy, poll]);

  // After a removal: the card now in its place (or the last one), else the tab.
  useEffect(() => {
    if (focusAt.current === null) return;
    const cards = listRef.current?.querySelectorAll<HTMLElement>('[data-review-card]') ?? [];
    const card = cards[Math.min(focusAt.current, cards.length - 1)];
    if (card) card.focus();
    else document.getElementById(`${tabsId}-${tab}`)?.focus();
    focusAt.current = null;
  });

  // J/K (and the arrows) move between cards, E edits and Delete removes the focused one. The
  // handler presses the card's own buttons, so a disabled or hidden one is never pressed.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || isTyping(event.target)) return;
      const action = reviewAction(event);
      if (!action) return;
      const cards = [
        ...(listRef.current?.querySelectorAll<HTMLElement>('[data-review-card]') ?? []),
      ];
      const current = cards.findIndex((card) => card.contains(document.activeElement));
      if (action === 'next' || action === 'prev') {
        const to = stepCard(current, cards.length, action === 'next' ? 1 : -1);
        const card = to === null ? undefined : cards[to];
        if (!card) return;
        event.preventDefault();
        card.focus({ preventScroll: true });
        card.scrollIntoView?.({ block: 'nearest' });
        return;
      }
      const button = cards[current]?.querySelector<HTMLButtonElement>(
        `[data-review-key="${action}"]:not(:disabled)`,
      );
      if (!button) return;
      event.preventDefault();
      button.click();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!level) {
    return (
      <section aria-labelledby="page-heading" className="flex flex-col gap-4">
        <h1 id="page-heading" className="text-3xl font-bold">
          No such level
        </h1>
        <Link to={`/admin/categories/${encodeURIComponent(id)}`} className={`${LINK} self-start`}>
          ← Back to the category
        </Link>
      </section>
    );
  }
  if (load.kind === 'loading') {
    return (
      <div role="status" aria-label="Loading the level" className="flex flex-col gap-6">
        <div className={`${SKELETON} h-9 w-48`} />
        <div className={`${SKELETON} h-12`} />
        <div className={`${SKELETON} h-96`} />
      </div>
    );
  }
  if (load.kind === 'failed') {
    return (
      <section aria-labelledby="page-heading" className="flex flex-col gap-4">
        <h1 id="page-heading" className="text-3xl font-bold">
          {LEVEL_LABELS[level]}
        </h1>
        <p role="alert" className="text-delayed">
          {load.error}
        </p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className={`${BUTTON_SECONDARY} self-start`}
        >
          Retry
        </button>
      </section>
    );
  }

  const { category } = load;
  const onSaved = (next: Category) => {
    show(next);
    categoriesChanged();
  };
  const content = reviewedContent(category, level);
  const places = content?.places ?? [];
  const inTab = places.filter((p) => p.kind === tab);

  let canReplace: CanReplace = 'unknown';
  if (allowance?.off) canReplace = 'off';
  else if (allowance) canReplace = allowance.replacementsLeft > 0 ? 'yes' : 'limit';
  const left =
    canReplace === 'off'
      ? `Replacing and adding places is off: ${allowance!.off}`
      : canReplace === 'unknown'
        ? ''
        : `${allowance!.replacementsLeft} ${allowance!.replacementsLeft === 1 ? 'replacement' : 'replacements'} left today (UTC).`;

  /** Replace (a place) or Add (null): the job is followed at once and polled. */
  async function begin(jobId: Promise<string>, placeId: string | null, kind: PlaceKind) {
    setFollowed(started(followedRef.current, await jobId, placeId, kind));
    poll();
  }

  async function cancel(jobId: string): Promise<void> {
    const job = await cancelJob(jobId);
    if (job.state === 'running') setCancelling((now) => new Set(now).add(jobId));
    take([job]);
    poll();
  }

  async function undo(jobId: string): Promise<void> {
    onSaved(await undoReplace(jobId));
    const entry = followedRef.current.get(jobId);
    if (entry) setFollowed(new Map(followedRef.current).set(jobId, { ...entry, undone: true }));
  }

  // A running job's cancel lands after its current API call: "Cancelling…" until a poll says so.
  const isCancelling = (jobId: string) => {
    const entry = followed.get(jobId);
    return cancelling.has(jobId) && entry !== undefined && followedActive(entry);
  };

  function onTabKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: PlaceKind = tab === 'city' ? 'landmark' : 'city';
    setTab(next);
    document.getElementById(`${tabsId}-${next}`)?.focus();
  }

  return (
    <section aria-labelledby="page-heading" className="flex flex-col gap-6">
      <Link
        to={`/admin/categories/${encodeURIComponent(category.id)}`}
        className={`${LINK} self-start`}
      >
        ← {category.name}
      </Link>
      <h1 id="page-heading" className="text-3xl font-bold break-words">
        {category.name} · {LEVEL_LABELS[level]}
      </h1>
      {!content && <p className="text-text-dim">{LEVEL_LABELS[level]} has no places yet.</p>}
      {content && (
        <>
          <div
            role="tablist"
            aria-label="Kind of place"
            className="flex gap-2 border-b border-line"
          >
            {TABS.map(([kind, label]) => (
              <button
                key={kind}
                id={`${tabsId}-${kind}`}
                type="button"
                role="tab"
                aria-selected={tab === kind}
                aria-controls={`${tabsId}-panel`}
                tabIndex={tab === kind ? 0 : -1}
                onClick={() => setTab(kind)}
                onKeyDown={onTabKey}
                className="-mb-px min-h-12 border-b-4 border-transparent px-4 text-lg font-semibold text-text-dim aria-selected:border-amber aria-selected:text-text"
              >
                {label}{' '}
                <span className="tabular-nums">
                  ({places.filter((p) => p.kind === kind).length})
                </span>
              </button>
            ))}
          </div>
          <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`}>
            {inTab.length === 0 ? (
              <p className="text-text-dim">
                No {tab === 'city' ? 'cities' : 'landmarks'} in {LEVEL_LABELS[level]}.
              </p>
            ) : (
              <ul ref={listRef} className="flex flex-col gap-4">
                {inTab.map((place) => {
                  const job = cardJob(followed, place.id);
                  return (
                    <PlaceCard
                      key={place.id}
                      category={category}
                      level={level}
                      place={place}
                      origin={origins.get(`${level}:${place.id}:${place.wikidataId}`)}
                      job={job}
                      canReplace={canReplace}
                      cancelling={job !== null && 'jobId' in job && isCancelling(job.jobId)}
                      onSaved={onSaved}
                      onReplace={(note) =>
                        begin(
                          startReplace(category.id, level, place.id, note),
                          place.id,
                          place.kind,
                        )
                      }
                      onCancelJob={cancel}
                      onUndo={undo}
                      onRemoved={(next) => {
                        focusAt.current = inTab.indexOf(place);
                        onSaved(next);
                      }}
                    />
                  );
                })}
              </ul>
            )}
            <AddPlace
              key={`add-${tab}`}
              kind={tab}
              jobs={addJobs(followed, tab)}
              canReplace={canReplace}
              off={allowance?.off ?? null}
              isCancelling={isCancelling}
              onAdd={(note) => begin(startAdd(category.id, level, tab, note), null, tab)}
              onCancelJob={cancel}
            />
            <AddByName key={tab} category={category} level={level} kind={tab} onAdded={onSaved} />
          </div>
          <ReviewFooter
            category={category}
            level={level}
            progress={progressLine(followed)}
            left={left}
            unreachable={misses >= MISSES_SHOWN}
            onSaved={onSaved}
          />
        </>
      )}
    </section>
  );
}

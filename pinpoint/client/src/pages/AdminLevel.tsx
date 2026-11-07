import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import { DISPLAY_NAME_MAX, FACT_MAX, PLACE_NAME_MAX } from '#shared/constants.js';
import { boxContains } from '#shared/geo.js';
import { draftBoxAndStyle } from '#shared/publish.js';
import type { Category, Difficulty, LatLng, Place, PlaceKind } from '#shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { PlaceMiniMap } from '../components/PlaceMiniMap.js';
import { categoriesChanged, LEVEL_LABELS, LEVELS } from '../lib/adminCategories.js';
import { loadCategory } from '../lib/adminCategory.js';
import {
  isTyping,
  placeChanges,
  placeWarnings,
  removePlace,
  reviewAction,
  reviewedContent,
  savePlace,
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

const SKELETON = 'rounded-card border border-line bg-board-panel motion-safe:animate-pulse';
const OUTSIDE = 'The pin must stay inside the box';
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

/** One place: what it is, its map and warnings, Edit and Remove; Edit opens the form in place. */
function PlaceCard({
  category,
  level,
  place,
  origin,
  onSaved,
  onRemoved,
}: {
  category: Category;
  level: Difficulty;
  place: Place;
  origin: LatLng | undefined;
  onSaved: (c: Category) => void;
  onRemoved: (c: Category) => void;
}) {
  const id = useId();
  const box = draftBoxAndStyle(category).box;
  const editRef = useRef<HTMLButtonElement>(null);
  const [form, setForm] = useState<Record<
    'name' | 'displayName' | 'fact' | 'lat' | 'lng',
    string
  > | null>(null);
  const [dropRefused, setDropRefused] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        className={`${CARD} scroll-mt-4 scroll-mb-40 p-4 md:p-6`}
      >
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-name`} className="text-xl font-bold break-words">
            {place.name}
          </h2>
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
        ) : (
          // The destructive action last (client.md).
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              ref={editRef}
              onClick={open}
              disabled={working}
              aria-label={`Edit ${place.name}`}
              aria-keyshortcuts="E"
              data-review-key="edit"
              className={BUTTON_SECONDARY}
            >
              Edit
            </button>
            <ConfirmButton
              label="Remove"
              confirmLabel="Confirm remove"
              ariaLabel={`Remove ${place.name}`}
              onConfirm={remove}
              disabled={working}
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

/** The footer that stays on screen: **Mark ‹level› reviewed** (or the mark and Unmark), and the keys. */
function ReviewFooter({
  category,
  level,
  onSaved,
}: {
  category: Category;
  level: Difficulty;
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
          <kbd className="font-semibold text-text">Delete</kbd> remove
        </p>
      </div>
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
 * place, Edit, Remove, warnings, the sticky footer and the keys J/K, E and Delete.
 */
export function AdminLevel() {
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

  function show(category: Category) {
    setAnswer({ key, kind: 'ready', category });
    setOrigins((known) => {
      const next = new Map(known);
      for (const l of LEVELS) {
        for (const p of reviewedContent(category, l)?.places ?? []) {
          const k = `${l}:${p.id}`;
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
                {inTab.map((place) => (
                  <PlaceCard
                    key={place.id}
                    category={category}
                    level={level}
                    place={place}
                    origin={origins.get(`${level}:${place.id}`)}
                    onSaved={onSaved}
                    onRemoved={(next) => {
                      focusAt.current = inTab.indexOf(place);
                      onSaved(next);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
          <ReviewFooter category={category} level={level} onSaved={onSaved} />
        </>
      )}
    </section>
  );
}

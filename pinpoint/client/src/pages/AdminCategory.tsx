import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { publishProblems } from '#shared/publish.js';
import type { Category, LabelStyle } from '#shared/types.js';
import { BoxEditor } from '../components/BoxEditor.js';
import { CategoryEmojiPicker } from '../components/CategoryEmojiPicker.js';
import { categoriesChanged, LEVEL_LABELS } from '../lib/adminCategories.js';
import {
  countsLine,
  deleteCategory,
  draftMeta,
  levelRows,
  loadCategory,
  publishCategory,
  publishedText,
  saveMeta,
  setCategoryEmoji,
  setCategoryHidden,
  type LevelRow,
} from '../lib/adminCategory.js';
import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CARD,
  INPUT,
  message,
} from '../lib/adminUi.js';

const SKELETON = 'rounded-card border border-line bg-board-panel motion-safe:animate-pulse';

const STYLES: [LabelStyle, string, string][] = [
  ['city', 'City', 'Osaka'],
  ['cityCountry', 'City, Country', 'Lima, Peru'],
];

/** City / City, Country (spec: City display text): saved at once, rewriting automatic names. */
function LabelStyleField({
  category,
  onSaved,
}: {
  category: Category;
  onSaved: (c: Category) => void;
}) {
  const style = draftMeta(category).labelStyle;
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);

  async function choose(next: LabelStyle) {
    if (saving) return; // the radios stay enabled so focus stays put
    setSaving(true);
    setStatus(null);
    try {
      onSaved(await saveMeta(category.id, { labelStyle: next }));
      setStatus({
        error: false,
        text: `Label style set to ${STYLES.find(([v]) => v === next)![1]}.`,
      });
    } catch (err) {
      setStatus({ error: true, text: message(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="style-heading" className={CARD}>
      <h2 id="style-heading" className="text-xl font-bold">
        Label style
      </h2>
      <div role="radiogroup" aria-labelledby="style-heading" className="flex flex-wrap gap-6">
        {STYLES.map(([value, label, example]) => (
          <label key={value} className="flex min-h-12 items-center gap-3 font-semibold">
            <input
              type="radio"
              name="label-style"
              value={value}
              checked={style === value}
              onChange={() => void choose(value)}
              className="size-5 accent-amber"
            />
            {label} <span className="font-normal text-text-dim">“{example}”</span>
          </label>
        ))}
      </div>
      <p className="text-text-dim">
        Changing it rewrites every city name the admin has not edited.
      </p>
      {status && (
        <p role={status.error ? 'alert' : 'status'} className={status.error ? 'text-delayed' : ''}>
          {status.text}
        </p>
      )}
    </section>
  );
}

const STATE_TEXT: Record<LevelRow['state'], string> = {
  live: 'Live',
  draft: 'Draft',
  missing: 'Not generated',
};

/** One level: its state, live and draft counts per mode, review mark and Review link. */
function LevelItem({ categoryId, row }: { categoryId: string; row: LevelRow }) {
  const name = LEVEL_LABELS[row.level];
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-lg font-bold">
          {name} <span className="font-semibold text-text-dim">· {STATE_TEXT[row.state]}</span>
          {row.reviewed !== null && (
            <span className={row.reviewed ? 'font-semibold text-amber' : 'font-semibold'}>
              {' '}
              · {row.reviewed ? 'Reviewed' : 'Not reviewed'}
            </span>
          )}
        </h3>
        {row.live && <p className="text-text-dim tabular-nums">Live: {countsLine(row.live)}</p>}
        {row.draft && <p className="text-text-dim tabular-nums">Draft: {countsLine(row.draft)}</p>}
      </div>
      {/* SPEC-QUESTION: DECISIONS 41 (Regenerate and Generate come with generation, M5) */}
      {row.state !== 'missing' && (
        <Link
          to={`/admin/categories/${encodeURIComponent(categoryId)}/${row.level}`}
          aria-label={`Review ${name}`}
          className={BUTTON_SECONDARY}
        >
          Review
        </Link>
      )}
    </li>
  );
}

/** **Publish ‹name›**, enabled only when the shared Publish rule finds nothing; else the reasons. */
function PublishField({ category }: { category: Category }) {
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = publishProblems(category);

  function publish() {
    setWorking(true);
    setError(null);
    publishCategory(category.id).then(
      ({ levels }) => {
        categoriesChanged();
        void navigate('/admin', { state: { notice: publishedText(category.name, levels) } });
      },
      (err: unknown) => {
        setWorking(false);
        setError(message(err));
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={publish}
        disabled={working || problems.length > 0}
        aria-describedby={problems.length > 0 ? 'publish-problems' : undefined}
        className={`${BUTTON_PRIMARY} self-start`}
      >
        {working ? 'Publishing…' : `Publish ${category.name}`}
      </button>
      {problems.length > 0 && (
        <ul id="publish-problems" className="flex flex-col gap-1 text-text-dim">
          {problems.map((p) => (
            <li key={p}>{p}.</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-delayed">
          {error}
        </p>
      )}
    </div>
  );
}

/** **Hide from hosts** / **Show to hosts**, then **Delete**, confirmed by typing the name. */
function ManageField({
  category,
  onSaved,
}: {
  category: Category;
  onSaved: (c: Category) => void;
}) {
  const navigate = useNavigate();
  const id = useId();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim() === category.name;

  function failed(err: unknown) {
    setWorking(false);
    setError(message(err));
  }

  function toggleHidden() {
    setWorking(true);
    setError(null);
    setCategoryHidden(category.id, !category.hidden).then((next) => {
      setWorking(false);
      onSaved(next);
      categoriesChanged();
    }, failed);
  }

  function remove(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || working) return;
    setWorking(true);
    setError(null);
    deleteCategory(category.id).then(() => {
      categoriesChanged();
      void navigate('/admin', { state: { notice: `${category.name} deleted.` } });
    }, failed);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The destructive action last (client.md). */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={toggleHidden}
          disabled={working}
          className={BUTTON_SECONDARY}
        >
          {category.hidden ? 'Show to hosts' : 'Hide from hosts'}
        </button>
        <button
          type="button"
          ref={deleteRef}
          onClick={() => setDeleting(true)}
          disabled={working}
          aria-expanded={deleting}
          aria-controls={deleting ? `${id}-delete` : undefined}
          className={BUTTON_DANGER}
        >
          Delete
        </button>
      </div>
      {/* Always one line, so Hide and Show don't move the page. */}
      <p className="text-text-dim">
        {category.hidden
          ? 'Hidden: hosts don’t see it in the lobby. A game already using it plays on.'
          : 'Shown to hosts in the lobby while a level is live.'}
      </p>
      {deleting && (
        <form id={`${id}-delete`} onSubmit={remove} className="flex flex-col gap-2" noValidate>
          <label htmlFor={`${id}-name`} className="font-semibold">
            Type “{category.name}” to delete it and every level. This can’t be undone.
          </label>
          <input
            id={`${id}-name`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            disabled={working}
            className={INPUT}
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={!confirmed || working} className={BUTTON_DANGER}>
              Delete {category.name}
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleting(false);
                setTyped('');
                deleteRef.current?.focus();
              }}
              disabled={working}
              className={BUTTON_SECONDARY}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-delayed">
          {error}
        </p>
      )}
    </div>
  );
}

type Load = { kind: 'failed'; error: string } | { kind: 'ready'; category: Category };

/** `/admin/categories/:id` (spec: Category page): emoji, box editor, label style, levels, Publish, Hide and Delete. */
export function AdminCategory() {
  const { id = '' } = useParams();
  const [attempt, setAttempt] = useState(0);
  // Keyed by what was asked, so a new id or a retry shows Loading… until its answer.
  const key = `${id}#${attempt}`;
  const [answer, setAnswer] = useState<(Load & { key: string }) | null>(null);
  const load: Load | { kind: 'loading' } = answer?.key === key ? answer : { kind: 'loading' };

  useEffect(() => {
    let current = true;
    loadCategory(id).then(
      (category) => current && setAnswer({ key, kind: 'ready', category }),
      (err: unknown) => current && setAnswer({ key, kind: 'failed', error: message(err) }),
    );
    return () => {
      current = false;
    };
  }, [id, key]);

  if (load.kind === 'loading') {
    // Skeletons the size of the heading, map and fields, so the page doesn't jump when it loads.
    return (
      <div role="status" aria-label="Loading the category" className="flex flex-col gap-6">
        <div className={`${SKELETON} h-9 w-48`} />
        <div className={`${SKELETON} h-72 lg:h-96`} />
        <div className={`${SKELETON} h-12`} />
      </div>
    );
  }
  if (load.kind === 'failed') {
    return (
      <section aria-labelledby="page-heading" className="flex flex-col gap-4">
        <h1 id="page-heading" className="text-3xl font-bold">
          Category
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
  const onSaved = (next: Category) => setAnswer({ key, kind: 'ready', category: next });
  return (
    <section aria-labelledby="page-heading" className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <CategoryEmojiPicker
          name={category.name}
          emoji={category.emoji}
          onSave={(emoji) =>
            setCategoryEmoji(category.id, emoji).then((next) => {
              onSaved(next);
              categoriesChanged();
            })
          }
        />
        <h1 id="page-heading" className="min-w-0 text-3xl font-bold break-words">
          {category.name}
        </h1>
      </div>
      <BoxEditor category={category} onSaved={onSaved} />
      <LabelStyleField category={category} onSaved={onSaved} />
      <section aria-labelledby="levels-heading" className={CARD}>
        <h2 id="levels-heading" className="text-xl font-bold">
          Levels
        </h2>
        <ul aria-labelledby="levels-heading" className="flex flex-col gap-4">
          {levelRows(category).map((row) => (
            <LevelItem key={row.level} categoryId={category.id} row={row} />
          ))}
        </ul>
        <PublishField category={category} />
      </section>
      <ManageField category={category} onSaved={onSaved} />
    </section>
  );
}

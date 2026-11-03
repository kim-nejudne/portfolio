import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type {
  AdminCategoriesResponse,
  AdminCategory as Category,
  GenerateJob,
} from '../../../shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import {
  deleteCategory,
  levelRoute,
  loadCategories,
  publishCategory,
  regenerateSet,
  setCategoryHidden,
} from '../lib/adminCategories.js';
import {
  countText,
  draftLevels,
  findCategory,
  jobProgress,
  levelName,
  publishedText,
  rowName,
  rowsOf,
  runningJob,
  type LevelStatus,
  type Row,
} from '../lib/adminCategoryView.js';
import { blockedBy } from '../lib/generationJob.js';
import { useJobPolling } from '../lib/useJobPolling.js';
import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  BUTTON_SMALL,
  CARD,
  LINK,
  PILL,
} from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const generateRoute = (jobId: string) => `/admin/generate?job=${encodeURIComponent(jobId)}`;

const STATUS_TEXT: Record<LevelStatus, string> = {
  live: 'Live',
  draft: 'Draft',
  new: 'New',
  generating: 'Generating',
  failed: 'Failed',
};

const STATUS_CLASS: Record<LevelStatus, string> = {
  live: 'border-win text-win',
  draft: 'text-accent',
  new: 'text-accent',
  generating: 'text-muted',
  failed: 'border-buzz text-buzz',
};

const pill = (extra: string) => `${PILL} px-2 text-sm whitespace-nowrap ${extra}`;

interface LevelRowProps {
  category: string;
  row: Row;
  /** Why Regenerate cannot start now (another job runs, no key, the day's cap), or null. */
  regenerateOff: boolean;
  onRegenerate: (setId: string) => void;
}

/**
 * One level (ADM-07, ADM-08): its name, count, state and, for a draft, its review mark. A draft
 * links to its level review; a level with a difficulty has **Regenerate**.
 */
function LevelRow({ category, row, regenerateOff, onRegenerate }: LevelRowProps) {
  const name = rowName(row);
  const level = row.kind === 'set' ? row.level : null;
  const draft = level !== null && level.status !== 'live';
  const short = level !== null && level.wanted !== null && level.questions < level.wanted;

  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${CARD} p-4`}>
      {draft ? (
        <Link to={levelRoute(category, level.setId)} className={`${LINK} font-display text-xl`}>
          {name}
        </Link>
      ) : (
        <span className="font-display text-xl">{name}</span>
      )}
      {level &&
        (short ? (
          <span>
            {countText(level)}{' '}
            <span className="font-bold text-warn">⚠ {level.wanted! - level.questions} short</span>
          </span>
        ) : (
          <span className="text-muted">{countText(level)}</span>
        ))}
      <span className={pill(STATUS_CLASS[row.status])}>{STATUS_TEXT[row.status]}</span>
      {draft && (
        <span className={pill(level.reviewed ? 'border-win text-win' : 'text-muted')}>
          {level.reviewed ? 'Reviewed' : 'Not reviewed'}
        </span>
      )}
      {level?.difficulty && (
        <span className="ml-auto">
          <ConfirmButton
            label="Regenerate"
            confirmLabel="Write it again"
            ariaLabel={`Regenerate ${name}`}
            onConfirm={() => onRegenerate(level.setId)}
            disabled={regenerateOff}
            className={BUTTON_SMALL}
          />
        </span>
      )}
    </li>
  );
}

type PageError = { text: string; problems?: string[]; setId?: string };

interface CategoryPageProps {
  category: Category;
  generation: AdminCategoriesResponse['generation'];
  onChanged: () => void;
}

/**
 * The category's page (F120): every level with Regenerate, **Publish <name>** while it has drafts
 * (once each is reviewed), **Hide from hosts** or **Show to hosts** (F126), and **Delete** last.
 * A running generation of it shows its progress, followed every 2 s, and the page reads the
 * category again when it ends.
 */
function CategoryPage({ category, generation, onChanged }: CategoryPageProps) {
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<PageError | null>(null);
  const [polled, setPolled] = useState<GenerateJob | null>(null);
  const rows = rowsOf(category);
  const drafts = draftLevels(category);
  const waiting = drafts.filter((l) => !l.reviewed);
  const running = runningJob(category);
  // One job runs at a time: while another category's generation runs, Regenerate waits for it.
  const followed = running ?? generation.running;
  const shown = followed && polled?.id === followed.id ? polled : followed;
  const blocked = blockedBy(generation);
  const regenerateOff = working || followed !== null || blocked !== null;

  useJobPolling(followed?.id ?? null, setPolled, onChanged);

  function failed(err: unknown) {
    setWorking(false);
    setError({ text: message(err) });
    onChanged();
  }

  function publish() {
    setWorking(true);
    setError(null);
    publishCategory(category.name).then((result) => {
      if (result.ok) {
        void navigate('/admin', {
          state: { published: publishedText(category.name, result.published) },
        });
        return;
      }
      setWorking(false);
      setError({ text: result.error, problems: result.problems, setId: result.setId });
      onChanged();
    }, failed);
  }

  function regenerate(setId: string) {
    setWorking(true);
    setError(null);
    regenerateSet(setId).then(
      (jobId) => void navigate(generateRoute(jobId)),
      (err: unknown) => {
        setWorking(false);
        setError({ text: message(err) });
      },
    );
  }

  function toggleHidden() {
    setWorking(true);
    setError(null);
    setCategoryHidden(category.name, !category.hidden).then(() => {
      setWorking(false);
      onChanged();
    }, failed);
  }

  function remove() {
    setWorking(true);
    setError(null);
    deleteCategory(category.name).then(() => void navigate('/admin'), failed);
  }

  const sets = category.levels.length;

  return (
    <>
      <h1 className="font-display text-3xl break-words">{category.name}</h1>
      {category.hidden && (
        <p className="text-lg text-muted">
          <span className={pill('text-muted')}>Hidden</span> Hosts do not see its sets. A game
          already using one plays on.
        </p>
      )}
      {running && shown && (
        <p className={`${CARD} flex flex-col gap-1 p-4 text-lg`}>
          <Link to={generateRoute(running.id)} className={`${LINK} font-bold text-ink`}>
            Generating {category.name}
          </Link>
          <span className="text-muted">
            {jobProgress(shown)}
            {drafts.length > 0 && ' · Publish waits until it is done.'}
          </span>
        </p>
      )}
      {followed && !running && (
        <p className="text-muted">
          Generating {followed.category}. Regenerate waits until it is done.
        </p>
      )}
      {rows.length > 0 && (
        <ul aria-label="Levels" className="flex flex-col gap-3">
          {rows.map((row) => (
            <LevelRow
              key={row.kind === 'set' ? row.level.setId : `pending-${row.difficulty}`}
              category={category.name}
              row={row}
              regenerateOff={regenerateOff}
              onRegenerate={regenerate}
            />
          ))}
        </ul>
      )}
      {category.job?.state === 'failed' && category.job.error && (
        <p className="text-buzz">{category.job.error}</p>
      )}
      {blocked && <p className="text-muted">{blocked}</p>}
      {drafts.length > 0 && (
        <div className="flex flex-col gap-2">
          <ConfirmButton
            label={`Publish ${category.name}`}
            confirmLabel={`Publish ${drafts.length} ${drafts.length === 1 ? 'set' : 'sets'}`}
            onConfirm={publish}
            disabled={working || running !== null || waiting.length > 0}
            className={`${BUTTON_PRIMARY} text-2xl`}
            armedClassName="flex flex-col gap-2 sm:flex-row"
            cancelClassName={BUTTON_SECONDARY}
          />
          {waiting.length > 0 && (
            <p className="text-muted">
              Mark every level reviewed to publish. Not reviewed yet:{' '}
              {waiting.map(levelName).join(', ')}.
            </p>
          )}
          {working && <p className="text-muted">Working…</p>}
        </div>
      )}
      {error && (
        <div role="alert" className="flex flex-col gap-1 text-buzz">
          <p>{error.text}</p>
          {error.problems && (
            <ul className="list-disc pl-6">
              {error.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {error.setId && (
            <Link to={levelRoute(category.name, error.setId)} className={LINK}>
              Open its list
            </Link>
          )}
        </div>
      )}
      {/* The destructive action last (client.md). */}
      <div className="flex flex-wrap gap-3">
        {sets > 0 && (
          <button
            type="button"
            onClick={toggleHidden}
            disabled={working}
            className={BUTTON_SECONDARY}
          >
            {category.hidden ? 'Show to hosts' : 'Hide from hosts'}
          </button>
        )}
        <ConfirmButton
          label="Delete"
          confirmLabel={sets === 0 ? 'Clear it' : `Delete ${sets} ${sets === 1 ? 'set' : 'sets'}`}
          ariaLabel={`Delete ${category.name}`}
          onConfirm={remove}
          disabled={working || running !== null}
          className={BUTTON_DANGER}
          cancelClassName={BUTTON_SMALL}
        />
      </div>
    </>
  );
}

function CategoryLoader({ name }: { name: string }) {
  // undefined while loading; `category` null once loaded without it.
  const [data, setData] = useState<
    { category: Category | null; generation: AdminCategoriesResponse['generation'] } | undefined
  >(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    loadCategories().then(
      (next) => {
        if (!live) return;
        setLoadError(null);
        setData({ category: findCategory(next.categories, name), generation: next.generation });
      },
      (err: unknown) => {
        if (live) setLoadError(message(err));
      },
    );
    return () => {
      live = false;
    };
  }, [name, attempt]);

  if (data === undefined) {
    return loadError ? (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl break-words">{name}</h1>
        <p role="alert" className="text-lg text-buzz">
          {loadError}
        </p>
        <button type="button" onClick={reload} className={BUTTON_SECONDARY}>
          Retry
        </button>
      </div>
    ) : (
      <p className="text-lg text-muted">Loading…</p>
    );
  }
  if (data.category === null) {
    return (
      <>
        <h1 className="font-display text-3xl">Category</h1>
        <p className="text-lg">There is no category with this name.</p>
        <Link to="/admin" className={`${LINK} text-lg`}>
          Back to Admin
        </Link>
      </>
    );
  }
  return <CategoryPage category={data.category} generation={data.generation} onChanged={reload} />;
}

/**
 * `/admin/categories/:name` (F116, F120): the category's one page, opened from its list row.
 * Inside `AdminLayout`, which lets only the signed-in admin through (F119).
 */
export function AdminCategory() {
  const { name = '' } = useParams();
  return <CategoryLoader key={name} name={name} />;
}

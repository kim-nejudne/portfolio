import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DIFFICULTIES, DIFFICULTY_LABELS } from '../../../shared/constants.js';
import type { AdminCategory, AdminCategoryLevel } from '../../../shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import {
  categoryKey,
  levelRoute,
  loadCategories,
  publishCategory,
} from '../lib/adminCategories.js';
import { ended } from '../lib/generationJob.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, LINK, PILL } from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The dashboard's line after a category publish: `location.state.published` on `/admin`. */
export function publishedText(name: string, published: number): string {
  return `${name} is live: ${published} ${published === 1 ? 'set' : 'sets'} published.`;
}

/** A level's name on its card: its difficulty, or the set's title when it has none. */
function levelName(level: AdminCategoryLevel): string {
  return level.difficulty
    ? DIFFICULTY_LABELS[level.difficulty]
    : level.title.trim() || 'Untitled set';
}

/** The category's drafts, Easy, Medium, Hard, then any without a difficulty by title. */
export function draftLevels(category: AdminCategory): AdminCategoryLevel[] {
  const rank = (l: AdminCategoryLevel) =>
    l.difficulty === null ? DIFFICULTIES.length : DIFFICULTIES.indexOf(l.difficulty);
  return category.levels
    .filter((l) => l.status !== 'live')
    .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}

function LevelCard({ category, level }: { category: string; level: AdminCategoryLevel }) {
  const short = level.wanted !== null && level.questions < level.wanted;
  return (
    <li>
      <Link
        to={levelRoute(category, level.setId)}
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${CARD} p-4 hover:border-accent`}
      >
        <span className="mr-auto font-display text-xl">{levelName(level)}</span>
        {short ? (
          <span>
            {level.questions} of {level.wanted}{' '}
            <span className="font-bold text-warn">⚠ {level.wanted! - level.questions} short</span>
          </span>
        ) : (
          <span className="text-muted">
            {level.questions} {level.questions === 1 ? 'question' : 'questions'}
          </span>
        )}
        <span
          className={
            level.reviewed
              ? 'rounded-full border-2 border-win bg-surface px-2 text-sm text-win'
              : `${PILL} px-2 text-sm text-muted`
          }
        >
          {level.reviewed ? 'Reviewed' : 'Not reviewed'}
        </span>
      </Link>
    </li>
  );
}

type PublishError = { text: string; problems?: string[]; setId?: string };

function Review({ category, onChanged }: { category: AdminCategory; onChanged: () => void }) {
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<PublishError | null>(null);
  const drafts = draftLevels(category);
  const waiting = drafts.filter((l) => !l.reviewed);
  const generating = category.job !== null && !ended(category.job);

  function publish() {
    setWorking(true);
    setError(null);
    publishCategory(category.name).then(
      (result) => {
        if (result.ok) {
          navigate('/admin', {
            state: { published: publishedText(category.name, result.published) },
          });
          return;
        }
        setWorking(false);
        setError({ text: result.error, problems: result.problems, setId: result.setId });
        onChanged();
      },
      (err: unknown) => {
        setWorking(false);
        setError({ text: message(err) });
        onChanged();
      },
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl">Review {category.name}</h1>
      {generating && category.job && (
        <p className={`${CARD} p-4 text-lg`}>
          <Link
            to={`/admin/generate?job=${encodeURIComponent(category.job.id)}`}
            className={`${LINK} font-bold text-ink`}
          >
            Generating {category.name}
          </Link>
          <span className="text-muted"> · Publish waits until it is done.</span>
        </p>
      )}
      {drafts.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-lg text-muted">Nothing to review.</p>
          <Link to="/admin" className={`${LINK} text-lg`}>
            Back to Admin
          </Link>
        </div>
      ) : (
        <>
          <ul aria-label="Levels" className="flex flex-col gap-3">
            {drafts.map((level) => (
              <LevelCard key={level.setId} category={category.name} level={level} />
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <ConfirmButton
              label={`Publish ${category.name}`}
              confirmLabel={`Publish ${drafts.length} ${drafts.length === 1 ? 'set' : 'sets'}`}
              onConfirm={publish}
              disabled={working || generating || waiting.length > 0}
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
            {working && <p className="text-muted">Publishing…</p>}
          </div>
        </>
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
    </>
  );
}

function CategoryReview({ name }: { name: string }) {
  // undefined while loading; null once loaded without the category.
  const [category, setCategory] = useState<AdminCategory | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    loadCategories().then(
      (data) => {
        if (!live) return;
        setLoadError(null);
        setCategory(data.categories.find((c) => categoryKey(c.name) === categoryKey(name)) ?? null);
      },
      (err: unknown) => {
        if (live) setLoadError(message(err));
      },
    );
    return () => {
      live = false;
    };
  }, [name, attempt]);

  if (category === undefined) {
    return loadError ? (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl">Review {name}</h1>
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
  if (category === null) {
    return (
      <>
        <h1 className="font-display text-3xl">Review</h1>
        <p className="text-lg">There is no category with this name.</p>
        <Link to="/admin" className={`${LINK} text-lg`}>
          Back to Admin
        </Link>
      </>
    );
  }
  return <Review category={category} onChanged={reload} />;
}

/**
 * `/admin/categories/:name` (F116): a card per draft level with its count and review state, each
 * leading to the level's list, and **Publish <name>** once every level is reviewed. Inside
 * `AdminLayout`, which lets only the signed-in admin through (F119).
 */
export function AdminCategory() {
  const { name = '' } = useParams();
  return <CategoryReview key={name} name={name} />;
}

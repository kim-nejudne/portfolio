import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { Category, LabelStyle } from '#shared/types.js';
import { BoxEditor } from '../components/BoxEditor.js';
import { draftMeta, loadCategory, saveMeta } from '../lib/adminCategory.js';
import { BUTTON_SECONDARY, CARD, message } from '../lib/adminUi.js';

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

type Load = { kind: 'failed'; error: string } | { kind: 'ready'; category: Category };

/** `/admin/categories/:id` (spec: Category page): the box editor and label style. Levels, Publish, Hide, Delete and the emoji are F33's. */
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
      <h1 id="page-heading" className="text-3xl font-bold">
        {category.emoji && <span aria-hidden>{category.emoji} </span>}
        {category.name}
      </h1>
      <BoxEditor category={category} onSaved={onSaved} />
      <LabelStyleField category={category} onSaved={onSaved} />
    </section>
  );
}

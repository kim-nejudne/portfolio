import { useState, type FormEvent } from 'react';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  GENERATE_COUNT_DEFAULT,
  GENERATE_COUNT_MAX,
  GENERATE_COUNT_MIN,
  GENERATE_GUIDANCE_MAX,
  SET_CATEGORY_MAX,
} from '../../../shared/constants.js';
import type { Difficulty } from '../../../shared/types.js';
import { startGeneration } from '../lib/adminCategories.js';
import { BUTTON_PRIMARY, CARD, FIELD, LABEL } from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

interface LevelInput {
  on: boolean;
  count: string;
}

type LevelInputs = Record<Difficulty, LevelInput>;

const freshLevels = (): LevelInputs => ({
  easy: { on: true, count: String(GENERATE_COUNT_DEFAULT) },
  medium: { on: true, count: String(GENERATE_COUNT_DEFAULT) },
  hard: { on: true, count: String(GENERATE_COUNT_DEFAULT) },
});

/** The first thing wrong with the form, or null when it can be sent. */
export function formProblem(name: string, guidance: string, levels: LevelInputs): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'Enter a category name.';
  if (trimmed.length > SET_CATEGORY_MAX) {
    return `The name can be at most ${SET_CATEGORY_MAX} characters.`;
  }
  if (guidance.trim().length > GENERATE_GUIDANCE_MAX) {
    return `The guidance can be at most ${GENERATE_GUIDANCE_MAX} characters.`;
  }
  const ticked = DIFFICULTIES.filter((d) => levels[d].on);
  if (ticked.length === 0) return 'Tick at least one level.';
  for (const d of ticked) {
    const text = levels[d].count.trim();
    const count = Number(text);
    if (!/^\d+$/.test(text) || count < GENERATE_COUNT_MIN || count > GENERATE_COUNT_MAX) {
      return `${DIFFICULTY_LABELS[d]} needs ${GENERATE_COUNT_MIN}–${GENERATE_COUNT_MAX} questions.`;
    }
  }
  return null;
}

interface AddCategoryFormProps {
  names: string[];
  /** Why the form is off, or null when a generation can start. */
  blocked: string | null;
  onStarted: (jobId: string) => void;
}

/**
 * Add category (F111): a name, optional guidance and the levels with their counts. It is the page
 * heading of `/admin/generate` (F115), which moved it off the dashboard unchanged in look.
 */
export function AddCategoryForm({ names, blocked, onStarted }: AddCategoryFormProps) {
  const [name, setName] = useState('');
  const [guidance, setGuidance] = useState('');
  const [levels, setLevels] = useState<LevelInputs>(freshLevels);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const off = blocked !== null || sending;

  const setLevel = (d: Difficulty, change: Partial<LevelInput>) =>
    setLevels((current) => ({ ...current, [d]: { ...current[d], ...change } }));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (off) return;
    const problem = formProblem(name, guidance, levels);
    if (problem) return setError(problem);
    setError(null);
    setSending(true);
    const body = {
      category: name.trim(),
      ...(guidance.trim() ? { guidance: guidance.trim() } : {}),
      levels: DIFFICULTIES.filter((d) => levels[d].on).map((difficulty) => ({
        difficulty,
        count: Number(levels[difficulty].count),
      })),
    };
    startGeneration(body).then(
      (jobId) => {
        setSending(false);
        onStarted(jobId);
      },
      (err: unknown) => {
        setSending(false);
        setError(message(err));
      },
    );
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby="add-category-heading"
      noValidate
      className={`flex flex-col gap-4 ${CARD}`}
    >
      <h1 id="add-category-heading" className="font-display text-2xl">
        Add category
      </h1>
      {blocked && <p className="text-lg text-muted">{blocked}</p>}
      <fieldset disabled={off} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            list="admin-category-names"
            maxLength={SET_CATEGORY_MAX}
            autoComplete="off"
            className={FIELD}
          />
        </label>
        <datalist id="admin-category-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Guidance (optional)</span>
          <textarea
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            maxLength={GENERATE_GUIDANCE_MAX}
            rows={3}
            placeholder="For example: rivers of Europe and Asia, no trick questions"
            className={FIELD}
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className={`${LABEL} mb-2`}>Levels</legend>
          {DIFFICULTIES.map((d) => (
            <div key={d} className="flex items-center gap-3">
              <label className="flex min-h-11 min-w-28 items-center gap-2 text-lg">
                <input
                  type="checkbox"
                  checked={levels[d].on}
                  onChange={(event) => setLevel(d, { on: event.target.checked })}
                  className="size-5"
                />
                {DIFFICULTY_LABELS[d]}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={GENERATE_COUNT_MIN}
                max={GENERATE_COUNT_MAX}
                value={levels[d].count}
                onChange={(event) => setLevel(d, { count: event.target.value })}
                disabled={!levels[d].on}
                aria-label={`${DIFFICULTY_LABELS[d]} questions`}
                className={`${FIELD} w-24`}
              />
              <span className="text-muted">questions</span>
            </div>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-lg text-buzz">
            {error}
          </p>
        )}
        <button type="submit" className={`${BUTTON_PRIMARY} text-xl`}>
          {sending ? 'Starting…' : 'Generate'}
        </button>
      </fieldset>
    </form>
  );
}

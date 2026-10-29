import { useMemo, useState, type ReactNode } from 'react';
import { DIFFICULTIES, MAX_QUESTIONS_PER_SET } from '../../../shared/constants.js';
import type { QuestionSet } from '../../../shared/types.js';
import {
  buildGame,
  builderCategories,
  GAME_LIMIT_MESSAGE,
  NO_MATCH_MESSAGE,
  PICK_COUNT_MAX,
  pickCounts,
  type DifficultyPick,
  type GamePick,
} from '../lib/gameBuilder.js';
import type { LoadImage } from '../lib/hostRoom.js';
import { HOVER } from '../lib/hover.js';
import { DIFFICULTY_LABELS, questionCount } from '../lib/setLabels.js';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '../lib/ui.js';

/** A built game and where its pictures come from, for `hostSet` or `hostNextSet`. */
export interface BuiltGame {
  set: QuestionSet;
  loadImage: LoadImage;
}

interface GameBuilderProps {
  /** The sets to draw from: this browser's and the built-ins. Drafts are skipped. */
  sources: readonly QuestionSet[];
  /** "Host this game", or "Start new game" in the New game picker. */
  hostLabel: string;
  /** Shown on the host button while `onHost` runs. */
  hostingLabel: string;
  /** Hosts the game. A thrown Error's message shows under the buttons. */
  onHost: (game: BuiltGame) => Promise<void>;
  /** After **Save to My sets** stored the game. */
  onSaved: (saved: QuestionSet) => void;
  /** Back to the set list. */
  onBack: () => void;
  /** Between the total and the buttons, such as the New game picker's Keep scores. */
  children?: ReactNode;
  /** The shuffle's random source; tests pass a seeded one. */
  random?: () => number;
}

interface Row extends GamePick {
  key: number;
}

const DEFAULT_COUNT = 5;

const COUNTS = Array.from({ length: PICK_COUNT_MAX }, (_, i) => i + 1);

const DIFFICULTY_PICKS: readonly DifficultyPick[] = ['any', ...DIFFICULTIES];

const PICK_LABELS: Record<DifficultyPick, string> = { any: 'Any difficulty', ...DIFFICULTY_LABELS };

const field =
  'min-h-11 w-full rounded-xl border-2 border-edge bg-bg px-3 py-2 text-lg text-ink disabled:opacity-40';

const smallButton = `min-h-11 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-base font-bold transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`;

/**
 * **Build a game** (DECISIONS F57): rows of category, difficulty and count, a running total, then
 * host the drawn questions or save them to My sets. Each action draws afresh.
 */
export function GameBuilder({
  sources,
  hostLabel,
  hostingLabel,
  onHost,
  onSaved,
  onBack,
  children,
  random = Math.random,
}: GameBuilderProps) {
  const categories = useMemo(() => builderCategories(sources), [sources]);
  const [nextKey, setNextKey] = useState(1);
  const [rows, setRows] = useState<Row[]>(() =>
    categories.length === 0
      ? []
      : [{ key: 0, category: categories[0]!, difficulty: 'any', count: DEFAULT_COUNT }],
  );
  const [busy, setBusy] = useState<'host' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => pickCounts(sources, rows), [sources, rows]);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const problem =
    total === 0 ? NO_MATCH_MESSAGE : total > MAX_QUESTIONS_PER_SET ? GAME_LIMIT_MESSAGE : null;

  function update(key: number, change: Partial<GamePick>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
    setError(null);
  }

  function addRow() {
    // The next category not yet on a row, so three taps give three categories.
    const used = new Set(rows.map((row) => row.category));
    const category = categories.find((c) => !used.has(c)) ?? categories[0]!;
    setRows([...rows, { key: nextKey, category, difficulty: 'any', count: DEFAULT_COUNT }]);
    setNextKey(nextKey + 1);
    setError(null);
  }

  function removeRow(key: number) {
    setRows(rows.filter((row) => row.key !== key));
    setError(null);
  }

  async function run(kind: 'host' | 'save') {
    const built = buildGame(sources, rows, { random });
    if (!built.ok) return setError(built.error);
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'host') {
        await onHost({ set: built.set, loadImage: built.loadImage });
      } else {
        onSaved(await saveGame(built.set, built.loadImage));
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const locked = busy !== null;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <p className="text-muted">
        Draw questions from the categories you choose. Each keeps its own points.
      </p>
      <ol className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        {rows.map((row, index) => {
          const number = index + 1;
          const got = counts[index] ?? 0;
          return (
            <li
              key={row.key}
              aria-label={`Row ${number}`}
              className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-xl border-2 border-edge p-3"
            >
              <select
                aria-label={`Category, row ${number}`}
                value={row.category}
                onChange={(event) => update(row.key, { category: event.target.value })}
                disabled={locked}
                className={`${field} col-span-3`}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Difficulty, row ${number}`}
                value={row.difficulty}
                onChange={(event) =>
                  update(row.key, {
                    difficulty:
                      DIFFICULTY_PICKS.find((pick) => pick === event.target.value) ?? 'any',
                  })
                }
                disabled={locked}
                className={field}
              >
                {DIFFICULTY_PICKS.map((pick) => (
                  <option key={pick} value={pick}>
                    {PICK_LABELS[pick]}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Questions, row ${number}`}
                value={row.count}
                onChange={(event) => update(row.key, { count: Number(event.target.value) })}
                disabled={locked}
                className={`${field} w-auto`}
              >
                {COUNTS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={locked}
                aria-label={`Remove row ${number}`}
                className={smallButton}
              >
                Remove
              </button>
              {got < row.count && (
                <p className="col-span-3 text-base text-buzz">
                  {got === 0 ? 'No questions match.' : `Only ${questionCount(got)} match.`}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={addRow}
        disabled={locked || categories.length === 0}
        className={`${smallButton} self-start`}
      >
        Add a row
      </button>
      <p className="font-display text-2xl" aria-live="polite">
        Total: {questionCount(total)}
      </p>
      {problem && rows.length > 0 && <p className="text-buzz">{problem}</p>}
      {children}
      <button
        type="button"
        onClick={() => void run('host')}
        disabled={locked || problem !== null}
        className={`${BUTTON_PRIMARY} shrink-0 text-2xl`}
      >
        {busy === 'host' ? hostingLabel : hostLabel}
      </button>
      <button
        type="button"
        onClick={() => void run('save')}
        disabled={locked || problem !== null}
        className={`${BUTTON_OUTLINE} shrink-0 text-xl`}
      >
        {busy === 'save' ? 'Saving…' : 'Save to My sets'}
      </button>
      {error && (
        <p role="alert" className="text-center text-buzz">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onBack}
        disabled={locked}
        className="min-h-11 shrink-0 text-lg text-muted underline underline-offset-4 hover:text-ink disabled:opacity-40"
      >
        Back to the sets
      </button>
    </div>
  );
}

/**
 * Stores a built game in My sets with its own copy of each picture, read from wherever its source
 * set keeps it (DECISIONS F57). Dexie loads only now, as in Host a game.
 */
async function saveGame(set: QuestionSet, loadImage: LoadImage): Promise<QuestionSet> {
  const images = new Map<string, Blob>();
  for (const [index, question] of set.questions.entries()) {
    if (question.imageId === undefined || images.has(question.imageId)) continue;
    const blob = await loadImage(question.imageId);
    if (!blob) throw new Error(`Question ${index + 1}'s image is missing from this browser.`);
    images.set(question.imageId, blob);
  }
  const { importSet } = await import('../lib/db.js');
  return importSet(
    set,
    [...images].map(([id, blob]) => ({ id, blob })),
  );
}

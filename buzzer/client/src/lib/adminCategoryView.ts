// What the admin's category list and category page read off `GET /api/admin/categories` (F111,
// F116, F120): a category's levels as rows (a set, or a level its job has not saved yet), each
// level's state, the list row's badge and order, and the texts both show.

import { DIFFICULTIES, DIFFICULTY_LABELS } from '../../../shared/constants.js';
import type {
  AdminCategory,
  AdminCategoryLevel,
  Difficulty,
  GenerateJob,
} from '../../../shared/types.js';
import { categoryKey } from './adminCategories.js';
import { cost, ended, levelText, STAGE_TEXT } from './generationJob.js';

export type LevelStatus = AdminCategoryLevel['status'] | 'generating' | 'failed';

/** One level: a set of the category, or a level its job has not saved (generating or failed). */
export type Row =
  | { kind: 'set'; level: AdminCategoryLevel; status: LevelStatus }
  | { kind: 'pending'; difficulty: Difficulty; status: 'generating' | 'failed' };

/** The category's generation, while it is queued or running. */
export const runningJob = (category: AdminCategory): GenerateJob | null =>
  category.job !== null && !ended(category.job) ? category.job : null;

const rank = (difficulty: Difficulty | null) =>
  difficulty === null ? DIFFICULTIES.length : DIFFICULTIES.indexOf(difficulty);

const rowDifficulty = (row: Row) => (row.kind === 'set' ? row.level.difficulty : row.difficulty);
const rowTitle = (row: Row) => (row.kind === 'set' ? row.level.title : '');

/** Every level of the category, Easy, Medium, Hard, then any without a difficulty by title. */
export function rowsOf(category: AdminCategory): Row[] {
  const job = category.job;
  const running = runningJob(category) !== null;
  const rows: Row[] = category.levels.map((level) => {
    // A regenerate writes over its set: the set's row shows it.
    const target = job?.kind === 'regenerate' && job.setId === level.setId;
    const status: LevelStatus = !target ? level.status : running ? 'generating' : 'failed';
    return { kind: 'set', level, status };
  });
  if (job?.kind === 'generate' && job.state !== 'done') {
    // The levels the job has not saved yet: all still to come, or the one that failed.
    const unsaved = job.levels.filter(
      (l) => !job.finished.some((f) => f.difficulty === l.difficulty),
    );
    const shown = running ? unsaved : unsaved.slice(0, 1);
    for (const { difficulty } of shown) {
      rows.push({ kind: 'pending', difficulty, status: running ? 'generating' : 'failed' });
    }
  }
  return rows.sort(
    (a, b) =>
      rank(rowDifficulty(a)) - rank(rowDifficulty(b)) || rowTitle(a).localeCompare(rowTitle(b)),
  );
}

/** A level's name on the category page: its difficulty, or the set's title when it has none. */
export function levelName(level: AdminCategoryLevel): string {
  return level.difficulty
    ? DIFFICULTY_LABELS[level.difficulty]
    : level.title.trim() || 'Untitled set';
}

export const rowName = (row: Row): string =>
  row.kind === 'set' ? levelName(row.level) : DIFFICULTY_LABELS[row.difficulty];

/** The category's drafts (new or draft), Easy, Medium, Hard, then any without a difficulty. */
export function draftLevels(category: AdminCategory): AdminCategoryLevel[] {
  return category.levels
    .filter((l) => l.status !== 'live')
    .sort((a, b) => rank(a.difficulty) - rank(b.difficulty) || a.title.localeCompare(b.title));
}

/** "15 questions", or "13 of 15" for a level its generation left short. */
export function countText(level: AdminCategoryLevel): string {
  if (level.wanted !== null && level.questions < level.wanted) {
    return `${level.questions} of ${level.wanted}`;
  }
  return questionsText(level.questions);
}

export const questionsText = (n: number) => `${n} ${n === 1 ? 'question' : 'questions'}`;

/** The dashboard's line after a category publish: `location.state.published` on `/admin`. */
export function publishedText(name: string, published: number): string {
  return `${name} is live: ${published} ${published === 1 ? 'set' : 'sets'} published.`;
}

/** "Writing the questions · Medium, level 2 of 3 · $0.04 so far". */
export function jobProgress(job: GenerateJob): string {
  const parts = [STAGE_TEXT[job.state]];
  const level = levelText(job);
  if (level) parts.push(level);
  parts.push(`${cost(job.usage.costUsd)} so far`);
  return parts.join(' · ');
}

// ---------- The list row (F120) ----------

/** A level's dot in the list row. */
export type DotState = 'live' | 'draft' | 'review' | 'generating' | 'failed';

export const DOT_TEXT: Record<DotState, string> = {
  live: 'live',
  draft: 'draft',
  review: 'needs review',
  generating: 'generating',
  failed: 'failed',
};

/** Live, a reviewed draft, a draft waiting for review, or a level its job is writing or failed. */
export function dotState(row: Row): DotState {
  if (row.status === 'generating' || row.status === 'failed' || row.status === 'live') {
    return row.status;
  }
  return row.kind === 'set' && !row.level.reviewed ? 'review' : 'draft';
}

export type Badge = 'Generating' | 'Failed' | 'Needs review';

/** The one badge of a list row, by urgency, or null for a category that needs nothing. */
export function categoryBadge(category: AdminCategory): Badge | null {
  if (runningJob(category)) return 'Generating';
  if (rowsOf(category).some((r) => r.status === 'failed')) return 'Failed';
  if (category.levels.some((l) => l.status !== 'live' && !l.reviewed)) return 'Needs review';
  return null;
}

/** Every question of the category, live and draft. */
export const totalQuestions = (category: AdminCategory): number =>
  category.levels.reduce((sum, l) => sum + l.questions, 0);

/** The list's order: categories with a badge first (ADM-03), then the rest, each by name. */
export function listOrder(categories: AdminCategory[]): AdminCategory[] {
  const byName = (a: AdminCategory, b: AdminCategory) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const flagged = categories.filter((c) => categoryBadge(c) !== null).sort(byName);
  const rest = categories.filter((c) => categoryBadge(c) === null).sort(byName);
  return [...flagged, ...rest];
}

/** The category named in the URL, whatever its case. */
export const findCategory = (categories: AdminCategory[], name: string) =>
  categories.find((c) => categoryKey(c.name) === categoryKey(name)) ?? null;

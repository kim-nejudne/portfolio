import { describe, expect, it } from 'vitest';
import type { AdminCategory } from '../../../shared/types.js';
import { RIVERS, job, level } from '../test/adminServer.js';
import {
  categoryBadge,
  countText,
  dotState,
  draftLevels,
  findCategory,
  jobProgress,
  levelName,
  listOrder,
  publishedText,
  rowName,
  rowsOf,
  totalQuestions,
} from './adminCategoryView.js';

const cat = (name: string, overrides: Partial<AdminCategory> = {}): AdminCategory => ({
  name,
  levels: [level({ setId: `${name}-e`, title: `${name} – Easy` })],
  job: null,
  hidden: false,
  emoji: null,
  ...overrides,
});

describe('rowsOf', () => {
  it('orders the levels Easy, Medium, Hard, then those without a difficulty by title', () => {
    const c = cat('Rivers', {
      levels: [
        level({ setId: 'z', title: 'Zed', difficulty: null }),
        level({ setId: 'h', difficulty: 'hard' }),
        level({ setId: 'a', title: 'Alpha', difficulty: null }),
        level({ setId: 'e', difficulty: 'easy' }),
      ],
    });
    expect(rowsOf(c).map(rowName)).toEqual(['Easy', 'Hard', 'Alpha', 'Zed']);
  });

  it('adds the levels a running generation has not saved, as generating', () => {
    const running = job({
      category: 'Moons',
      levels: [
        { difficulty: 'easy', count: 15 },
        { difficulty: 'medium', count: 15 },
        { difficulty: 'hard', count: 15 },
      ],
      finished: [
        { difficulty: 'medium', setId: 'm-m', title: 'Moons – Medium', questions: 15, count: 15 },
      ],
    });
    const c = cat('Moons', {
      levels: [level({ setId: 'm-m', difficulty: 'medium', status: 'new', reviewed: false })],
      job: running,
    });
    expect(rowsOf(c).map((r) => [rowName(r), r.status])).toEqual([
      ['Easy', 'generating'],
      ['Medium', 'new'],
      ['Hard', 'generating'],
    ]);
  });

  it('shows the one level a failed generation stopped on, and marks a regenerated set', () => {
    const failed = job({ state: 'failed', currentLevel: null });
    expect(rowsOf(cat('Moons', { levels: [], job: failed })).map((r) => r.status)).toEqual([
      'failed',
    ]);
    const regen = job({ kind: 'regenerate', setId: 'riv-m', category: 'Rivers' });
    expect(rowsOf({ ...RIVERS, job: regen }).map((r) => r.status)).toEqual([
      'live',
      'generating',
      'draft',
    ]);
    expect(rowsOf({ ...RIVERS, job: { ...regen, state: 'failed' } }).map((r) => r.status)).toEqual([
      'live',
      'failed',
      'draft',
    ]);
  });
});

describe('dotState', () => {
  it('reads live, draft, needs review, generating and failed', () => {
    const c = cat('Rivers', {
      levels: [
        level({ setId: 'e', difficulty: 'easy' }),
        level({ setId: 'm', difficulty: 'medium', status: 'draft', reviewed: true }),
        level({ setId: 'h', difficulty: 'hard', status: 'new', reviewed: false }),
      ],
    });
    expect(rowsOf(c).map(dotState)).toEqual(['live', 'draft', 'review']);
    const failed = job({ state: 'failed', currentLevel: null });
    expect(rowsOf(cat('Moons', { levels: [], job: failed })).map(dotState)).toEqual(['failed']);
    expect(rowsOf(cat('Moons', { levels: [], job: job() })).map(dotState)).toEqual([
      'generating',
      'generating',
    ]);
  });
});

describe('categoryBadge', () => {
  it('is Generating, then Failed, then Needs review, else none', () => {
    const unreviewed = level({ setId: 'x', status: 'new', reviewed: false });
    expect(categoryBadge(cat('A', { levels: [unreviewed], job: job() }))).toBe('Generating');
    expect(categoryBadge(cat('A', { levels: [unreviewed], job: job({ state: 'queued' }) }))).toBe(
      'Generating',
    );
    const failed = job({ state: 'failed', currentLevel: null });
    expect(categoryBadge(cat('A', { levels: [unreviewed], job: failed }))).toBe('Failed');
    expect(categoryBadge(cat('A', { levels: [unreviewed] }))).toBe('Needs review');
    // A reviewed draft waits only for Publish.
    expect(categoryBadge(cat('A', { levels: [{ ...unreviewed, reviewed: true }] }))).toBeNull();
    expect(categoryBadge(cat('A'))).toBeNull();
  });

  it('is Hidden for a hidden category that needs nothing else, after every other badge (F126)', () => {
    const unreviewed = level({ setId: 'x', status: 'new', reviewed: false });
    expect(categoryBadge(cat('A', { hidden: true }))).toBe('Hidden');
    expect(categoryBadge(cat('A', { hidden: true, levels: [unreviewed] }))).toBe('Needs review');
    expect(categoryBadge(cat('A', { hidden: true, job: job() }))).toBe('Generating');
  });
});

describe('listOrder', () => {
  it('puts the categories with a badge first, then the rest, each by name', () => {
    const review = level({ setId: 'r', status: 'new', reviewed: false });
    const list = [
      cat('Comics'),
      cat('zebras', { levels: [review] }),
      cat('Animals'),
      cat('Moons', { levels: [], job: job() }),
      cat('beaches'),
    ];
    expect(listOrder(list).map((c) => c.name)).toEqual([
      'Moons',
      'zebras',
      'Animals',
      'beaches',
      'Comics',
    ]);
  });

  it('does not lift a category that is only Hidden: hiding needs no attention (F126)', () => {
    const list = [cat('Comics'), cat('Animals', { hidden: true }), cat('Moons', { job: job() })];
    expect(listOrder(list).map((c) => c.name)).toEqual(['Moons', 'Animals', 'Comics']);
  });
});

describe('texts', () => {
  it('counts every question, live and draft', () => {
    expect(totalQuestions(RIVERS)).toBe(43);
  });

  it('reads a count, a short count, a level name and the publish message', () => {
    expect(countText(level({ questions: 1 }))).toBe('1 question');
    expect(countText(level({ questions: 13, wanted: 15 }))).toBe('13 of 15');
    expect(countText(level({ questions: 15, wanted: 15 }))).toBe('15 questions');
    expect(levelName(level({ difficulty: null, title: '  Picture round ' }))).toBe('Picture round');
    expect(levelName(level({ difficulty: null, title: ' ' }))).toBe('Untitled set');
    expect(publishedText('Rivers', 1)).toBe('Rivers is live: 1 set published.');
    expect(publishedText('Rivers', 3)).toBe('Rivers is live: 3 sets published.');
  });

  it('lists the drafts only, in level order', () => {
    expect(draftLevels(RIVERS).map((l) => l.setId)).toEqual(['riv-m', 'riv-h']);
  });

  it('describes a job in progress', () => {
    expect(jobProgress(job())).toBe('Writing the questions · Easy, level 1 of 2 · $0.03 so far');
  });

  it('finds a category whatever the case', () => {
    expect(findCategory([RIVERS], ' rivers')?.name).toBe('Rivers');
    expect(findCategory([RIVERS], 'Lakes')).toBeNull();
  });
});

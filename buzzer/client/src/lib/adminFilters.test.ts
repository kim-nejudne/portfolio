import { describe, expect, it } from 'vitest';
import type { AdminCategory } from '../../../shared/types.js';
import { job, level } from '../test/adminServer.js';
import {
  applyFilters,
  countsLine,
  filterCounts,
  filterSearch,
  foldText,
  inFilter,
  matchesSearch,
  overviewCounts,
  parseFilter,
} from './adminFilters.js';

const cat = (name: string, overrides: Partial<AdminCategory> = {}): AdminCategory => ({
  name,
  levels: [level({ setId: `${name}-e`, title: `${name} – Easy` })],
  job: null,
  ...overrides,
});

const LIVE = cat('Animals');
const REVIEW = cat('Rivers', {
  levels: [level({ setId: 'r-e', title: 'Rivers – Easy', status: 'new', reviewed: false })],
});
// Live, with a reviewed draft: needs nothing.
const REVIEWED = cat('Cafés', {
  levels: [
    level({ setId: 'c-e', title: 'Cafés – Easy' }),
    level({ setId: 'c-m', title: 'Espresso drinks', difficulty: 'medium', status: 'draft' }),
  ],
});
const GENERATING = cat('Moons', { levels: [], job: job({ category: 'Moons' }) });
// Live, a draft waiting for review, and a regenerate running.
const BUSY = cat('Zebras', {
  levels: [
    level({ setId: 'z-e', title: 'Zebras – Easy' }),
    level({
      setId: 'z-m',
      title: 'Zebras – Medium',
      difficulty: 'medium',
      status: 'new',
      reviewed: false,
    }),
  ],
  job: job({ kind: 'regenerate', setId: 'z-e', category: 'Zebras' }),
});
const FAILED = cat('Comets', {
  levels: [],
  job: job({ category: 'Comets', state: 'failed', currentLevel: null, error: 'busy' }),
});
const ALL = [LIVE, REVIEW, REVIEWED, GENERATING, BUSY, FAILED];
const names = (list: AdminCategory[]) => list.map((c) => c.name);

describe('parseFilter', () => {
  it('reads the four chips and falls back to All', () => {
    expect(parseFilter('review')).toBe('review');
    expect(parseFilter('generating')).toBe('generating');
    expect(parseFilter('live')).toBe('live');
    expect(parseFilter('all')).toBe('all');
    expect(parseFilter(null)).toBe('all');
    expect(parseFilter('hidden')).toBe('all');
    expect(parseFilter('REVIEW')).toBe('all');
  });
});

describe('foldText', () => {
  it('drops accents and case, and collapses spaces', () => {
    expect(foldText('  Pokémon   CAFÉ ')).toBe('pokemon cafe');
    expect(foldText('Ñandú')).toBe('nandu');
  });
});

describe('matchesSearch', () => {
  it('matches the category name, case- and accent-insensitively', () => {
    expect(matchesSearch(REVIEWED, 'cafe')).toBe(true);
    expect(matchesSearch(REVIEWED, 'CAFÉS')).toBe(true);
    expect(matchesSearch(LIVE, 'NIM')).toBe(true);
    expect(matchesSearch(LIVE, 'rivers')).toBe(false);
  });

  it('matches a level title', () => {
    expect(matchesSearch(REVIEWED, 'espresso')).toBe(true);
    expect(matchesSearch(REVIEWED, 'Espresso Drinks')).toBe(true);
  });

  it('keeps everything for a blank query', () => {
    expect(matchesSearch(LIVE, '')).toBe(true);
    expect(matchesSearch(GENERATING, '   ')).toBe(true);
  });

  it('trims and collapses the query', () => {
    expect(matchesSearch(LIVE, '  animals  – easy ')).toBe(true);
  });
});

describe('inFilter', () => {
  it('Needs review: a draft not yet marked reviewed', () => {
    expect(names(ALL.filter((c) => inFilter(c, 'review')))).toEqual(['Rivers', 'Zebras']);
  });

  it('Generating: a job queued or running, not a failed one', () => {
    expect(names(ALL.filter((c) => inFilter(c, 'generating')))).toEqual(['Moons', 'Zebras']);
  });

  it('Live: at least one live level', () => {
    expect(names(ALL.filter((c) => inFilter(c, 'live')))).toEqual(['Animals', 'Cafés', 'Zebras']);
  });

  it('All: every category', () => {
    expect(ALL.every((c) => inFilter(c, 'all'))).toBe(true);
  });
});

describe('filterCounts', () => {
  it('counts every chip', () => {
    expect(filterCounts(ALL, '')).toEqual({ all: 6, review: 2, generating: 2, live: 3 });
  });

  it('counts only what the search keeps', () => {
    expect(filterCounts(ALL, 'ZEB')).toEqual({ all: 1, review: 1, generating: 1, live: 1 });
    expect(filterCounts(ALL, 'nothing')).toEqual({ all: 0, review: 0, generating: 0, live: 0 });
  });
});

describe('applyFilters', () => {
  it('keeps what both the chip and the search keep, in the given order', () => {
    expect(names(applyFilters(ALL, 'live', ''))).toEqual(['Animals', 'Cafés', 'Zebras']);
    expect(names(applyFilters(ALL, 'live', 'a'))).toEqual(['Animals', 'Cafés', 'Zebras']);
    expect(names(applyFilters(ALL, 'live', 'cafe'))).toEqual(['Cafés']);
    expect(names(applyFilters(ALL, 'review', 'cafe'))).toEqual([]);
    expect(names(applyFilters(ALL, 'all', 'om'))).toEqual(['Comets']);
  });
});

describe('filterSearch', () => {
  it('leaves out All and a blank query', () => {
    expect(filterSearch('all', '')).toBe('');
    expect(filterSearch('review', '')).toBe('?filter=review');
    expect(filterSearch('all', 'riv')).toBe('?q=riv');
    expect(filterSearch('live', 'café & co')).toBe('?filter=live&q=caf%C3%A9+%26+co');
  });
});

describe('overviewCounts and countsLine', () => {
  it('counts every category, unfiltered', () => {
    expect(overviewCounts(ALL)).toEqual({ review: 2, generating: 2, live: 3 });
    expect(countsLine(overviewCounts(ALL))).toBe('2 to review · 2 generating · 3 live');
    expect(countsLine(overviewCounts([]))).toBe('0 to review · 0 generating · 0 live');
  });
});

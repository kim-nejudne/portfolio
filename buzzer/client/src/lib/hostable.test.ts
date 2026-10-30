import { describe, expect, it } from 'vitest';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { QuestionSet } from '../../../shared/types.js';
import { hostableRows } from './hostable.js';

const builtIn = STARTER_SETS[0]!;
const mine: QuestionSet = { ...STARTER_SETS[1]!, title: 'My twin', id: builtIn.id };

describe('hostableRows', () => {
  it('lists My sets, then the built-ins', () => {
    const other = { ...mine, id: 'other' };
    expect(hostableRows([mine, other], [builtIn]).sets).toEqual([mine, other, builtIn]);
  });

  it('keys a My set and a built-in with the same id apart, by source', () => {
    const rows = hostableRows([mine], [builtIn]);
    expect(rows.sets.map(rows.keyOf)).toEqual([`mine:${builtIn.id}`, `built-in:${builtIn.id}`]);
    expect(rows.sets.map(rows.isBuiltIn)).toEqual([false, true]);
  });

  it('lists only My sets when the built-ins could not be fetched', () => {
    const rows = hostableRows([mine], null);
    expect(rows.sets).toEqual([mine]);
    expect(rows.keyOf(mine)).toBe(`mine:${mine.id}`);
  });
});

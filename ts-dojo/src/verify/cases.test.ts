// §5 Type cases, the range math: a diagnostic inside a case fails it, one on the boundary
// belongs to the case that contains its start, a zero-length one still lands, one that spans
// two cases fails both, and one outside every range is reported as outsideCases.
import { describe, expect, it } from 'vitest';
import type { Diag } from '@/protocol/ts-ls';
import { groupIntoCases, overlaps, type CaseRange } from './cases';

const diag = (start: number, length = 1, code = 2344): Diag => ({
  file: '/tests.ts',
  start,
  length,
  line: 1,
  column: start + 1,
  code,
  message: `diag at ${start}`,
  category: 'error',
});

const cases: CaseRange[] = [
  { name: 'first', start: 10, end: 20 },
  { name: 'case 2', start: 20, end: 30 },
  { name: 'third', start: 40, end: 50 },
];

describe('overlaps', () => {
  it('is true when the diagnostic starts inside the range', () => {
    expect(overlaps(diag(10), cases[0] as CaseRange)).toBe(true);
    expect(overlaps(diag(19), cases[0] as CaseRange)).toBe(true);
  });

  it('is false at the end boundary and before the start', () => {
    expect(overlaps(diag(20), cases[0] as CaseRange)).toBe(false);
    expect(overlaps(diag(9), cases[0] as CaseRange)).toBe(false);
  });

  it('counts a zero-length diagnostic as one character', () => {
    expect(overlaps(diag(15, 0), cases[0] as CaseRange)).toBe(true);
    expect(overlaps(diag(20, 0), cases[0] as CaseRange)).toBe(false);
  });

  it('is true when a long diagnostic starts before the range and reaches into it', () => {
    expect(overlaps(diag(5, 10), cases[0] as CaseRange)).toBe(true);
  });
});

describe('groupIntoCases', () => {
  it('passes every case when there are no diagnostics and keeps the order and names', () => {
    const grouping = groupIntoCases(cases, []);
    expect(grouping.cases).toEqual([
      { name: 'first', ok: true, diagnostics: [] },
      { name: 'case 2', ok: true, diagnostics: [] },
      { name: 'third', ok: true, diagnostics: [] },
    ]);
    expect(grouping.outsideCases).toEqual([]);
  });

  it('fails only the case a diagnostic falls in', () => {
    const grouping = groupIntoCases(cases, [diag(25)]);
    expect(grouping.cases.map((c) => c.ok)).toEqual([true, false, true]);
    expect(grouping.cases[1]?.diagnostics).toEqual([diag(25)]);
    expect(grouping.outsideCases).toEqual([]);
  });

  it('fails both cases when a diagnostic spans them, and reports a stray one as outsideCases', () => {
    const grouping = groupIntoCases(cases, [
      diag(18, 5),
      diag(35),
      diag(60, 0),
    ]);
    expect(grouping.cases.map((c) => c.ok)).toEqual([false, false, true]);
    expect(grouping.cases[0]?.diagnostics).toEqual([diag(18, 5)]);
    expect(grouping.cases[1]?.diagnostics).toEqual([diag(18, 5)]);
    expect(grouping.outsideCases).toEqual([diag(35), diag(60, 0)]);
  });

  it('with no cases every diagnostic is outside', () => {
    const grouping = groupIntoCases([], [diag(1), diag(2)]);
    expect(grouping.cases).toEqual([]);
    expect(grouping.outsideCases).toHaveLength(2);
  });
});

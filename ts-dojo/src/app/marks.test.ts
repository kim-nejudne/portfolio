// The §9 budget marks: each is set once per document, at its first occurrence.
import { afterEach, describe, expect, it } from 'vitest';
import { COMPILER_READY_MARK, markOnce, SHELL_INTERACTIVE_MARK } from './marks';

afterEach(() => {
  performance.clearMarks();
});

describe('markOnce', () => {
  it('sets a User Timing mark the first time and keeps that one', () => {
    markOnce(SHELL_INTERACTIVE_MARK);
    const [first] = performance.getEntriesByName(
      SHELL_INTERACTIVE_MARK,
      'mark',
    );
    markOnce(SHELL_INTERACTIVE_MARK);
    const marks = performance.getEntriesByName(SHELL_INTERACTIVE_MARK, 'mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.startTime).toBe(first?.startTime);
  });

  it('names the two marks e2e/budgets.spec.ts reads', () => {
    expect(SHELL_INTERACTIVE_MARK).toBe('ts-dojo:shell-interactive');
    expect(COMPILER_READY_MARK).toBe('ts-dojo:compiler-ready');
  });
});

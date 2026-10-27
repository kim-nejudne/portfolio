import { describe, expect, it } from 'vitest';
import { QUESTION_TEXT_MAX } from '../../../shared/constants.js';
import type { Phase } from '../../../shared/types.js';
import { buzzersOpen, formatGap, questionTextClass } from './screenQuestion.js';

describe('formatGap', () => {
  it('shows seconds with two decimals and a plus sign', () => {
    expect(formatGap(120)).toBe('+0.12 s');
    expect(formatGap(1_500)).toBe('+1.50 s');
  });

  it('rounds the fractional milliseconds the server sends', () => {
    expect(formatGap(123.456)).toBe('+0.12 s');
    expect(formatGap(126)).toBe('+0.13 s');
  });

  it('shows a dead heat as +0.00 s', () => {
    expect(formatGap(0)).toBe('+0.00 s');
    expect(formatGap(4.9)).toBe('+0.00 s');
  });
});

describe('questionTextClass', () => {
  const sizes = (hasImage: boolean) =>
    [10, 60, 120, 200, QUESTION_TEXT_MAX].map((n) => questionTextClass('x'.repeat(n), hasImage));

  it('shrinks as the text grows', () => {
    const steps = sizes(false);
    expect(new Set(steps).size).toBe(steps.length);
  });

  it('uses a smaller size when an image shares the space', () => {
    expect(questionTextClass('Short', true)).not.toBe(questionTextClass('Short', false));
    expect(questionTextClass('Short', true)).toBe(questionTextClass('x'.repeat(60), false));
  });

  it('never goes below the smallest step', () => {
    expect(questionTextClass('x'.repeat(QUESTION_TEXT_MAX), true)).toBe(
      questionTextClass('x'.repeat(QUESTION_TEXT_MAX), false),
    );
  });

  it('measures the trimmed text', () => {
    expect(questionTextClass(`  Short${' '.repeat(200)}`, false)).toBe(
      questionTextClass('Short', false),
    );
  });
});

describe('buzzersOpen', () => {
  it('is true while buzzes count: OPEN and the collection window', () => {
    const open: Phase[] = ['OPEN', 'COLLECTING'];
    const closed: Phase[] = ['LOBBY', 'QUESTION', 'BUZZED', 'REVEAL', 'FINAL'];
    for (const phase of open) expect(buzzersOpen(phase)).toBe(true);
    for (const phase of closed) expect(buzzersOpen(phase)).toBe(false);
  });
});

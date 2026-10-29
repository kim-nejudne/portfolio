// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Phase } from '../../../shared/types.js';
import { useFalseStartWait } from './useFalseStartWait.js';

interface Props {
  phase: Phase;
  questionIndex: number;
  openingCounter: number;
  waitMs: number;
  anyone: boolean;
}

const props = (overrides: Partial<Props> = {}): Props => ({
  phase: 'OPEN',
  questionIndex: 2,
  openingCounter: 1,
  waitMs: 500,
  anyone: true,
  ...overrides,
});

function setup(initial: Props) {
  return renderHook(
    ({ waitMs, anyone, ...view }: Props) => useFalseStartWait(view, waitMs, anyone),
    {
      initialProps: initial,
    },
  );
}

const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFalseStartWait', () => {
  it('holds for waitMs from the first open snapshot, then frees', () => {
    const { result } = setup(props());
    expect(result.current).toBe(true);
    tick(499);
    expect(result.current).toBe(true);
    tick(1);
    expect(result.current).toBe(false);
  });

  it('waits 1 s with the longer setting', () => {
    const { result } = setup(props({ waitMs: 1000 }));
    tick(999);
    expect(result.current).toBe(true);
    tick(1);
    expect(result.current).toBe(false);
  });

  it('keeps counting from the opening through COLLECTING', () => {
    const { result, rerender } = setup(props());
    tick(300);
    rerender(props({ phase: 'COLLECTING' }));
    expect(result.current).toBe(true);
    tick(200);
    expect(result.current).toBe(false);
  });

  it('is false with nobody early, with the setting off, and outside an opening', () => {
    expect(setup(props({ anyone: false })).result.current).toBe(false);
    expect(setup(props({ waitMs: 0 })).result.current).toBe(false);
    for (const phase of ['LOBBY', 'QUESTION', 'BUZZED', 'REVEAL', 'FINAL'] as const) {
      expect(setup(props({ phase })).result.current).toBe(false);
    }
  });

  it('frees at once when the host turns the setting off mid-wait', () => {
    const { result, rerender } = setup(props());
    tick(100);
    rerender(props({ waitMs: 0 }));
    expect(result.current).toBe(false);
  });

  it('starts again for a later question', () => {
    const { result, rerender } = setup(props());
    tick(500);
    expect(result.current).toBe(false);
    rerender(props({ phase: 'QUESTION', questionIndex: 3 }));
    rerender(props({ questionIndex: 3, openingCounter: 2 }));
    expect(result.current).toBe(true);
    tick(500);
    expect(result.current).toBe(false);
  });
});

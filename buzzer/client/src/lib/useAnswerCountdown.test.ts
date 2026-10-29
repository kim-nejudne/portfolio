// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnswerTimerView, BuzzTimerView } from '../../../shared/types.js';
import {
  countdownText,
  TIME_UP_LABEL,
  useAnswerCountdown,
  useBuzzCountdown,
  useAnsweringCountdown,
} from './useAnswerCountdown.js';

interface Props {
  answerTimer: AnswerTimerView | null;
  questionIndex: number;
  openingCounter: number;
}

const running = (seconds: number, overrides: Partial<Props> = {}): Props => ({
  answerTimer: { seconds, up: false },
  questionIndex: 2,
  openingCounter: 1,
  ...overrides,
});

function setup(initial: Props) {
  return renderHook((props: Props) => useAnswerCountdown(props), { initialProps: initial });
}

const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAnswerCountdown', () => {
  it('is null with the timer off', () => {
    const { result } = setup({ answerTimer: null, questionIndex: 2, openingCounter: 1 });
    expect(result.current).toBeNull();
  });

  it('counts whole seconds down from the timer’s seconds', () => {
    const { result } = setup(running(3));
    expect(result.current).toEqual({ secondsLeft: 3, up: false });
    tick(999);
    expect(result.current?.secondsLeft).toBe(3);
    tick(1);
    expect(result.current?.secondsLeft).toBe(2);
    tick(1000);
    expect(result.current?.secondsLeft).toBe(1);
  });

  it('stops at 0 and stays there until the server says up', () => {
    const { result } = setup(running(3));
    tick(3000);
    expect(result.current).toEqual({ secondsLeft: 0, up: false });
    tick(5000);
    expect(result.current).toEqual({ secondsLeft: 0, up: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports up once the view says so, even before the local count reaches 0', () => {
    const { result, rerender } = setup(running(5));
    tick(4000);
    rerender({ ...running(5), answerTimer: { seconds: 5, up: true } });
    expect(result.current).toEqual({ secondsLeft: 0, up: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counts from the clock, so a late tick (a throttled tab) skips ahead', () => {
    const { result } = setup(running(10));
    // Timers fire late, but the clock has moved on: the next tick shows the real time left.
    vi.setSystemTime(Date.now() + 4500);
    tick(250);
    expect(result.current?.secondsLeft).toBe(6);
  });

  it('restarts on a new opening of the same question', () => {
    const { result, rerender } = setup(running(3));
    tick(2000);
    rerender(running(3, { openingCounter: 2 }));
    expect(result.current?.secondsLeft).toBe(3);
    tick(1000);
    expect(result.current?.secondsLeft).toBe(2);
  });

  it('restarts on a new question', () => {
    const { result, rerender } = setup(running(3));
    tick(3000);
    rerender(running(3, { questionIndex: 3, openingCounter: 2 }));
    expect(result.current).toEqual({ secondsLeft: 3, up: false });
  });

  it('becomes null when the timer is cleared, and stops ticking', () => {
    const { result, rerender } = setup(running(7));
    tick(1000);
    rerender({ ...running(7), answerTimer: null });
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a later state of the same opening does not restart it', () => {
    const { result, rerender } = setup(running(5));
    tick(2000);
    rerender(running(5));
    expect(result.current?.secondsLeft).toBe(3);
  });
});

interface BuzzProps {
  buzzTimer: BuzzTimerView | null;
  questionIndex: number;
  openingCounter: number;
}

const buzzOpen = (seconds: number, overrides: Partial<BuzzProps> = {}): BuzzProps => ({
  buzzTimer: { seconds },
  questionIndex: 2,
  openingCounter: 1,
  ...overrides,
});

function setupBuzz(initial: BuzzProps) {
  return renderHook((props: BuzzProps) => useBuzzCountdown(props), { initialProps: initial });
}

describe('useBuzzCountdown', () => {
  it('is null with no buzz time set', () => {
    const { result } = setupBuzz({ buzzTimer: null, questionIndex: 2, openingCounter: 1 });
    expect(result.current).toBeNull();
  });

  it('counts the buzz time down to 0 and stops there; time up is the server’s reveal', () => {
    const { result } = setupBuzz(buzzOpen(5));
    expect(result.current).toEqual({ secondsLeft: 5, up: false });
    tick(2000);
    expect(result.current?.secondsLeft).toBe(3);
    tick(10_000);
    expect(result.current).toEqual({ secondsLeft: 0, up: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('becomes null on the first buzz, and restarts in full when the buzzers reopen', () => {
    const { result, rerender } = setupBuzz(buzzOpen(10));
    tick(4000);
    rerender({ ...buzzOpen(10), buzzTimer: null });
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    rerender(buzzOpen(10, { openingCounter: 2 }));
    expect(result.current?.secondsLeft).toBe(10);
  });

  it('runs alongside the answer countdown of the same opening without sharing its count', () => {
    type Both = BuzzProps & { answerTimer: AnswerTimerView | null };
    const initialProps: Both = { ...buzzOpen(15), answerTimer: null };
    const { result, rerender } = renderHook(
      (props: Both) => ({ buzz: useBuzzCountdown(props), answer: useAnswerCountdown(props) }),
      { initialProps },
    );
    tick(6000);
    rerender({ ...buzzOpen(15), buzzTimer: null, answerTimer: { seconds: 5, up: false } });
    expect(result.current).toEqual({ buzz: null, answer: { secondsLeft: 5, up: false } });
  });
});

describe('useAnsweringCountdown', () => {
  type ChoiceProps = Parameters<typeof useAnsweringCountdown>[0];
  const answering = (seconds: number): ChoiceProps => ({
    choice: { timer: { seconds } },
    questionIndex: 3,
    openingCounter: 2,
  });

  it('counts the choice time down to 0 and stops there; closing is the server’s', () => {
    const { result } = renderHook((props: ChoiceProps) => useAnsweringCountdown(props), {
      initialProps: answering(10),
    });
    expect(result.current).toEqual({ secondsLeft: 10, up: false });
    tick(3000);
    expect(result.current?.secondsLeft).toBe(7);
    tick(20_000);
    expect(result.current).toEqual({ secondsLeft: 0, up: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is null for a buzz question and once the answering closes', () => {
    const { result, rerender } = renderHook((props: ChoiceProps) => useAnsweringCountdown(props), {
      initialProps: { ...answering(10), choice: null } as ChoiceProps,
    });
    expect(result.current).toBeNull();
    rerender(answering(10));
    expect(result.current?.secondsLeft).toBe(10);
    rerender({ ...answering(10), choice: { timer: null } });
    expect(result.current).toBeNull();
  });

  it('counts a typed question’s time down, and is null once its answers lock (F88)', () => {
    const typed = (timer: { seconds: number } | null): ChoiceProps => ({
      choice: null,
      typed: { timer },
      questionIndex: 3,
      openingCounter: 2,
    });
    const { result, rerender } = renderHook((props: ChoiceProps) => useAnsweringCountdown(props), {
      initialProps: typed({ seconds: 10 }),
    });
    expect(result.current).toEqual({ secondsLeft: 10, up: false });
    tick(4000);
    expect(result.current?.secondsLeft).toBe(6);
    rerender(typed(null));
    expect(result.current).toBeNull();
  });
});

describe('countdownText', () => {
  it('shows the seconds left, then the time’s-up label', () => {
    expect(countdownText({ secondsLeft: 4, up: false })).toBe('4');
    expect(countdownText({ secondsLeft: 0, up: false })).toBe('0');
    expect(countdownText({ secondsLeft: 0, up: true })).toBe(TIME_UP_LABEL);
    expect(TIME_UP_LABEL).toBe('Time’s up!');
  });
});

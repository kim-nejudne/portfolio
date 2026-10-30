import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_ALERT_MS, createCloseAlert } from './closeAlert.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the drawer\'s "Bea is close!" (F36)', () => {
  it('shows the close guesser for 2 s, then nothing', () => {
    const alert = createCloseAlert();
    expect(alert.getSnapshot()).toBeNull();
    alert.push('bea');
    expect(alert.getSnapshot()).toBe('bea');
    expect(CLOSE_ALERT_MS).toBe(2000);
    vi.advanceTimersByTime(CLOSE_ALERT_MS - 1);
    expect(alert.getSnapshot()).toBe('bea');
    vi.advanceTimersByTime(1);
    expect(alert.getSnapshot()).toBeNull();
  });

  it('lets a newer alert take over and restarts the 2 s', () => {
    const alert = createCloseAlert();
    alert.push('bea');
    vi.advanceTimersByTime(1500);
    alert.push('jun');
    expect(alert.getSnapshot()).toBe('jun');
    vi.advanceTimersByTime(1500);
    expect(alert.getSnapshot()).toBe('jun');
    vi.advanceTimersByTime(500);
    expect(alert.getSnapshot()).toBeNull();
  });

  it('a second close guess from the same guesser keeps it up 2 s more', () => {
    const alert = createCloseAlert();
    alert.push('bea');
    vi.advanceTimersByTime(1500);
    alert.push('bea');
    vi.advanceTimersByTime(1999);
    expect(alert.getSnapshot()).toBe('bea');
  });

  it('is gone at once when the turn ends, and tells its listeners', () => {
    const alert = createCloseAlert();
    const seen: (string | null)[] = [];
    const off = alert.subscribe(() => seen.push(alert.getSnapshot()));
    alert.push('bea');
    alert.clear();
    expect(alert.getSnapshot()).toBeNull();
    vi.advanceTimersByTime(CLOSE_ALERT_MS);
    expect(seen).toEqual(['bea', null]);
    off();
    alert.push('jun');
    expect(seen).toEqual(['bea', null]);
  });
});

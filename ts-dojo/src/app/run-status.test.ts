import { describe, expect, it } from 'vitest';
import { formatDuration, formatStatus } from './run-status';

describe('formatDuration', () => {
  it('uses ms below a second and one decimal of seconds above', () => {
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(412.6)).toBe('413 ms');
    expect(formatDuration(1000)).toBe('1 s');
    expect(formatDuration(1340)).toBe('1.3 s');
    expect(formatDuration(5000)).toBe('5 s');
    expect(formatDuration(12_345)).toBe('12.3 s');
  });
});

describe('formatStatus', () => {
  it('reads as §4 and §12 F4 say', () => {
    expect(formatStatus({ kind: 'idle' })).toBe('');
    expect(formatStatus({ kind: 'preparing' })).toBe('running');
    expect(formatStatus({ kind: 'running' })).toBe('running');
    expect(formatStatus({ kind: 'done', durationMs: 12 })).toBe(
      'done in 12 ms',
    );
    expect(
      formatStatus({ kind: 'killed', afterMs: 5000, byDeadline: true }),
    ).toBe('killed after 5 s');
    expect(
      formatStatus({ kind: 'killed', afterMs: 412, byDeadline: false }),
    ).toBe('killed after 412 ms');
    expect(
      formatStatus({ kind: 'still-running', pendingTimers: 1, durationMs: 3 }),
    ).toBe('still running (1 timer)');
    expect(
      formatStatus({ kind: 'still-running', pendingTimers: 2, durationMs: 3 }),
    ).toBe('still running (2 timers)');
    expect(formatStatus({ kind: 'failed', message: 'no' })).toBe('failed: no');
  });
});

import { describe, expect, it } from 'vitest';
import {
  VAT_PERCENT,
  applyMultiplier,
  formatInteger,
  formatMultiplier,
  formatPeso,
  vatOn,
} from '../money';
import {
  addHours,
  addWorkingDays,
  dueStatus,
  formatDate,
  formatDuration,
  formatTime,
  isSunday,
  minutesBetween,
} from '../dates';

describe('formatPeso', () => {
  it('groups thousands and carries exactly one currency glyph', () => {
    expect(formatPeso(0)).toBe('₱0');
    expect(formatPeso(7)).toBe('₱7');
    expect(formatPeso(999)).toBe('₱999');
    expect(formatPeso(1000)).toBe('₱1,000');
    expect(formatPeso(12_400)).toBe('₱12,400');
    expect(formatPeso(1_234_567)).toBe('₱1,234,567');
  });

  it('puts the sign outside the glyph', () => {
    expect(formatPeso(-1500)).toBe('-₱1,500');
  });

  it('never emits a decimal point — prices are whole pesos', () => {
    for (const value of [0.4, 1.5, 2.5, 1999.99, 12_345.678]) {
      expect(formatPeso(value)).not.toContain('.');
    }
  });

  /**
   * Hand-rolled rather than Intl.NumberFormat on purpose: Intl's output depends
   * on the runtime's locale data, so the server and the browser could format the
   * same number differently and React would report a hydration mismatch.
   */
  it('does not depend on the ambient locale', () => {
    expect(formatPeso(1_234_567)).toBe('₱1,234,567');
  });
});

describe('applyMultiplier', () => {
  it('treats the multiplier as integer per-mille', () => {
    expect(applyMultiplier(1000, 1000)).toBe(1000);
    expect(applyMultiplier(1000, 1500)).toBe(1500);
    expect(applyMultiplier(1000, 800)).toBe(800);
  });

  it('returns an integer for any input', () => {
    for (const [amount, perMille] of [
      [3333, 1300],
      [1, 1],
      [9999, 777],
      [2400, 1800],
    ] as const) {
      expect(Number.isInteger(applyMultiplier(amount, perMille))).toBe(true);
    }
  });

  it('rounds rather than truncating', () => {
    // 1000 × 1.0005 = 1000.5 → 1001, not 1000.
    expect(applyMultiplier(1000, 1001)).toBe(1001);
  });
});

describe('vatOn', () => {
  it('is 12% and always an integer', () => {
    expect(VAT_PERCENT).toBe(12);
    expect(vatOn(1000)).toBe(120);
    expect(vatOn(2400)).toBe(288);
    expect(Number.isInteger(vatOn(3333))).toBe(true);
  });
});

describe('formatInteger and formatMultiplier', () => {
  it('groups plain numbers without a currency glyph', () => {
    expect(formatInteger(41_600)).toBe('41,600');
    expect(formatInteger(0)).toBe('0');
    expect(formatInteger(-250)).toBe('-250');
  });

  it('renders per-mille as a three-decimal factor', () => {
    expect(formatMultiplier(1000)).toBe('1.000×');
    expect(formatMultiplier(1800)).toBe('1.800×');
    expect(formatMultiplier(900)).toBe('0.900×');
  });
});

describe('working days', () => {
  // 2026-08-09 is a Sunday; the shop is closed.
  it('knows which days are Sundays in Manila time', () => {
    expect(isSunday('2026-08-09T09:00:00+08:00')).toBe(true);
    expect(isSunday('2026-08-10T09:00:00+08:00')).toBe(false);
  });

  it('skips Sunday when counting forward', () => {
    // Friday 7 Aug + 2 working days: Saturday, then Sunday is skipped → Monday.
    const result = addWorkingDays('2026-08-07T09:00:00+08:00', 2);
    expect(result.slice(0, 10)).toBe('2026-08-10');
  });

  it('never lands on a Sunday', () => {
    for (let days = 1; days <= 20; days += 1) {
      const result = addWorkingDays('2026-08-05T09:00:00+08:00', days);
      expect(isSunday(result), `+${days} working days`).toBe(false);
    }
  });

  it('rolls a 24-hour rush off a Sunday', () => {
    // Saturday + 24h would be Sunday, so it moves to Monday.
    const result = addHours('2026-08-08T09:00:00+08:00', 24);
    expect(isSunday(result)).toBe(false);
    expect(result.slice(0, 10)).toBe('2026-08-10');
  });
});

describe('durations and due status', () => {
  it('formats at most two fields', () => {
    expect(formatDuration(12)).toBe('12m');
    expect(formatDuration(75)).toBe('01h 15m');
    expect(formatDuration(60 * 24 * 2 + 60 * 4)).toBe('2d 04h');
  });

  it('marks a past due date as overdue and says by how much', () => {
    const status = dueStatus('2026-08-05T09:00:00+08:00', '2026-08-05T12:00:00+08:00');
    expect(status.overdue).toBe(true);
    expect(status.label).toBe('03h 00m over');
  });

  it('says how long is left when the date is ahead', () => {
    const status = dueStatus('2026-08-05T12:00:00+08:00', '2026-08-05T09:00:00+08:00');
    expect(status.overdue).toBe(false);
    expect(status.label).toBe('03h 00m left');
  });

  it('measures minutes between two instants', () => {
    expect(minutesBetween('2026-08-05T09:00:00+08:00', '2026-08-05T09:45:00+08:00')).toBe(45);
  });
});

describe('date formatting', () => {
  it('renders in Manila time regardless of the host timezone', () => {
    // 23:30 UTC is already the next morning in Manila.
    expect(formatDate('2026-08-05T23:30:00Z')).toBe('06 Aug 2026');
    expect(formatTime('2026-08-05T23:30:00Z')).toBe('07:30');
  });

  it('pads the day and the clock so columns line up', () => {
    expect(formatDate('2026-08-01T09:05:00+08:00')).toBe('01 Aug 2026');
    expect(formatTime('2026-08-01T09:05:00+08:00')).toBe('09:05');
  });
});

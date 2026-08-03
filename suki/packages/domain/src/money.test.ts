import { describe, expect, it } from 'vitest';
import { formatPeso, formatPesoBare, parsePesoInput } from './money';

describe('formatPeso', () => {
  it('formats whole pesos with no decimal part', () => {
    expect(formatPeso(15)).toBe('₱15');
    expect(formatPeso(0)).toBe('₱0');
  });

  it('groups thousands', () => {
    expect(formatPeso(1240)).toBe('₱1,240');
    expect(formatPeso(1_234_567)).toBe('₱1,234,567');
  });

  it('puts the minus outside the sign, not between sign and digits', () => {
    // '-₱40' is how a debit reads on a statement. '₱-40' is a bug that looks
    // like a formatting quirk until somebody misreads a balance.
    expect(formatPeso(-40)).toBe('-₱40');
  });

  /**
   * The guard is the point of this module. Money reaching a screen as 10.41
   * means an integer invariant broke several layers upstream, and rounding it
   * quietly here would hide the break while producing a number that does not
   * reconcile against the ledger.
   */
  it('throws rather than rounding a non-integer', () => {
    expect(() => formatPeso(10.41)).toThrow(/integer/i);
    expect(() => formatPeso(Number.NaN)).toThrow(/integer/i);
    expect(() => formatPeso(Number.POSITIVE_INFINITY)).toThrow(/integer/i);
  });
});

describe('formatPesoBare', () => {
  it('drops the sign but keeps grouping and the minus', () => {
    expect(formatPesoBare(1240)).toBe('1,240');
    expect(formatPesoBare(-40)).toBe('-40');
  });

  it('applies the same integer guard', () => {
    expect(() => formatPesoBare(0.5)).toThrow(/integer/i);
  });
});

describe('parsePesoInput', () => {
  it('accepts what a shopkeeper actually types', () => {
    expect(parsePesoInput('15')).toBe(15);
    expect(parsePesoInput(' 1,240 ')).toBe(1240);
    expect(parsePesoInput('₱250')).toBe(250);
  });

  it('returns null for empty input rather than zero', () => {
    // A blank field is "not answered yet", not "₱0". Conflating them would let
    // an untouched buy-price field save a zero cost and report infinite margin.
    expect(parsePesoInput('')).toBeNull();
    expect(parsePesoInput('   ')).toBeNull();
  });

  it('rejects decimals instead of truncating them', () => {
    expect(parsePesoInput('10.41')).toBeNull();
    expect(parsePesoInput('10,41')).toBe(1041); // comma is a separator, not a decimal mark
  });

  it('rejects anything that is not a number', () => {
    expect(parsePesoInput('abc')).toBeNull();
    expect(parsePesoInput('12abc')).toBeNull();
    expect(parsePesoInput('1e5')).toBeNull();
  });

  it('round-trips through formatPeso', () => {
    for (const value of [0, 7, 250, 1240, 1_234_567]) {
      expect(parsePesoInput(formatPeso(value))).toBe(value);
    }
  });
});

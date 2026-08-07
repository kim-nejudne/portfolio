import { describe, expect, it } from 'vitest';
import { MissingRateError, computeQuote, validateQuoteInput } from '../quote';
import { VAT_PERCENT } from '../money';
import { TEST_MATRIX, WEDNESDAY, quoteInput } from './fixtures';

describe('computeQuote — arithmetic', () => {
  it('prices a flat job from setup plus rate, band, stock and colour multipliers', () => {
    /**
     * Worked through by hand against TEST_MATRIX:
     *   setup 1000 + (2000 × 1000 ÷ 1000) = 3000
     *   × silk-150 1.000 = 3000
     *   × 4/4      1.000 = 3000
     *   × 1000 band 0.800 = 2400
     *   + trim (0/1000, flat 0) = 2400
     *   × standard 1.000 = 2400 subtotal
     *   VAT 12% = 288, total 2688
     */
    const quote = computeQuote(quoteInput(), TEST_MATRIX, WEDNESDAY);
    expect(quote.subtotal).toBe(2400);
    expect(quote.vat).toBe(288);
    expect(quote.total).toBe(2688);
  });

  it('applies stock and colour multipliers, and the turnaround last', () => {
    /**
     *   1000 + 2000 = 3000
     *   × uncoated-170 1.200 = 3600
     *   × 4/0          0.800 = 2880
     *   × 1000 band    0.800 = 2304
     *   × express      1.300 = 2995.2 → 2995
     */
    const quote = computeQuote(
      quoteInput({ stock: 'uncoated-170', colours: '4/0', turnaround: 'express' }),
      TEST_MATRIX,
      WEDNESDAY,
    );
    expect(quote.subtotal).toBe(2995);
  });

  it('adds finishing per thousand plus a flat fee, before the turnaround multiplier', () => {
    /**
     *   base as the first case = 2400
     *   + matt-lam (1000 × 1000 ÷ 1000) + 500 flat = 2400 + 1500 = 3900
     *   × standard 1.000 = 3900
     */
    const quote = computeQuote(
      quoteInput({ finishing: ['trim', 'matt-lam'] }),
      TEST_MATRIX,
      WEDNESDAY,
    );
    expect(quote.subtotal).toBe(3900);
  });

  it('keeps every money field an integer, whatever the multipliers do', () => {
    // 1.3 × 1.2 × 0.7 is exactly the sort of product that produces a float.
    const quote = computeQuote(
      quoteInput({
        stock: 'uncoated-170',
        turnaround: 'express',
        quantity: 2500,
        finishing: ['trim', 'spot-uv'],
      }),
      TEST_MATRIX,
      WEDNESDAY,
    );
    for (const [field, value] of Object.entries({
      unitPrice: quote.unitPrice,
      subtotal: quote.subtotal,
      vat: quote.vat,
      total: quote.total,
    })) {
      expect(Number.isInteger(value), `${field} = ${value}`).toBe(true);
    }
  });

  it('always shows VAT as a separate line that adds up', () => {
    const quote = computeQuote(quoteInput({ quantity: 2500 }), TEST_MATRIX, WEDNESDAY);
    expect(quote.vat).toBe(Math.round((quote.subtotal * VAT_PERCENT) / 100));
    expect(quote.total).toBe(quote.subtotal + quote.vat);
  });

  it('falls back to the smallest band below the lowest break', () => {
    // 100 is the smallest break, so there is nothing below it to fall through to.
    const quote = computeQuote(quoteInput({ quantity: 100 }), TEST_MATRIX, WEDNESDAY);
    expect(quote.subtotal).toBeGreaterThan(0);
  });
});

describe('computeQuote — press selection', () => {
  /** The rule is stated in sheets, not copies. */
  it('sends work under 500 sheets to the digital press', () => {
    const quote = computeQuote(quoteInput({ quantity: 250 }), TEST_MATRIX, WEDNESDAY);
    expect(quote.press).toBe('INDIGO');
    expect(quote.sheetsRequired).toBeLessThan(500);
    expect(quote.pressReason).toMatch(/under 500 sheets/);
  });

  it('sends work of 500 sheets or more to litho', () => {
    const quote = computeQuote(
      quoteInput({ product: 'posters', size: 'A3', quantity: 2500 }),
      TEST_MATRIX,
      WEDNESDAY,
    );
    expect(quote.sheetsRequired).toBeGreaterThanOrEqual(500);
    expect(quote.press).not.toBe('INDIGO');
  });

  /**
   * Documents a consequence of the rule set rather than asserting a preference.
   *
   * `planFor` picks whichever sheet needs the fewest impressions, and B1 is the
   * largest sheet, so litho work lands on B1 almost every time — and G40 is the
   * only press that takes B1. Between this and the sheets-not-copies threshold,
   * XL75 is chosen far more rarely than the brief's wording suggests. Worth a
   * decision, not a silent fix.
   */
  it('prefers the largest sheet, which routes most litho work to the B1 press', () => {
    const quote = computeQuote(
      quoteInput({ product: 'posters', size: 'A3', quantity: 2500 }),
      TEST_MATRIX,
      WEDNESDAY,
    );
    expect(quote.sheetId).toBe('B1');
    expect(quote.press).toBe('G40');
    expect(quote.pressReason).toMatch(/only press that takes B1/);
  });

  it('routes a fifth colour to the press that has a fifth unit', () => {
    const quote = computeQuote(
      quoteInput({ product: 'posters', size: 'A3', quantity: 2500, colours: '5/4' }),
      TEST_MATRIX,
      WEDNESDAY,
    );
    expect(quote.press).toBe('XL75');
    expect(quote.pressReason).toMatch(/fifth unit/);
  });

  it('always explains its choice in a sentence, not a code', () => {
    const quote = computeQuote(quoteInput(), TEST_MATRIX, WEDNESDAY);
    expect(quote.pressReason.length).toBeGreaterThan(20);
    expect(quote.pressReason).toMatch(/\.$/);
  });
});

describe('computeQuote — dates', () => {
  it('counts standard turnaround in working days, skipping Sunday', () => {
    // Wednesday 5 Aug + 5 working days, with Sunday 9 Aug skipped → Tue 11 Aug.
    const quote = computeQuote(quoteInput(), TEST_MATRIX, WEDNESDAY);
    expect(quote.despatchAt.slice(0, 10)).toBe('2026-08-11');
    expect(quote.workingDays).toBe(5);
  });

  it('treats rush as 24 hours rather than a working day', () => {
    const quote = computeQuote(quoteInput({ turnaround: 'rush' }), TEST_MATRIX, WEDNESDAY);
    expect(quote.despatchAt.slice(0, 10)).toBe('2026-08-06');
  });
});

describe('computeQuote — a broken matrix', () => {
  it('throws rather than pricing a job off an unrelated rate', () => {
    // The scaffold fell back to products[0] here, which silently quoted a
    // booklet at the business-card rate.
    const withoutFlyers = {
      ...TEST_MATRIX,
      products: TEST_MATRIX.products.filter((product) => product.id !== 'flyers'),
    };
    expect(() => computeQuote(quoteInput(), withoutFlyers, WEDNESDAY)).toThrow(MissingRateError);
    expect(() => computeQuote(quoteInput(), withoutFlyers, WEDNESDAY)).toThrow(/no product rate/);
  });

  it('throws when there are no quantity breaks at all', () => {
    expect(() =>
      computeQuote(quoteInput(), { ...TEST_MATRIX, quantityBreaks: [] }, WEDNESDAY),
    ).toThrow(MissingRateError);
  });
});

describe('validateQuoteInput', () => {
  it('accepts a well-formed flat job', () => {
    expect(validateQuoteInput(quoteInput())).toEqual([]);
  });

  it('rejects a booklet page count that is not a multiple of four', () => {
    const errors = validateQuoteInput(quoteInput({ product: 'booklets', pageCount: 22 }));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe('pageCount');
    expect(errors[0]!.message).toContain('not a multiple of 4');
  });

  it('rejects page counts outside the quotable range', () => {
    expect(validateQuoteInput(quoteInput({ product: 'booklets', pageCount: 4 }))).toHaveLength(1);
    expect(validateQuoteInput(quoteInput({ product: 'booklets', pageCount: 200 }))).toHaveLength(1);
  });

  it('ignores page count entirely for flat work', () => {
    expect(validateQuoteInput(quoteInput({ product: 'flyers', pageCount: 22 }))).toEqual([]);
  });

  it('rejects a quantity that is not one of the quoted breaks', () => {
    const errors = validateQuoteInput(quoteInput({ quantity: 777 }));
    expect(errors.some((error) => error.field === 'quantity')).toBe(true);
  });

  it('rejects an empty finishing list — every job is at least trimmed', () => {
    const errors = validateQuoteInput(quoteInput({ finishing: [] }));
    expect(errors.some((error) => error.field === 'finishing')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  BLEED_MM,
  SCHEME_PAGES,
  SHEETS,
  buildPlan,
  fitOnSheet,
  largestSchemeThatFits,
  pagesInScheme,
  wasteFor,
} from '../imposition';
import type { ImpositionInput, SignatureScheme } from '../types';

function input(overrides: Partial<ImpositionInput> = {}): ImpositionInput {
  return {
    sheetId: 'B2',
    sizeId: 'A5',
    scheme: '8pp',
    binding: 'saddle-stitch',
    workStyle: 'sheetwise',
    gripperMm: 10,
    creepMm: 1.5,
    pageCount: 16,
    quantity: 1000,
    ...overrides,
  };
}

describe('sheet specifications', () => {
  it('states the real trade sheet sizes in millimetres', () => {
    expect(SHEETS.SRA3).toMatchObject({ widthMm: 320, heightMm: 450 });
    expect(SHEETS.B2).toMatchObject({ widthMm: 500, heightMm: 707 });
    expect(SHEETS.B1).toMatchObject({ widthMm: 707, heightMm: 1000 });
  });
});

describe('fitOnSheet', () => {
  it('counts how many finished pieces fit, bleed included', () => {
    // B2 500 × 707, less 5mm each side and a 10mm gripper plus 12mm tail:
    // usable 490 × 685. An A5 piece with 3mm bleed pitches at 154 × 216.
    // 490/154 = 3 across, 685/216 = 3 down.
    const fit = fitOnSheet('B2', 148, 210, 10);
    expect(fit.up).toBe(9);
    expect(fit.cols).toBe(3);
    expect(fit.rows).toBe(3);
  });

  it('tries the piece both ways round and keeps the better yield', () => {
    // A landscape piece on a portrait sheet should be turned, not wasted.
    const upright = fitOnSheet('B2', 210, 148, 10);
    expect(upright.up).toBeGreaterThanOrEqual(9);
  });

  it('yields nothing when the piece is larger than the sheet', () => {
    expect(fitOnSheet('SRA3', 700, 990, 10).up).toBe(0);
  });

  it('loses pieces as the gripper margin grows', () => {
    const small = fitOnSheet('B2', 148, 210, 10).up;
    const large = fitOnSheet('B2', 148, 210, 120).up;
    expect(large).toBeLessThan(small);
  });
});

describe('signature schemes', () => {
  it('knows how many pages each scheme carries', () => {
    expect(pagesInScheme('4pp')).toBe(4);
    expect(pagesInScheme('8pp')).toBe(8);
    expect(pagesInScheme('16pp')).toBe(16);
  });

  it('uses folio orders where front and back together cover every page once', () => {
    for (const scheme of ['4pp', '8pp', '16pp'] as SignatureScheme[]) {
      const { front, back } = SCHEME_PAGES[scheme];
      const all = [...front, ...back].sort((a, b) => a - b);
      const expected = Array.from({ length: pagesInScheme(scheme) }, (_, i) => i + 1);
      expect(all, scheme).toEqual(expected);
      expect(front.length, scheme).toBe(back.length);
    }
  });

  it('pairs pages that sum to one more than the signature, as a folded sheet does', () => {
    // 4pp: 4+1 and 2+3 both make 5. That is what folding produces, and getting
    // it wrong prints a booklet whose pages are out of order after the fold.
    const { front, back } = SCHEME_PAGES['4pp'];
    expect(front[0]! + front[1]!).toBe(5);
    expect(back[0]! + back[1]!).toBe(5);
  });

  it('picks the largest scheme the sheet and page count will carry', () => {
    expect(largestSchemeThatFits('B1', 148, 210, 16)).toBe('16pp');
    // Only 8 pages to place, so a 16pp form cannot be filled.
    expect(largestSchemeThatFits('B1', 148, 210, 8)).toBe('8pp');
    // A large page on a small sheet falls back to the smallest scheme.
    expect(largestSchemeThatFits('SRA3', 297, 420, 16)).toBe('4pp');
  });
});

describe('buildPlan', () => {
  it('lays out both forms of a saddle-stitched signature', () => {
    const plan = buildPlan(input(), 148, 210);
    expect(plan.fits).toBe(true);
    expect(plan.forms).toHaveLength(2);
    expect(plan.forms[0]!.side).toBe('FRONT');
    expect(plan.forms[1]!.side).toBe('BACK');

    /**
     * `upCount` is pages per *form*, not per signature. An 8pp signature is a
     * 2 × 2 grid printed on both sides: 4 up, 8 pages. Conflating the two is
     * how a booklet ends up ordered half right.
     */
    expect(plan.upCount).toBe(4);
    expect(plan.forms[0]!.pages).toHaveLength(4);
    expect(plan.forms[0]!.pages.length + plan.forms[1]!.pages.length).toBe(
      pagesInScheme(plan.input.scheme),
    );
  });

  it('places every page inside the sheet', () => {
    const plan = buildPlan(input(), 148, 210);
    for (const form of plan.forms) {
      for (const page of form.pages) {
        expect(page.xMm).toBeGreaterThanOrEqual(0);
        expect(page.yMm).toBeGreaterThanOrEqual(0);
        expect(page.xMm + page.widthMm).toBeLessThanOrEqual(plan.sheetWidthMm);
        expect(page.yMm + page.heightMm).toBeLessThanOrEqual(plan.sheetHeightMm);
      }
    }
  });

  it('inverts the top row, as a real form does', () => {
    const plan = buildPlan(input(), 148, 210);
    const rotated = plan.forms[0]!.pages.filter((page) => page.rotated);
    expect(rotated.length).toBeGreaterThan(0);
  });

  it('reports a miss rather than drawing off the edge', () => {
    // A3 pages, 16-up, on the smallest sheet: nowhere near.
    const plan = buildPlan(input({ sheetId: 'SRA3', scheme: '16pp' }), 297, 420);
    expect(plan.fits).toBe(false);
    expect(plan.fitNote).toMatch(/Move up a sheet size|smaller signature/);
  });

  it('counts one signature per 8pp of a 16pp booklet', () => {
    const plan = buildPlan(input({ pageCount: 16, scheme: '8pp', quantity: 500 }), 148, 210);
    expect(plan.signatures).toBe(2);
    expect(plan.sheetsRequired).toBe(2 * 500);
  });

  it('steps and repeats flat work on one form', () => {
    const plan = buildPlan(input({ binding: 'none', quantity: 1000 }), 148, 210);
    expect(plan.forms).toHaveLength(1);
    expect(plan.signatures).toBe(1);
    expect(plan.upCount).toBe(9);
    expect(plan.sheetsRequired).toBe(Math.ceil(1000 / 9));
    // Flat work is guillotined apart, so the pieces need a gutter for the bleed.
    expect(plan.gutterMm).toBe(BLEED_MM * 2);
  });

  it('writes a fold sequence that names the work style and the creep', () => {
    const plan = buildPlan(input({ workStyle: 'work-and-turn', creepMm: 1.5 }), 148, 210);
    expect(plan.foldSequence.join(' ')).toMatch(/turn the sheet left to right/);
    expect(plan.foldSequence.join(' ')).toMatch(/1\.5mm/);
  });

  it('describes tumbling as changing the gripper edge', () => {
    const plan = buildPlan(input({ workStyle: 'work-and-tumble' }), 148, 210);
    expect(plan.foldSequence[0]).toMatch(/tumble|gripper edge changes/i);
  });

  it('gives perfect binding a milling step and saddle stitch a wire', () => {
    const perfect = buildPlan(input({ binding: 'perfect-bound' }), 148, 210);
    expect(perfect.foldSequence.join(' ')).toMatch(/PUR glue/);

    const saddle = buildPlan(input({ binding: 'saddle-stitch' }), 148, 210);
    expect(saddle.foldSequence.join(' ')).toMatch(/Stitch two wires/);
  });

  it('is a pure function of its inputs', () => {
    const first = buildPlan(input(), 148, 210);
    const second = buildPlan(input(), 148, 210);
    expect(first).toEqual(second);
  });
});

describe('wasteFor', () => {
  it('charges litho a make-ready that digital does not carry', () => {
    expect(wasteFor(1000, false)).toBeGreaterThan(wasteFor(1000, true));
  });

  it('grows with the run length', () => {
    expect(wasteFor(10_000, false)).toBeGreaterThan(wasteFor(1000, false));
  });

  it('always returns whole sheets — half a sheet cannot be spoiled', () => {
    for (const sheets of [1, 137, 2500, 9999]) {
      expect(Number.isInteger(wasteFor(sheets, false))).toBe(true);
      expect(Number.isInteger(wasteFor(sheets, true))).toBe(true);
    }
  });
});

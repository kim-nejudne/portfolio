import { PREFLIGHT_CHECKS, runCheck, type CheckContext } from './checks';
import type { PreflightCheckId, QuoteInput, StockRate } from '@forme/domain';
import type { Box, PdfInfo } from './pdf-tools';

/**
 * The checks are pure functions over a context, so they are tested against
 * synthetic measurements rather than real PDFs. That is deliberate: these
 * assertions are about the *findings* — the exact sentence a prepress
 * technician reads and acts on — and pinning them to generated artwork would
 * make the strings hostage to whichever ghostscript version is installed.
 *
 * pdf-tools.spec.ts covers the other half: that real tool output parses into
 * this context correctly.
 */

const MM_TO_PT = 72 / 25.4;

function box(widthMm: number, heightMm: number, offsetMm = 0): Box {
  return {
    x1: offsetMm * MM_TO_PT,
    y1: offsetMm * MM_TO_PT,
    x2: (offsetMm + widthMm) * MM_TO_PT,
    y2: (offsetMm + heightMm) * MM_TO_PT,
  };
}

const SILK_150: StockRate = {
  id: 'silk-150',
  label: 'Silk 150gsm',
  gsm: 150,
  coated: true,
  inkLimit: 300,
  multiplier: 1000,
};

const UNCOATED: StockRate = { ...SILK_150, id: 'uncoated-170', coated: false, inkLimit: 260 };

const SPEC: QuoteInput = {
  product: 'flyers',
  size: 'A5',
  pageCount: null,
  stock: 'silk-150',
  colours: '4/4',
  quantity: 1000,
  finishing: ['trim'],
  turnaround: 'standard',
};

/** An A5 job whose artwork is correct: 148 × 210 trim inside a 3mm bleed. */
function context(overrides: Partial<CheckContext> = {}): CheckContext {
  const info: PdfInfo = {
    pages: 1,
    pdfVersion: '1.6',
    outputIntent: 'declared',
    encrypted: false,
    boxes: [
      {
        page: 1,
        mediaBox: box(154, 216),
        cropBox: box(154, 216),
        bleedBox: box(154, 216),
        trimBox: box(148, 210, 3),
        artBox: null,
      },
    ],
  };
  return {
    spec: SPEC,
    orderedWidthMm: 148,
    orderedHeightMm: 210,
    stock: SILK_150,
    info,
    fonts: [],
    images: [],
    inkCoverage: [{ page: 1, c: 0.2, m: 0.2, y: 0.2, k: 0.2 }],
    bboxes: [{ page: 1, box: box(120, 180, 20) }],
    unavailable: new Set<string>(),
    ...overrides,
  };
}

function run(id: PreflightCheckId, ctx: CheckContext) {
  const definition = PREFLIGHT_CHECKS.find((check) => check.id === id);
  if (!definition) throw new Error(`No check ${id}`);
  return runCheck(definition, ctx);
}

describe('the check set', () => {
  it('is exactly the twelve the specification names, with no duplicates', () => {
    expect(PREFLIGHT_CHECKS).toHaveLength(12);
    const ids = PREFLIGHT_CHECKS.map((check) => check.id);
    expect(new Set(ids).size).toBe(12);
  });

  it('gives every check a human label', () => {
    for (const check of PREFLIGHT_CHECKS) {
      expect(check.label.length).toBeGreaterThan(3);
    }
  });
});

describe('trim-size', () => {
  it('passes artwork cut to the ordered size', () => {
    const outcome = run('trim-size', context());
    expect(outcome.severity).toBe('PASS');
    expect(outcome.measured).toBe('148 × 210mm');
  });

  it('fails and states both sizes when the artwork is the wrong size', () => {
    const ctx = context({ orderedWidthMm: 148, orderedHeightMm: 210 });
    ctx.info.boxes[0]!.trimBox = box(210, 297, 3);
    const outcome = run('trim-size', ctx);
    expect(outcome.severity).toBe('FAIL');
    expect(outcome.finding).toBe('148 × 210mm ordered, artwork trim box 210 × 297mm.');
  });

  it('accepts the ordered size turned on its side', () => {
    // Portrait artwork for a landscape order is an imposition decision, not a
    // preflight failure.
    const ctx = context({ orderedWidthMm: 210, orderedHeightMm: 148 });
    expect(run('trim-size', ctx).severity).toBe('PASS');
  });

  it('fails loudly when the file declares no geometry at all', () => {
    const ctx = context();
    ctx.info.boxes = [];
    const outcome = run('trim-size', ctx);
    expect(outcome.severity).toBe('FAIL');
    expect(outcome.finding).toMatch(/may be damaged/);
  });
});

describe('bleed', () => {
  it('passes 3mm on all four edges', () => {
    const outcome = run('bleed', context());
    expect(outcome.severity).toBe('PASS');
    expect(outcome.measured).toBe('top 3mm, right 3mm, bottom 3mm, left 3mm');
  });

  it('names the edges that are short, not just that bleed is missing', () => {
    const ctx = context();
    // Trim flush to the bottom-left: no bleed on those two edges.
    ctx.info.boxes[0]!.trimBox = box(148, 210, 0);
    ctx.info.boxes[0]!.bleedBox = box(154, 216, 0);
    const outcome = run('bleed', ctx);
    expect(outcome.severity).toBe('FAIL');
    expect(outcome.finding).toContain('bottom 0mm');
    expect(outcome.finding).toContain('left 0mm');
    expect(outcome.finding).toContain('top 6mm');
  });

  it('fails when there is no bleed box to measure', () => {
    const ctx = context();
    ctx.info.boxes[0]!.bleedBox = null;
    ctx.info.boxes[0]!.mediaBox = null;
    const outcome = run('bleed', ctx);
    expect(outcome.severity).toBe('FAIL');
    expect(outcome.finding).toMatch(/no BleedBox/);
  });
});

describe('safety-margin', () => {
  it('passes when everything clears 4mm', () => {
    expect(run('safety-margin', context()).severity).toBe('PASS');
  });

  it('warns with the page and the measured clearance', () => {
    const ctx = context({ bboxes: [{ page: 1, box: box(146, 208, 4) }] });
    const outcome = run('safety-margin', ctx);
    expect(outcome.severity).toBe('WARN');
    expect(outcome.finding).toMatch(/^Page 1: live matter [\d.]+mm from trim, 4mm required\.$/);
  });

  it('ignores artwork that deliberately bleeds off the trim', () => {
    // Marks outside the trim box are a full-bleed design; that is the bleed
    // check's business, and flagging it here would cry wolf on every flyer.
    const ctx = context({ bboxes: [{ page: 1, box: box(154, 216, 0) }] });
    expect(run('safety-margin', ctx).severity).toBe('PASS');
  });

  it('reports SKIPPED rather than PASS when ghostscript produced nothing', () => {
    const outcome = run('safety-margin', context({ bboxes: [] }));
    expect(outcome.severity).toBe('SKIPPED');
  });
});

describe('fonts-embedded', () => {
  it('passes a file with no fonts at all', () => {
    const outcome = run('fonts-embedded', context({ fonts: [] }));
    expect(outcome.severity).toBe('PASS');
    expect(outcome.finding).toMatch(/No fonts in the file/);
  });

  it('names the fonts that are missing', () => {
    const outcome = run(
      'fonts-embedded',
      context({
        fonts: [
          { name: 'Archivo', type: 'TrueType', embedded: true, subset: true },
          { name: 'Helvetica Neue', type: 'Type 1', embedded: false, subset: false },
          { name: 'Frutiger LT 55', type: 'Type 1', embedded: false, subset: false },
        ],
      }),
    );
    expect(outcome.severity).toBe('FAIL');
    expect(outcome.finding).toBe('2 of 3 not embedded: Helvetica Neue, Frutiger LT 55.');
  });

  it('summarises rather than listing thirty names', () => {
    const fonts = Array.from({ length: 9 }, (_, i) => ({
      name: `Face ${i}`,
      type: 'Type 1',
      embedded: false,
      subset: false,
    }));
    expect(run('fonts-embedded', context({ fonts })).finding).toMatch(/\+5 more\.$/);
  });
});

describe('image-resolution', () => {
  it('passes vector-only artwork without claiming to have measured anything', () => {
    const outcome = run('image-resolution', context({ images: [] }));
    expect(outcome.severity).toBe('PASS');
    expect(outcome.finding).toMatch(/Vector artwork only/);
  });

  it('warns on the lowest effective resolution and names its page', () => {
    const outcome = run(
      'image-resolution',
      context({
        images: [
          { page: 1, width: 0, height: 0, colorSpace: 'icc', bpc: '8', xPpi: 300, yPpi: 300 },
          { page: 2, width: 0, height: 0, colorSpace: 'icc', bpc: '8', xPpi: 147, yPpi: 150 },
        ],
      }),
    );
    expect(outcome.severity).toBe('WARN');
    expect(outcome.finding).toBe('Page 2: placed image 147ppi effective, 300ppi required.');
  });
});

describe('colour-space', () => {
  it('fails RGB images in a CMYK job and lists the pages', () => {
    const outcome = run(
      'colour-space',
      context({
        images: [
          { page: 1, width: 0, height: 0, colorSpace: 'rgb', bpc: '8', xPpi: 300, yPpi: 300 },
          { page: 3, width: 0, height: 0, colorSpace: 'rgb', bpc: '8', xPpi: 300, yPpi: 300 },
          { page: 4, width: 0, height: 0, colorSpace: 'icc', bpc: '8', xPpi: 300, yPpi: 300 },
        ],
      }),
    );
    expect(outcome.severity).toBe('FAIL');
    expect(outcome.finding).toBe('2 RGB images found in a CMYK job (pages 1, 3).');
  });

  it('uses the singular for one offending image', () => {
    const outcome = run(
      'colour-space',
      context({
        images: [
          { page: 2, width: 0, height: 0, colorSpace: 'rgb', bpc: '8', xPpi: 300, yPpi: 300 },
        ],
      }),
    );
    expect(outcome.finding).toBe('1 RGB image found in a CMYK job (page 2).');
  });
});

describe('total-area-coverage', () => {
  it('passes within the limit for the stock', () => {
    const outcome = run('total-area-coverage', context());
    expect(outcome.severity).toBe('PASS');
    expect(outcome.measured).toBe('80%');
  });

  it('warns above the limit and names the worst page', () => {
    const outcome = run(
      'total-area-coverage',
      context({
        inkCoverage: [
          { page: 1, c: 0.5, m: 0.5, y: 0.5, k: 0.5 },
          { page: 2, c: 0.9, m: 0.85, y: 0.85, k: 0.68 },
        ],
      }),
    );
    expect(outcome.severity).toBe('WARN');
    expect(outcome.finding).toBe('Page 2 peak TAC 328%, limit 300% on coated stock.');
  });

  it('applies the tighter uncoated limit', () => {
    const outcome = run(
      'total-area-coverage',
      context({
        stock: UNCOATED,
        inkCoverage: [{ page: 1, c: 0.7, m: 0.7, y: 0.7, k: 0.7 }],
      }),
    );
    expect(outcome.severity).toBe('WARN');
    expect(outcome.finding).toMatch(/limit 260% on uncoated stock/);
  });

  it('reports SKIPPED when ghostscript produced no coverage', () => {
    expect(run('total-area-coverage', context({ inkCoverage: [] })).severity).toBe('SKIPPED');
  });
});

describe('page-count', () => {
  it('checks a booklet against the ordered page count', () => {
    const ctx = context({ spec: { ...SPEC, product: 'booklets', pageCount: 24 } });
    ctx.info.pages = 22;
    const outcome = run('page-count', ctx);
    expect(outcome.severity).toBe('FAIL');
    expect(outcome.finding).toBe('24pp ordered, 22pp supplied.');
  });

  it('passes a booklet that matches', () => {
    const ctx = context({ spec: { ...SPEC, product: 'booklets', pageCount: 24 } });
    ctx.info.pages = 24;
    expect(run('page-count', ctx).severity).toBe('PASS');
  });

  it('has nothing to check on flat work', () => {
    const outcome = run('page-count', context());
    expect(outcome.severity).toBe('PASS');
    expect(outcome.finding).toMatch(/Flat work, no page count ordered/);
  });
});

describe('pdfx4', () => {
  it('passes a file declaring an output intent', () => {
    expect(run('pdfx4', context()).severity).toBe('PASS');
  });

  it('warns when the output intent is missing', () => {
    const ctx = context();
    ctx.info.outputIntent = null;
    const outcome = run('pdfx4', ctx);
    expect(outcome.severity).toBe('WARN');
    expect(outcome.finding).toBe('PDF 1.6, not PDF/X-4 conformant — output intent missing.');
  });

  it('fails an encrypted file, which the RIP cannot open at all', () => {
    const ctx = context();
    ctx.info.encrypted = true;
    const outcome = run('pdfx4', ctx);
    expect(outcome.severity).toBe('FAIL');
    expect(outcome.finding).toMatch(/encrypted/);
  });
});

describe('the three checks that are not implemented', () => {
  const notImplemented: PreflightCheckId[] = ['spot-colours', 'white-overprint', 'hairlines'];

  it('report SKIPPED, never PASS', () => {
    for (const id of notImplemented) {
      const outcome = run(id, context());
      expect(`${id}:${outcome.severity}`).toBe(`${id}:SKIPPED`);
    }
  });

  it('say plainly why they did not run', () => {
    for (const id of notImplemented) {
      expect(run(id, context()).finding).toMatch(/Not implemented/);
    }
  });
});

describe('missing tooling', () => {
  it('degrades to SKIPPED rather than passing on absent evidence', () => {
    const ctx = context({ unavailable: new Set(['pdffonts']) });
    const outcome = run('fonts-embedded', ctx);
    expect(outcome.severity).toBe('SKIPPED');
    expect(outcome.finding).toMatch(/pdffonts unavailable/);
  });

  it('does not affect checks that did not need the missing tool', () => {
    const ctx = context({ unavailable: new Set(['pdffonts']) });
    expect(run('trim-size', ctx).severity).toBe('PASS');
  });

  it('turns a thrown check into SKIPPED rather than losing the whole report', () => {
    const ctx = context();
    // A malformed context that makes the check throw internally.
    (ctx as unknown as { inkCoverage: unknown }).inkCoverage = null;
    const outcome = run('total-area-coverage', ctx);
    expect(outcome.severity).toBe('SKIPPED');
    expect(outcome.finding).toMatch(/failed to run/);
  });
});

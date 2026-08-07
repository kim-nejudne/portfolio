import {
  ARTWORK_SPEC,
  SKIPPED_REASON,
  type CheckSeverity,
  type PreflightCheckId,
  type QuoteInput,
  type StockRate,
} from '@forme/domain';
import {
  boxHeightMm,
  boxWidthMm,
  round1,
  type FontEntry,
  type ImageEntry,
  type InkCoverage,
  type PageBBox,
  type PdfInfo,
  PT_TO_MM,
} from './pdf-tools';

export interface CheckContext {
  spec: QuoteInput;
  /** The ordered trim size, from the price matrix. */
  orderedWidthMm: number;
  orderedHeightMm: number;
  stock: StockRate;
  info: PdfInfo;
  fonts: FontEntry[];
  images: ImageEntry[];
  inkCoverage: InkCoverage[];
  bboxes: PageBBox[];
  /** Tools that failed to run, so a check can report honestly instead of passing. */
  unavailable: Set<string>;
}

export interface CheckOutcome {
  severity: CheckSeverity;
  measured: string;
  tolerance: string;
  finding: string;
  page: string;
}

export interface PreflightCheckDefinition {
  id: PreflightCheckId;
  label: string;
  /** Tools this check cannot run without. */
  requires: readonly string[];
  run(context: CheckContext): CheckOutcome;
}

const pass = (measured: string, tolerance: string, finding: string, page = ''): CheckOutcome => ({
  severity: 'PASS',
  measured,
  tolerance,
  finding,
  page,
});

const skipped = (tolerance: string): CheckOutcome => ({
  severity: 'SKIPPED',
  measured: 'not measured',
  tolerance,
  finding: SKIPPED_REASON,
  page: '',
});

/** The trim box is what the press cuts to; fall back to crop, then media. */
function effectiveTrim(info: PdfInfo, page: number) {
  const entry = info.boxes.find((box) => box.page === page) ?? info.boxes[0];
  return entry?.trimBox ?? entry?.cropBox ?? entry?.mediaBox ?? null;
}

/* ------------------------------------------------------------------ real */

const pageCount: PreflightCheckDefinition = {
  id: 'page-count',
  label: 'Page count matches order',
  requires: ['pdfinfo'],
  run({ info, spec }) {
    const ordered = spec.product === 'booklets' ? (spec.pageCount ?? 0) : null;
    const measured = `${info.pages}pp`;
    if (ordered === null) {
      return pass(measured, 'any', `${info.pages}pp supplied. Flat work, no page count ordered.`);
    }
    if (info.pages === ordered) {
      return pass(measured, `${ordered}pp`, `${info.pages}pp supplied, as ordered.`);
    }
    return {
      severity: 'FAIL',
      measured,
      tolerance: `${ordered}pp`,
      finding: `${ordered}pp ordered, ${info.pages}pp supplied.`,
      page: '',
    };
  },
};

const trimSize: PreflightCheckDefinition = {
  id: 'trim-size',
  label: 'Trim size matches order',
  requires: ['pdfinfo'],
  run({ info, orderedWidthMm, orderedHeightMm }) {
    const box = effectiveTrim(info, 1);
    if (!box) {
      return {
        severity: 'FAIL',
        measured: 'no page geometry',
        tolerance: `${orderedWidthMm} × ${orderedHeightMm}mm`,
        finding: 'The file declares no page boxes. It may be damaged.',
        page: '',
      };
    }
    const w = round1(boxWidthMm(box));
    const h = round1(boxHeightMm(box));
    const measured = `${w} × ${h}mm`;
    const tolerance = `${orderedWidthMm} × ${orderedHeightMm}mm ±1mm`;

    // Either orientation is acceptable — portrait artwork for a landscape order
    // is an imposition decision, not a preflight failure.
    const upright = Math.abs(w - orderedWidthMm) <= 1 && Math.abs(h - orderedHeightMm) <= 1;
    const turned = Math.abs(w - orderedHeightMm) <= 1 && Math.abs(h - orderedWidthMm) <= 1;
    if (upright || turned) {
      return pass(measured, tolerance, `Trim box ${measured}, as ordered.`);
    }
    return {
      severity: 'FAIL',
      measured,
      tolerance,
      finding: `${orderedWidthMm} × ${orderedHeightMm}mm ordered, artwork trim box ${measured}.`,
      page: 'p1',
    };
  },
};

const bleed: PreflightCheckDefinition = {
  id: 'bleed',
  label: 'Bleed present on all edges',
  requires: ['pdfinfo'],
  run({ info }) {
    const required = ARTWORK_SPEC.bleedMm;
    const tolerance = `${required}mm all round`;
    const entry = info.boxes[0];
    const trim = entry?.trimBox ?? entry?.cropBox;
    const bleedBox = entry?.bleedBox ?? entry?.mediaBox;

    if (!entry || !trim || !bleedBox) {
      return {
        severity: 'FAIL',
        measured: 'no bleed box',
        tolerance,
        finding:
          'The file declares no BleedBox, so there is no bleed to measure. Re-export with 3mm bleed and marks.',
        page: 'p1',
      };
    }

    const edges = {
      top: round1((bleedBox.y2 - trim.y2) * PT_TO_MM),
      right: round1((bleedBox.x2 - trim.x2) * PT_TO_MM),
      bottom: round1((trim.y1 - bleedBox.y1) * PT_TO_MM),
      left: round1((trim.x1 - bleedBox.x1) * PT_TO_MM),
    };
    const measured = `top ${edges.top}mm, right ${edges.right}mm, bottom ${edges.bottom}mm, left ${edges.left}mm`;
    const short = Object.entries(edges).filter(([, mm]) => mm < required - 0.1);

    if (short.length === 0) return pass(measured, tolerance, `Bleed ${measured}.`, 'p1');
    return {
      severity: 'FAIL',
      measured,
      tolerance,
      finding: `${required}mm required — ${measured}.`,
      page: 'p1',
    };
  },
};

const safetyMargin: PreflightCheckDefinition = {
  id: 'safety-margin',
  label: 'Live matter inside safety margin',
  requires: ['gs'],
  run({ info, bboxes }) {
    const required = ARTWORK_SPEC.safetyMm;
    const tolerance = `${required}mm from trim`;
    if (bboxes.length === 0) {
      return skipped(tolerance);
    }

    for (const { page, box } of bboxes) {
      const trim = effectiveTrim(info, page);
      if (!trim) continue;
      const clearances = [
        (box.x1 - trim.x1) * PT_TO_MM,
        (trim.x2 - box.x2) * PT_TO_MM,
        (box.y1 - trim.y1) * PT_TO_MM,
        (trim.y2 - box.y2) * PT_TO_MM,
      ];
      const tightest = Math.min(...clearances);
      // Negative means the marks bleed off the trim, which is intentional on a
      // full-bleed design and is the bleed check's business, not this one.
      if (tightest >= -0.5 && tightest < required) {
        return {
          severity: 'WARN',
          measured: `${round1(tightest)}mm`,
          tolerance,
          finding: `Page ${page}: live matter ${round1(tightest)}mm from trim, ${required}mm required.`,
          page: `p${page}`,
        };
      }
    }
    return pass('clear', tolerance, `All live matter clears the ${required}mm safety margin.`);
  },
};

const fontsEmbedded: PreflightCheckDefinition = {
  id: 'fonts-embedded',
  label: 'Fonts embedded',
  requires: ['pdffonts'],
  run({ fonts }) {
    const tolerance = 'all embedded';
    if (fonts.length === 0) {
      return pass('0 fonts', tolerance, 'No fonts in the file. Nothing to embed.');
    }
    const missing = fonts.filter((font) => !font.embedded);
    const measured = `${fonts.length - missing.length} of ${fonts.length} embedded`;
    if (missing.length === 0) {
      return pass(measured, tolerance, `All ${fonts.length} fonts embedded.`);
    }
    const names = missing.slice(0, 4).map((font) => font.name);
    const suffix = missing.length > names.length ? `, +${missing.length - names.length} more` : '';
    return {
      severity: 'FAIL',
      measured,
      tolerance,
      finding: `${missing.length} of ${fonts.length} not embedded: ${names.join(', ')}${suffix}.`,
      page: '',
    };
  },
};

const imageResolution: PreflightCheckDefinition = {
  id: 'image-resolution',
  label: 'Effective image resolution',
  requires: ['pdfimages'],
  run({ images }) {
    const required = ARTWORK_SPEC.resolutionPpi;
    const tolerance = `${required}ppi`;
    if (images.length === 0) {
      return pass('no raster images', tolerance, 'Vector artwork only. No resolution to check.');
    }
    const lowest = images.reduce((worst, image) =>
      Math.min(image.xPpi, image.yPpi) < Math.min(worst.xPpi, worst.yPpi) ? image : worst,
    );
    const effective = Math.round(Math.min(lowest.xPpi, lowest.yPpi));
    const measured = `${effective}ppi`;
    if (effective >= required) {
      return pass(measured, tolerance, `Lowest effective resolution ${measured} across ${images.length} images.`);
    }
    return {
      severity: 'WARN',
      measured,
      tolerance,
      finding: `Page ${lowest.page}: placed image ${measured} effective, ${required}ppi required.`,
      page: `p${lowest.page}`,
    };
  },
};

const colourSpace: PreflightCheckDefinition = {
  id: 'colour-space',
  label: 'Colour space',
  requires: ['pdfimages'],
  run({ images }) {
    const tolerance = 'CMYK or gray';
    const rgb = images.filter((image) => /rgb/i.test(image.colorSpace));
    const measured = `${images.length - rgb.length} of ${images.length} CMYK or gray`;
    if (images.length === 0) {
      return pass('no raster images', tolerance, 'Vector artwork only.');
    }
    if (rgb.length === 0) {
      return pass(measured, tolerance, 'No RGB images. Separations will be clean.');
    }
    const pages = [...new Set(rgb.map((image) => image.page))].slice(0, 6);
    return {
      severity: 'FAIL',
      measured: `${rgb.length} RGB`,
      tolerance,
      finding: `${rgb.length} RGB image${rgb.length === 1 ? '' : 's'} found in a CMYK job (page${pages.length === 1 ? '' : 's'} ${pages.join(', ')}).`,
      page: `p${pages[0]}`,
    };
  },
};

const totalAreaCoverage: PreflightCheckDefinition = {
  id: 'total-area-coverage',
  label: 'Total area coverage',
  requires: ['gs'],
  run({ inkCoverage, stock }) {
    const limit = stock.inkLimit;
    const tolerance = `${limit}% on ${stock.coated ? 'coated' : 'uncoated'} stock`;
    if (inkCoverage.length === 0) return skipped(tolerance);

    const peak = inkCoverage.reduce((worst, page) => {
      const total = page.c + page.m + page.y + page.k;
      const worstTotal = worst.c + worst.m + worst.y + worst.k;
      return total > worstTotal ? page : worst;
    });
    const peakPercent = Math.round((peak.c + peak.m + peak.y + peak.k) * 100);
    const measured = `${peakPercent}%`;

    if (peakPercent <= limit) {
      return pass(measured, tolerance, `Peak TAC ${measured}, within the ${limit}% limit.`, `p${peak.page}`);
    }
    return {
      severity: 'WARN',
      measured,
      tolerance,
      finding: `Page ${peak.page} peak TAC ${measured}, limit ${limit}% on ${stock.coated ? 'coated' : 'uncoated'} stock.`,
      page: `p${peak.page}`,
    };
  },
};

const pdfx4: PreflightCheckDefinition = {
  id: 'pdfx4',
  label: 'PDF/X-4 conformance',
  requires: ['pdfinfo'],
  run({ info }) {
    const tolerance = ARTWORK_SPEC.standard;
    const measured = `PDF ${info.pdfVersion}`;
    if (info.encrypted) {
      return {
        severity: 'FAIL',
        measured: `${measured}, encrypted`,
        tolerance,
        finding: 'The file is encrypted. Supply an unprotected PDF; the RIP cannot open this one.',
        page: '',
      };
    }
    if (info.outputIntent) {
      return pass(measured, tolerance, `${measured} with an output intent declared.`);
    }
    return {
      severity: 'WARN',
      measured,
      tolerance,
      finding: `${measured}, not PDF/X-4 conformant — output intent missing.`,
      page: '',
    };
  },
};

/* --------------------------------------------------------------- skipped */

/**
 * These three need the PDF content stream parsed — graphics state, stroke
 * widths and separation resources — which this engine does not do. They report
 * SKIPPED with the reason attached rather than passing, because a clean report
 * on an analysis nobody ran is worse than no report at all.
 */
const spotColours: PreflightCheckDefinition = {
  id: 'spot-colours',
  label: 'Unexpected spot colours',
  requires: [],
  run: () => skipped('named separations only'),
};

const whiteOverprint: PreflightCheckDefinition = {
  id: 'white-overprint',
  label: 'White object set to overprint',
  requires: [],
  run: () => skipped('no white overprint'),
};

const hairlines: PreflightCheckDefinition = {
  id: 'hairlines',
  label: 'Hairline strokes',
  requires: [],
  run: () => skipped('0.25pt minimum'),
};

/** Report order. Geometry first, then content, then conformance. */
export const PREFLIGHT_CHECKS: readonly PreflightCheckDefinition[] = [
  trimSize,
  bleed,
  safetyMargin,
  fontsEmbedded,
  imageResolution,
  colourSpace,
  totalAreaCoverage,
  spotColours,
  whiteOverprint,
  hairlines,
  pageCount,
  pdfx4,
];

/** A check whose tooling is missing reports SKIPPED, never PASS. */
export function runCheck(
  definition: PreflightCheckDefinition,
  context: CheckContext,
): CheckOutcome {
  const missing = definition.requires.filter((tool) => context.unavailable.has(tool));
  if (missing.length > 0) {
    return {
      severity: 'SKIPPED',
      measured: 'not measured',
      tolerance: '—',
      finding: `${missing.join(' and ')} unavailable on this server, so this check did not run.`,
      page: '',
    };
  }
  try {
    return definition.run(context);
  } catch (error) {
    return {
      severity: 'SKIPPED',
      measured: 'not measured',
      tolerance: '—',
      finding: `This check failed to run: ${error instanceof Error ? error.message : String(error)}`,
      page: '',
    };
  }
}

import type { PreflightReport } from '@/lib/types';

/**
 * Three report shapes: all-pass, warnings-only, and one with two failures.
 * Every report runs all twelve checks. Findings are written out, never generic.
 */

export const REPORT_CLEAN: PreflightReport = {
  id: 'PF-CLEAN',
  jobReference: 'FM-2608-0404',
  fileName: 'atelier-sur_season-flyer_v3.pdf',
  pages: 2,
  ranAt: '2026-07-29T10:41:00+08:00',
  checks: [
    { id: 'trim-size', label: 'Trim size matches order', severity: 'PASS', measured: '148 \u00d7 210mm', tolerance: '148 \u00d7 210mm \u00b10.5mm', finding: 'Artwork trim box matches the ordered A5 finished size.', page: 'All', waiver: null },
    { id: 'bleed', label: 'Bleed present on all edges', severity: 'PASS', measured: 'top 3mm, right 3mm, bottom 3mm, left 3mm', tolerance: '3mm all edges', finding: '3mm bleed present on all four edges of both pages.', page: 'All', waiver: null },
    { id: 'safety-margin', label: 'Live matter inside safety margin', severity: 'PASS', measured: '5.2mm nearest', tolerance: '4mm from trim', finding: 'Nearest live object sits 5.2mm from trim on page 2.', page: 'All', waiver: null },
    { id: 'fonts-embedded', label: 'Fonts embedded', severity: 'PASS', measured: '6 of 6 embedded', tolerance: 'All fonts embedded', finding: 'All six fonts embedded as subsets.', page: 'All', waiver: null },
    { id: 'image-resolution', label: 'Effective image resolution', severity: 'PASS', measured: '412ppi lowest', tolerance: '300ppi', finding: 'Lowest effective resolution 412ppi on page 1.', page: 'All', waiver: null },
    { id: 'colour-space', label: 'Colour space', severity: 'PASS', measured: 'CMYK only', tolerance: 'CMYK only', finding: 'No RGB or Lab objects. Output intent ISO Coated v2.', page: 'All', waiver: null },
    { id: 'total-area-coverage', label: 'Total area coverage', severity: 'PASS', measured: 'peak 284%', tolerance: '300% coated', finding: 'Peak TAC 284% on page 1, inside the coated limit.', page: 'Page 1', waiver: null },
    { id: 'spot-colours', label: 'Unexpected spot colours', severity: 'PASS', measured: '0 spots', tolerance: 'Named spots only', finding: 'No spot separations found.', page: 'All', waiver: null },
    { id: 'white-overprint', label: 'White object set to overprint', severity: 'PASS', measured: '0 objects', tolerance: 'None permitted', finding: 'No white objects set to overprint.', page: 'All', waiver: null },
    { id: 'hairlines', label: 'Hairline strokes', severity: 'PASS', measured: 'thinnest 0.5pt', tolerance: '0.25pt minimum', finding: 'Thinnest stroke 0.5pt.', page: 'All', waiver: null },
    { id: 'page-count', label: 'Page count matches order', severity: 'PASS', measured: '2pp supplied', tolerance: '2pp ordered', finding: '2pp ordered, 2pp supplied.', page: 'All', waiver: null },
    { id: 'pdfx4', label: 'PDF/X-4 conformance', severity: 'PASS', measured: 'PDF/X-4:2010', tolerance: 'PDF/X-4', finding: 'PDF/X-4:2010 conformant, output intent present.', page: 'All', waiver: null },
  ],
};

export const REPORT_WARN: PreflightReport = {
  id: 'PF-WARN',
  jobReference: 'FM-2608-0417',
  fileName: 'nine-dots_catalogue_48pp_v4.pdf',
  pages: 48,
  ranAt: '2026-07-31T14:06:00+08:00',
  checks: [
    { id: 'trim-size', label: 'Trim size matches order', severity: 'PASS', measured: '148 \u00d7 210mm', tolerance: '148 \u00d7 210mm \u00b10.5mm', finding: 'Trim box matches the ordered A5 finished size on all 48 pages.', page: 'All', waiver: null },
    { id: 'bleed', label: 'Bleed present on all edges', severity: 'PASS', measured: 'top 3mm, right 3mm, bottom 3mm, left 3mm', tolerance: '3mm all edges', finding: '3mm bleed present on all edges.', page: 'All', waiver: null },
    { id: 'safety-margin', label: 'Live matter inside safety margin', severity: 'WARN', measured: '1.8mm from trim', tolerance: '4mm from trim', finding: 'Page 4: text 1.8mm from trim, 4mm required', page: 'Page 4', waiver: null },
    { id: 'fonts-embedded', label: 'Fonts embedded', severity: 'PASS', measured: '9 of 9 embedded', tolerance: 'All fonts embedded', finding: 'All nine fonts embedded as subsets.', page: 'All', waiver: null },
    { id: 'image-resolution', label: 'Effective image resolution', severity: 'WARN', measured: '147ppi effective', tolerance: '300ppi', finding: 'Page 2: placed image 147ppi effective, 300ppi required', page: 'Page 2', waiver: null },
    { id: 'colour-space', label: 'Colour space', severity: 'PASS', measured: 'CMYK only', tolerance: 'CMYK only', finding: 'No RGB objects. Output intent ISO Coated v2.', page: 'All', waiver: null },
    { id: 'total-area-coverage', label: 'Total area coverage', severity: 'WARN', measured: 'peak 328%', tolerance: '300% coated', finding: 'Page 1 peak TAC 328%, limit 300% on coated stock', page: 'Page 1', waiver: null },
    { id: 'spot-colours', label: 'Unexpected spot colours', severity: 'WARN', measured: '1 unnamed spot', tolerance: 'Named spots only', finding: '1 unnamed spot separation: "Colour 1"', page: 'Page 12', waiver: null },
    { id: 'white-overprint', label: 'White object set to overprint', severity: 'PASS', measured: '0 objects', tolerance: 'None permitted', finding: 'No white objects set to overprint.', page: 'All', waiver: null },
    { id: 'hairlines', label: 'Hairline strokes', severity: 'WARN', measured: '14 strokes below 0.25pt', tolerance: '0.25pt minimum', finding: '14 strokes below 0.25pt, will not hold', page: 'Pages 9, 10, 11', waiver: null },
    { id: 'page-count', label: 'Page count matches order', severity: 'PASS', measured: '48pp supplied', tolerance: '48pp ordered', finding: '48pp ordered, 48pp supplied.', page: 'All', waiver: null },
    { id: 'pdfx4', label: 'PDF/X-4 conformance', severity: 'PASS', measured: 'PDF/X-4:2010', tolerance: 'PDF/X-4', finding: 'PDF/X-4:2010 conformant, output intent present.', page: 'All', waiver: null },
  ],
};

export const REPORT_FAIL: PreflightReport = {
  id: 'PF-FAIL',
  jobReference: 'FM-2608-0419',
  fileName: 'kalsada_type-specimen_24pp.pdf',
  pages: 22,
  ranAt: '2026-08-01T16:22:00+08:00',
  checks: [
    { id: 'trim-size', label: 'Trim size matches order', severity: 'FAIL', measured: '216 \u00d7 303mm', tolerance: '210 \u00d7 297mm \u00b10.5mm', finding: '210 \u00d7 297mm ordered, artwork trim box 216 \u00d7 303mm', page: 'All', waiver: null },
    { id: 'bleed', label: 'Bleed present on all edges', severity: 'PASS', measured: 'top 3mm, right 3mm, bottom 3mm, left 3mm', tolerance: '3mm all edges', finding: '3mm bleed present on all edges.', page: 'All', waiver: null },
    { id: 'safety-margin', label: 'Live matter inside safety margin', severity: 'WARN', measured: '2.4mm from trim', tolerance: '4mm from trim', finding: 'Page 7: folio 2.4mm from trim, 4mm required', page: 'Page 7', waiver: null },
    { id: 'fonts-embedded', label: 'Fonts embedded', severity: 'FAIL', measured: '7 of 9 embedded', tolerance: 'All fonts embedded', finding: '2 of 9 not embedded: Helvetica Neue, Frutiger LT 55', page: 'Pages 3, 14', waiver: null },
    { id: 'image-resolution', label: 'Effective image resolution', severity: 'PASS', measured: '361ppi lowest', tolerance: '300ppi', finding: 'Lowest effective resolution 361ppi on page 18.', page: 'All', waiver: null },
    { id: 'colour-space', label: 'Colour space', severity: 'PASS', measured: 'CMYK only', tolerance: 'CMYK only', finding: 'No RGB objects found.', page: 'All', waiver: null },
    { id: 'total-area-coverage', label: 'Total area coverage', severity: 'WARN', measured: 'peak 272%', tolerance: '260% uncoated', finding: 'Page 5 peak TAC 272%, limit 260% on uncoated stock', page: 'Page 5', waiver: null },
    { id: 'spot-colours', label: 'Unexpected spot colours', severity: 'PASS', measured: '1 named spot', tolerance: 'Named spots only', finding: 'One named spot: PANTONE 187 C, as ordered.', page: 'All', waiver: null },
    { id: 'white-overprint', label: 'White object set to overprint', severity: 'PASS', measured: '0 objects', tolerance: 'None permitted', finding: 'No white objects set to overprint.', page: 'All', waiver: null },
    { id: 'hairlines', label: 'Hairline strokes', severity: 'WARN', measured: '6 strokes below 0.25pt', tolerance: '0.25pt minimum', finding: '6 strokes below 0.25pt, will not hold', page: 'Page 21', waiver: null },
    { id: 'page-count', label: 'Page count matches order', severity: 'FAIL', measured: '22pp supplied', tolerance: '24pp ordered', finding: '24pp ordered, 22pp supplied', page: 'All', waiver: null },
    { id: 'pdfx4', label: 'PDF/X-4 conformance', severity: 'WARN', measured: 'PDF 1.6', tolerance: 'PDF/X-4', finding: 'PDF 1.6, not PDF/X-4 conformant \u2014 output intent missing', page: 'All', waiver: null },
  ],
};

export const REPORT_INTAKE: PreflightReport = {
  id: 'PF-INTAKE',
  jobReference: 'FM-2608-0423',
  fileName: 'artwork.pdf',
  pages: 24,
  ranAt: '2026-08-03T09:12:00+08:00',
  checks: [
    { id: 'trim-size', label: 'Trim size matches order', severity: 'PASS', measured: '210 \u00d7 297mm', tolerance: '210 \u00d7 297mm \u00b10.5mm', finding: 'Trim box matches the ordered finished size.', page: 'All', waiver: null },
    { id: 'bleed', label: 'Bleed present on all edges', severity: 'FAIL', measured: 'top 3mm, right 3mm, bottom 0mm, left 3mm', tolerance: '3mm all edges', finding: '3mm required \u2014 top 3mm, right 3mm, bottom 0mm, left 3mm', page: 'All', waiver: null },
    { id: 'safety-margin', label: 'Live matter inside safety margin', severity: 'WARN', measured: '1.8mm from trim', tolerance: '4mm from trim', finding: 'Page 4: text 1.8mm from trim, 4mm required', page: 'Page 4', waiver: null },
    { id: 'fonts-embedded', label: 'Fonts embedded', severity: 'PASS', measured: '5 of 5 embedded', tolerance: 'All fonts embedded', finding: 'All five fonts embedded as subsets.', page: 'All', waiver: null },
    { id: 'image-resolution', label: 'Effective image resolution', severity: 'WARN', measured: '147ppi effective', tolerance: '300ppi', finding: 'Page 2: placed image 147ppi effective, 300ppi required', page: 'Page 2', waiver: null },
    { id: 'colour-space', label: 'Colour space', severity: 'FAIL', measured: '6 RGB images', tolerance: 'CMYK only', finding: '6 RGB images found in a CMYK job (pages 1, 3, 7)', page: 'Pages 1, 3, 7', waiver: null },
    { id: 'total-area-coverage', label: 'Total area coverage', severity: 'WARN', measured: 'peak 328%', tolerance: '300% coated', finding: 'Page 1 peak TAC 328%, limit 300% on coated stock', page: 'Page 1', waiver: null },
    { id: 'spot-colours', label: 'Unexpected spot colours', severity: 'WARN', measured: '1 unnamed spot', tolerance: 'Named spots only', finding: '1 unnamed spot separation: "Colour 1"', page: 'Page 6', waiver: null },
    { id: 'white-overprint', label: 'White object set to overprint', severity: 'PASS', measured: '0 objects', tolerance: 'None permitted', finding: 'No white objects set to overprint.', page: 'All', waiver: null },
    { id: 'hairlines', label: 'Hairline strokes', severity: 'PASS', measured: 'thinnest 0.35pt', tolerance: '0.25pt minimum', finding: 'Thinnest stroke 0.35pt.', page: 'All', waiver: null },
    { id: 'page-count', label: 'Page count matches order', severity: 'PASS', measured: '24pp supplied', tolerance: '24pp ordered', finding: '24pp ordered, 24pp supplied.', page: 'All', waiver: null },
    { id: 'pdfx4', label: 'PDF/X-4 conformance', severity: 'WARN', measured: 'PDF 1.6', tolerance: 'PDF/X-4', finding: 'PDF 1.6, not PDF/X-4 conformant \u2014 output intent missing', page: 'All', waiver: null },
  ],
};

export const PREFLIGHT_REPORTS: readonly PreflightReport[] = [
  REPORT_CLEAN,
  REPORT_WARN,
  REPORT_FAIL,
  REPORT_INTAKE,
];

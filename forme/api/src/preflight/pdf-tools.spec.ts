import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  boxHeightMm,
  boxWidthMm,
  ghostscriptBBox,
  ghostscriptInkCoverage,
  pdfFonts,
  pdfImages,
  pdfInfo,
} from './pdf-tools';

const run = promisify(execFile);

/**
 * Integration tests for the parsers, against PDFs generated here by ghostscript.
 *
 * These exist because the parsers read the *text output* of four external
 * programs, and that output is the one thing a unit test cannot honestly fake.
 * The single-page/multi-page distinction below is not hypothetical: pdfinfo
 * prints "MediaBox:" for a one-page file and "Page 1 MediaBox:" for a
 * multi-page one, and only matching the second form silently dropped TrimBox
 * and BleedBox on every flyer and poster — which reads downstream as "no bleed
 * declared" and produces confident false failures.
 *
 * Skipped rather than failed when the tooling is absent, so the suite still
 * runs on a machine without poppler.
 */

const TIMEOUT = 60_000;

/**
 * Detected synchronously at module load, not in beforeAll.
 *
 * `describe` bodies run before any hook, so a flag set in beforeAll is still
 * false when `maybe()` decides whether to skip — which silently skipped this
 * entire file on a machine that had the tools installed all along.
 */
function has(binary: string, args: string[]): boolean {
  try {
    execFileSync(binary, args, { timeout: 10_000, stdio: 'ignore' });
    return true;
  } catch (error) {
    // Non-zero exit is fine — several of these exit non-zero for -v.
    return (error as NodeJS.ErrnoException).code !== 'ENOENT';
  }
}

const toolsPresent = has('pdfinfo', ['-v']) && has('gs', ['--version']);
let dir = '';

const SINGLE_PAGE = `%!PS
<< /PageSize [437 612] >> setpagedevice
[{ThisPage} << /TrimBox [8.504 8.504 428.5 603.5] /BleedBox [0 0 437 612] >> /PUT pdfmark
/Helvetica findfont 10 scalefont setfont
0 0 0 1 setcmykcolor
100 300 moveto (single page) show
0.5 0.4 0.4 0.3 setcmykcolor
50 50 200 150 rectfill
showpage
`;

const THREE_PAGES = `%!PS
/Helvetica findfont 12 scalefont setfont
72 700 moveto (page one) show showpage
72 700 moveto (page two) show showpage
72 700 moveto (page three) show showpage
`;

beforeAll(async () => {
  if (!toolsPresent) return;

  dir = await mkdtemp(join(tmpdir(), 'forme-pdf-'));
  for (const [name, source] of [
    ['single', SINGLE_PAGE],
    ['three', THREE_PAGES],
  ] as const) {
    const psPath = join(dir, `${name}.ps`);
    await writeFile(psPath, source, 'utf8');
    await run('gs', [
      '-q',
      '-o',
      join(dir, `${name}.pdf`),
      '-sDEVICE=pdfwrite',
      '-dNOPAUSE',
      '-dBATCH',
      psPath,
    ]);
  }
}, TIMEOUT);

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const maybe = (): jest.It => (toolsPresent ? it : it.skip);

if (!toolsPresent) {
  // Loud, so a CI box missing poppler does not quietly report a green suite.
  console.warn('poppler-utils or ghostscript missing — PDF parser tests skipped.');
}

describe('pdfInfo', () => {
  maybe()(
    'parses the bare box form a single-page file emits',
    async () => {
      const info = await pdfInfo(join(dir, 'single.pdf'), TIMEOUT);
      expect(info.pages).toBe(1);
      expect(info.encrypted).toBe(false);
      expect(info.boxes).toHaveLength(1);

      const page = info.boxes[0]!;
      expect(page.trimBox).not.toBeNull();
      expect(page.bleedBox).not.toBeNull();
      // The regression this file exists for: a bare "TrimBox:" line must parse.
      expect(Math.round(boxWidthMm(page.trimBox!))).toBe(148);
      expect(Math.round(boxHeightMm(page.trimBox!))).toBe(210);
    },
    TIMEOUT,
  );

  maybe()(
    'parses the "Page N" box form a multi-page file emits',
    async () => {
      const info = await pdfInfo(join(dir, 'three.pdf'), TIMEOUT);
      expect(info.pages).toBe(3);
      expect(info.boxes.map((box) => box.page)).toEqual([1, 2, 3]);
      for (const page of info.boxes) {
        expect(page.mediaBox).not.toBeNull();
      }
    },
    TIMEOUT,
  );

  maybe()(
    'reports a PDF version',
    async () => {
      const info = await pdfInfo(join(dir, 'single.pdf'), TIMEOUT);
      expect(info.pdfVersion).toMatch(/^\d+\.\d+$/);
    },
    TIMEOUT,
  );
});

describe('pdfFonts', () => {
  maybe()(
    'detects a base-14 font as present but not embedded',
    async () => {
      // ghostscript does not embed the standard 14, which makes this a reliable
      // fixture for the failure case rather than a lucky accident.
      const fonts = await pdfFonts(join(dir, 'single.pdf'), TIMEOUT);
      expect(fonts.length).toBeGreaterThan(0);
      const helvetica = fonts.find((font) => font.name.includes('Helvetica'));
      expect(helvetica).toBeDefined();
      expect(helvetica!.embedded).toBe(false);
    },
    TIMEOUT,
  );
});

describe('pdfImages', () => {
  maybe()(
    'returns nothing for vector-only artwork',
    async () => {
      expect(await pdfImages(join(dir, 'single.pdf'), TIMEOUT)).toEqual([]);
    },
    TIMEOUT,
  );
});

describe('ghostscriptInkCoverage', () => {
  maybe()(
    'returns one CMYK reading per page',
    async () => {
      const coverage = await ghostscriptInkCoverage(join(dir, 'three.pdf'), TIMEOUT);
      expect(coverage).toHaveLength(3);
      for (const page of coverage) {
        for (const value of [page.c, page.m, page.y, page.k]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    },
    TIMEOUT,
  );

  maybe()(
    'measures more ink on a page carrying a heavy block',
    async () => {
      const [single] = await ghostscriptInkCoverage(join(dir, 'single.pdf'), TIMEOUT);
      const [text] = await ghostscriptInkCoverage(join(dir, 'three.pdf'), TIMEOUT);
      const tac = (p: { c: number; m: number; y: number; k: number }) => p.c + p.m + p.y + p.k;
      expect(tac(single!)).toBeGreaterThan(tac(text!));
    },
    TIMEOUT,
  );
});

describe('ghostscriptBBox', () => {
  maybe()(
    'reads the ink bounding box from stderr, one per page',
    async () => {
      // gs writes bbox to stderr, not stdout. Reading the wrong stream returns
      // an empty list, which the safety-margin check would report as SKIPPED
      // rather than fail loudly — so this is worth pinning.
      const boxes = await ghostscriptBBox(join(dir, 'three.pdf'), TIMEOUT);
      expect(boxes).toHaveLength(3);
      for (const entry of boxes) {
        expect(entry.box.x2).toBeGreaterThan(entry.box.x1);
        expect(entry.box.y2).toBeGreaterThan(entry.box.y1);
      }
    },
    TIMEOUT,
  );
});

describe('robustness', () => {
  maybe()(
    'refuses a file that is not a PDF rather than hanging',
    async () => {
      const bogus = join(dir, 'not.pdf');
      await writeFile(bogus, 'PK this is a zip', 'utf8');
      await expect(pdfInfo(bogus, 10_000)).rejects.toThrow();
    },
    TIMEOUT,
  );
});

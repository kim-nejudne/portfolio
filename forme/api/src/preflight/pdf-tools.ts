import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Logger } from '@nestjs/common';

const run = promisify(execFile);

const logger = new Logger('PdfTools');

/** PostScript points to millimetres. Every PDF box is in points. */
export const PT_TO_MM = 25.4 / 72;

export class ToolUnavailableError extends Error {
  constructor(readonly tool: string) {
    super(`${tool} is not installed. The checks that depend on it cannot run.`);
    this.name = 'ToolUnavailableError';
  }
}

/**
 * Runs an external binary.
 *
 * Three rules, all non-negotiable given the input is a filename derived from an
 * uploaded file:
 *
 * - **Argument array, never a shell string.** No shell means no quoting bugs and
 *   no way for a filename to become a command.
 * - **A timeout.** ghostscript on a malformed PDF can spin indefinitely, and
 *   this runs on two shared vCPUs.
 * - **An output cap.** `pdfimages -list` on a 500-page catalogue produces
 *   megabytes of stdout; buffering it unbounded is a memory incident.
 */
async function tool(
  binary: string,
  args: string[],
  options: { timeoutMs: number; maxBuffer?: number } = { timeoutMs: 30_000 },
): Promise<string> {
  try {
    const { stdout } = await run(binary, args, {
      timeout: options.timeoutMs,
      maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new ToolUnavailableError(binary);
    // Several of these exit non-zero while still producing usable output
    // (ghostscript on a damaged page, for instance). Prefer partial output to
    // failing the whole report.
    const stdout = (error as { stdout?: string }).stdout;
    if (typeof stdout === 'string' && stdout.length > 0) {
      logger.warn(`${binary} exited non-zero but produced output; using it.`);
      return stdout;
    }
    throw error;
  }
}

export interface PageBoxes {
  /** 1-based page number. */
  page: number;
  mediaBox: Box | null;
  cropBox: Box | null;
  bleedBox: Box | null;
  trimBox: Box | null;
  artBox: Box | null;
}

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PdfInfo {
  pages: number;
  pdfVersion: string;
  /** Present when the file declares a PDF/X output intent. */
  outputIntent: string | null;
  encrypted: boolean;
  boxes: PageBoxes[];
}

const BOX_KEYS = ['MediaBox', 'CropBox', 'BleedBox', 'TrimBox', 'ArtBox'] as const;

function parseBox(line: string): Box | null {
  // "Page 1 MediaBox:     0.00     0.00   612.00   792.00"
  const match = /:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(line);
  if (!match) return null;
  const [x1, y1, x2, y2] = match.slice(1, 5).map(Number) as [number, number, number, number];
  return { x1, y1, x2, y2 };
}

export async function pdfInfo(path: string, timeoutMs: number): Promise<PdfInfo> {
  // -box gives every page's boxes, which is what bleed and trim are measured
  // against. Without it pdfinfo reports only the first page's geometry.
  const stdout = await tool('pdfinfo', ['-box', '-l', '9999', path], { timeoutMs });

  const pages = Number(/^Pages:\s*(\d+)/m.exec(stdout)?.[1] ?? '0');
  const pdfVersion = /^PDF version:\s*(.+)$/m.exec(stdout)?.[1]?.trim() ?? 'unknown';
  const encrypted = /^Encrypted:\s*yes/im.test(stdout);

  /**
   * pdfinfo prints boxes two different ways and both have to be handled:
   *
   *   multi-page:  "Page    1 MediaBox:     0.00 ..."
   *   single-page: "MediaBox:              0.00 ..."
   *
   * Only matching the prefixed form would silently drop TrimBox and BleedBox on
   * every one-page file — which is most flyers and posters, and exactly the
   * artwork the trim and bleed checks exist for. A missing TrimBox reads as
   * "no bleed declared", so the bug would have produced confident false
   * failures rather than an obvious crash.
   */
  const byPage = new Map<number, PageBoxes>();
  const boxEntry = (page: number): PageBoxes => {
    const existing = byPage.get(page);
    if (existing) return existing;
    const created: PageBoxes = {
      page,
      mediaBox: null,
      cropBox: null,
      bleedBox: null,
      trimBox: null,
      artBox: null,
    };
    byPage.set(page, created);
    return created;
  };

  const assign = (entry: PageBoxes, key: (typeof BOX_KEYS)[number], box: Box | null): void => {
    if (key === 'MediaBox') entry.mediaBox = box;
    if (key === 'CropBox') entry.cropBox = box;
    if (key === 'BleedBox') entry.bleedBox = box;
    if (key === 'TrimBox') entry.trimBox = box;
    if (key === 'ArtBox') entry.artBox = box;
  };

  for (const line of stdout.split('\n')) {
    const prefixed = /^Page\s+(\d+)\s+(\w+Box):/.exec(line);
    if (prefixed) {
      assign(boxEntry(Number(prefixed[1])), prefixed[2] as (typeof BOX_KEYS)[number], parseBox(line));
      continue;
    }
    const bare = /^(\w+Box):/.exec(line);
    if (bare && (BOX_KEYS as readonly string[]).includes(bare[1] ?? '')) {
      assign(boxEntry(1), bare[1] as (typeof BOX_KEYS)[number], parseBox(line));
    }
  }

  // Last resort: a "Page size" line, so a damaged file still yields geometry.
  if (byPage.size === 0) {
    const size = /^Page size:\s*([\d.]+) x ([\d.]+)/m.exec(stdout);
    if (size) {
      const entry = boxEntry(1);
      entry.mediaBox = { x1: 0, y1: 0, x2: Number(size[1]), y2: Number(size[2]) };
    }
  }

  return {
    pages,
    pdfVersion,
    outputIntent: /GTS_PDFX|OutputIntent/i.test(stdout) ? 'declared' : null,
    encrypted,
    boxes: [...byPage.values()].sort((a, b) => a.page - b.page),
  };
}

export interface FontEntry {
  name: string;
  type: string;
  embedded: boolean;
  subset: boolean;
}

export async function pdfFonts(path: string, timeoutMs: number): Promise<FontEntry[]> {
  const stdout = await tool('pdffonts', [path], { timeoutMs });
  const lines = stdout.split('\n');
  // Skip the two-line header ("name type ... emb sub uni ...", then dashes).
  const start = lines.findIndex((line) => /^-{3,}/.test(line));
  if (start < 0) return [];

  const fonts: FontEntry[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue;
    // Columns are fixed-width but names contain spaces, so parse from the right:
    // the yes/no flags are the last stable columns.
    const flags = /\b(yes|no)\s+(yes|no)\s+(yes|no)\b/.exec(line);
    if (!flags) continue;
    const head = line.slice(0, flags.index).trim();
    const parts = head.split(/\s{2,}/);
    const name = parts[0]?.trim() ?? '(unnamed)';
    const type = parts[1]?.trim() ?? 'unknown';
    fonts.push({
      name,
      type,
      embedded: flags[1] === 'yes',
      subset: flags[2] === 'yes',
    });
  }
  return fonts;
}

export interface ImageEntry {
  page: number;
  width: number;
  height: number;
  colorSpace: string;
  bpc: string;
  xPpi: number;
  yPpi: number;
}

export async function pdfImages(path: string, timeoutMs: number): Promise<ImageEntry[]> {
  const stdout = await tool('pdfimages', ['-list', path], { timeoutMs, maxBuffer: 16 * 1024 * 1024 });
  const lines = stdout.split('\n');
  const start = lines.findIndex((line) => /^-{3,}/.test(line));
  if (start < 0) return [];

  const images: ImageEntry[] = [];
  for (const line of lines.slice(start + 1)) {
    const cols = line.trim().split(/\s+/);
    // page num type width height color comp bpc enc interp object ID x-ppi y-ppi size ratio
    if (cols.length < 14) continue;
    const xPpi = Number(cols[12]);
    const yPpi = Number(cols[13]);
    if (!Number.isFinite(xPpi) || !Number.isFinite(yPpi)) continue;
    images.push({
      page: Number(cols[0]),
      width: Number(cols[3]),
      height: Number(cols[4]),
      colorSpace: cols[5] ?? 'unknown',
      bpc: cols[7] ?? '',
      xPpi,
      yPpi,
    });
  }
  return images;
}

export interface InkCoverage {
  page: number;
  /** Fractions of 1.0 each; TAC is their sum, expressed as a percentage. */
  c: number;
  m: number;
  y: number;
  k: number;
}

export async function ghostscriptInkCoverage(
  path: string,
  timeoutMs: number,
): Promise<InkCoverage[]> {
  const stdout = await tool(
    'gs',
    [
      '-q',
      '-o',
      '-',
      '-sDEVICE=inkcov',
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-dNumRenderingThreads=1',
      path,
    ],
    { timeoutMs },
  );

  const coverage: InkCoverage[] = [];
  let page = 0;
  for (const line of stdout.split('\n')) {
    // " 0.05835  0.04136  0.04136  0.00000 CMYK OK"
    const match = /^\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+CMYK/.exec(line);
    if (!match) continue;
    page += 1;
    coverage.push({
      page,
      c: Number(match[1]),
      m: Number(match[2]),
      y: Number(match[3]),
      k: Number(match[4]),
    });
  }
  return coverage;
}

export interface PageBBox {
  page: number;
  /** The bounding box of all marks on the page, in points. */
  box: Box;
}

/**
 * The ink bounding box per page, which is what the safety-margin check measures
 * against. ghostscript writes these to stderr, not stdout, so this one reads
 * the error stream deliberately rather than by accident.
 */
export async function ghostscriptBBox(path: string, timeoutMs: number): Promise<PageBBox[]> {
  let stderr = '';
  try {
    const result = await run(
      'gs',
      ['-q', '-o', '-', '-sDEVICE=bbox', '-dNOPAUSE', '-dBATCH', '-dSAFER', path],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
    );
    stderr = result.stderr;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new ToolUnavailableError('gs');
    stderr = (error as { stderr?: string }).stderr ?? '';
    if (stderr === '') throw error;
  }

  const boxes: PageBBox[] = [];
  let page = 0;
  for (const line of stderr.split('\n')) {
    // "%%HiResBoundingBox: 12.000000 14.000000 583.000000 778.000000"
    const match = /^%%HiResBoundingBox:\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/.exec(line);
    if (!match) continue;
    page += 1;
    boxes.push({
      page,
      box: {
        x1: Number(match[1]),
        y1: Number(match[2]),
        x2: Number(match[3]),
        y2: Number(match[4]),
      },
    });
  }
  return boxes;
}

export function boxWidthMm(box: Box): number {
  return (box.x2 - box.x1) * PT_TO_MM;
}

export function boxHeightMm(box: Box): number {
  return (box.y2 - box.y1) * PT_TO_MM;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

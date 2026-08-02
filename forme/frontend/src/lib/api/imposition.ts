import type {
  BindingStyle,
  ImposedPage,
  ImpositionInput,
  ImpositionPlan,
  SheetId,
  SignatureScheme,
  WorkStyle,
} from '@/lib/types';
import { apiDelay } from './delay';
import { readMatrix } from './store';

export interface SheetSpec {
  id: SheetId;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const SHEETS: Record<SheetId, SheetSpec> = {
  SRA3: { id: 'SRA3', label: 'SRA3 320 \u00d7 450mm', widthMm: 320, heightMm: 450 },
  B2: { id: 'B2', label: 'B2 500 \u00d7 707mm', widthMm: 500, heightMm: 707 },
  B1: { id: 'B1', label: 'B1 707 \u00d7 1000mm', widthMm: 707, heightMm: 1000 },
};

export const SHEET_ORDER: readonly SheetId[] = ['SRA3', 'B2', 'B1'];
export const BLEED_MM = 3;
export const EDGE_MM = 5;
export const TAIL_MM = 12;
export const DEFAULT_GRIPPER_MM = 10;

const SCHEME_GRID: Record<SignatureScheme, { cols: number; rows: number }> = {
  '4pp': { cols: 2, rows: 1 },
  '8pp': { cols: 2, rows: 2 },
  '16pp': { cols: 4, rows: 2 },
};

/** Standard folio schemes. Row 0 prints inverted, as it does on a real form. */
const SCHEME_PAGES: Record<SignatureScheme, { front: readonly number[]; back: readonly number[] }> = {
  '4pp': { front: [4, 1], back: [2, 3] },
  '8pp': { front: [5, 4, 8, 1], back: [3, 6, 2, 7] },
  '16pp': { front: [5, 12, 9, 8, 16, 1, 4, 13], back: [7, 10, 11, 6, 14, 3, 2, 15] },
};

export function pagesInScheme(scheme: SignatureScheme): number {
  return scheme === '4pp' ? 4 : scheme === '8pp' ? 8 : 16;
}

export interface FitResult {
  up: number;
  cols: number;
  rows: number;
  rotated: boolean;
}

function usable(sheet: SheetSpec, gripperMm: number) {
  return {
    width: sheet.widthMm - EDGE_MM * 2,
    height: sheet.heightMm - gripperMm - TAIL_MM,
  };
}

/** Step and repeat: how many finished pieces fit on the sheet, bleed included. */
export function fitOnSheet(
  sheetId: SheetId,
  trimWidthMm: number,
  trimHeightMm: number,
  gripperMm = DEFAULT_GRIPPER_MM,
): FitResult {
  const area = usable(SHEETS[sheetId], gripperMm);
  const pitch = (w: number, h: number) => ({ w: w + BLEED_MM * 2, h: h + BLEED_MM * 2 });
  const upright = pitch(trimWidthMm, trimHeightMm);
  const turned = pitch(trimHeightMm, trimWidthMm);
  const a = {
    cols: Math.floor(area.width / upright.w),
    rows: Math.floor(area.height / upright.h),
    rotated: false,
  };
  const b = {
    cols: Math.floor(area.width / turned.w),
    rows: Math.floor(area.height / turned.h),
    rotated: true,
  };
  const first = { ...a, up: a.cols * a.rows };
  const second = { ...b, up: b.cols * b.rows };
  return second.up > first.up ? second : first;
}

/** Does a signature grid fit the sheet at all? */
export function schemeFits(
  sheetId: SheetId,
  scheme: SignatureScheme,
  trimWidthMm: number,
  trimHeightMm: number,
  gripperMm = DEFAULT_GRIPPER_MM,
): boolean {
  const area = usable(SHEETS[sheetId], gripperMm);
  const grid = SCHEME_GRID[scheme];
  const page = { w: trimWidthMm + BLEED_MM * 2, h: trimHeightMm + BLEED_MM * 2 };
  const upright = grid.cols * page.w <= area.width && grid.rows * page.h <= area.height;
  const turned = grid.cols * page.h <= area.width && grid.rows * page.w <= area.height;
  return upright || turned;
}

export function largestSchemeThatFits(
  sheetId: SheetId,
  trimWidthMm: number,
  trimHeightMm: number,
  pageCount: number,
  gripperMm = DEFAULT_GRIPPER_MM,
): SignatureScheme {
  const order: readonly SignatureScheme[] = ['16pp', '8pp', '4pp'];
  for (const scheme of order) {
    if (pagesInScheme(scheme) <= pageCount && schemeFits(sheetId, scheme, trimWidthMm, trimHeightMm, gripperMm)) {
      return scheme;
    }
  }
  return '4pp';
}

/** Make-ready plus run waste. Litho carries a make-ready, digital barely any. */
export function wasteFor(sheets: number, digital: boolean): number {
  if (digital) return 5 + Math.ceil(sheets / 100);
  return 150 + Math.ceil((sheets * 3) / 100);
}

function foldSequence(
  scheme: SignatureScheme,
  binding: BindingStyle,
  workStyle: WorkStyle,
  upCount: number,
  trimWidthMm: number,
  trimHeightMm: number,
  creepMm: number,
): readonly string[] {
  const trim = `${trimWidthMm} \u00d7 ${trimHeightMm}mm`;
  const press =
    workStyle === 'sheetwise'
      ? 'Print the front form, back the sheet up sheetwise on the same gripper edge.'
      : workStyle === 'work-and-turn'
        ? 'Print one form, turn the sheet left to right on the same gripper edge, print the second half from the same plate.'
        : 'Print one form, tumble the sheet head to tail. The gripper edge changes, so the sheet must be square.';

  if (binding === 'none') {
    return [
      press,
      `Guillotine the sheet ${upCount} up down the gutters.`,
      `Trim to ${trim}, 3mm off each edge.`,
      'Band in lifts of 250 and label with the job reference.',
    ];
  }

  const folds: string[] = ['Fold 1: right-angle fold to the spine, 4pp.'];
  if (scheme !== '4pp') folds.push('Fold 2: parallel fold to the head, 8pp.');
  if (scheme === '16pp') folds.push('Fold 3: right-angle fold to the foredge, 16pp.');

  if (binding === 'saddle-stitch') {
    return [
      press,
      ...folds,
      `Creep compensation ${creepMm.toFixed(1)}mm shingled outward from the centre spread.`,
      'Collate the signatures one inside another, spine to the left.',
      'Stitch two wires on the spine, 60mm in from head and tail.',
      `Trim three edges to ${trim}, 3mm off each.`,
    ];
  }

  return [
    press,
    ...folds,
    'Gather the sections side by side, spine down.',
    'Mill 1mm off the spine, notch every 25mm, PUR glue.',
    'Draw on the cover, nip, cure for four hours.',
    `Trim three edges to ${trim}, 3mm off each.`,
  ];
}

export function buildPlan(
  input: ImpositionInput,
  trimWidthMm: number,
  trimHeightMm: number,
): ImpositionPlan {
  const sheet = SHEETS[input.sheetId];
  const area = usable(sheet, input.gripperMm);
  const flat = input.binding === 'none';
  const grid = flat
    ? { cols: 0, rows: 0 }
    : SCHEME_GRID[input.scheme];

  const gutterMm = flat ? BLEED_MM * 2 : 0;
  const fit = fitOnSheet(input.sheetId, trimWidthMm, trimHeightMm, input.gripperMm);

  let cols = flat ? fit.cols : grid.cols;
  let rows = flat ? fit.rows : grid.rows;
  let rotated = flat ? fit.rotated : false;
  let pageW = rotated ? trimHeightMm : trimWidthMm;
  let pageH = rotated ? trimWidthMm : trimHeightMm;

  if (!flat) {
    const uprightFits = grid.cols * trimWidthMm <= area.width && grid.rows * trimHeightMm <= area.height;
    if (!uprightFits) {
      const turnedFits = grid.cols * trimHeightMm <= area.width && grid.rows * trimWidthMm <= area.height;
      if (turnedFits) {
        rotated = true;
        pageW = trimHeightMm;
        pageH = trimWidthMm;
      }
    }
  }

  const gridWidth = cols * pageW + Math.max(cols - 1, 0) * gutterMm;
  const gridHeight = rows * pageH + Math.max(rows - 1, 0) * gutterMm;
  const fits = cols > 0 && rows > 0 && gridWidth <= area.width && gridHeight <= area.height;

  if (!fits && !flat) {
    cols = grid.cols;
    rows = grid.rows;
  }

  const originX = Math.max((sheet.widthMm - gridWidth) / 2, EDGE_MM);
  const originY = Math.max(TAIL_MM + (area.height - gridHeight) / 2, TAIL_MM);

  const cell = (index: number, label: string): ImposedPage => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      key: `${label}-${index}`,
      label,
      xMm: originX + col * (pageW + gutterMm),
      yMm: originY + row * (pageH + gutterMm),
      widthMm: pageW,
      heightMm: pageH,
      rotated: !flat && row === 0 && rows > 1,
    };
  };

  const upCount = Math.max(cols * rows, 0);
  const forms = flat
    ? [
        {
          side: 'FRONT' as const,
          plate: 'Step and repeat, one form',
          pages: Array.from({ length: upCount }, (_, index) =>
            cell(index, (index + 1).toString().padStart(2, '0')),
          ),
        },
      ]
    : (['FRONT', 'BACK'] as const).map((side) => ({
        side,
        plate: side === 'FRONT' ? `${input.scheme} outer form` : `${input.scheme} inner form`,
        pages: (side === 'FRONT' ? SCHEME_PAGES[input.scheme].front : SCHEME_PAGES[input.scheme].back)
          .slice(0, upCount)
          .map((pageNumber, index) => cell(index, pageNumber.toString())),
      }));

  const signatures = flat ? 1 : Math.ceil(input.pageCount / pagesInScheme(input.scheme));
  const sheetsRequired = flat
    ? Math.ceil(input.quantity / Math.max(upCount, 1))
    : signatures * input.quantity;
  const digital = sheetsRequired < 500;

  return {
    input,
    sheetWidthMm: sheet.widthMm,
    sheetHeightMm: sheet.heightMm,
    trimWidthMm,
    trimHeightMm,
    gutterMm,
    upCount,
    cols,
    rows,
    rotated,
    signatures,
    sheetsRequired,
    wasteSheets: wasteFor(sheetsRequired, digital),
    fits,
    fitNote: fits
      ? `${upCount} up on ${sheet.label}, ${area.width}mm \u00d7 ${area.height}mm printable inside a ${input.gripperMm}mm gripper.`
      : `${input.scheme} at ${trimWidthMm} \u00d7 ${trimHeightMm}mm needs ${Math.round(gridWidth)}mm \u00d7 ${Math.round(gridHeight)}mm; ${sheet.label} gives ${area.width}mm \u00d7 ${area.height}mm. Move up a sheet size or drop to a smaller signature.`,
    forms,
    foldSequence: foldSequence(
      input.scheme,
      input.binding,
      input.workStyle,
      upCount,
      trimWidthMm,
      trimHeightMm,
      input.creepMm,
    ),
  };
}

export async function getImpositionPlan(input: ImpositionInput): Promise<ImpositionPlan> {
  await apiDelay(110);
  const size = readMatrix().sizes.find((entry) => entry.id === input.sizeId);
  const width = size ? size.widthMm : 148;
  const height = size ? size.heightMm : 210;
  return buildPlan(input, width, height);
}

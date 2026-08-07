/**
 * The pricing engine. Pure: an input plus a price matrix plus a start date in,
 * a quote out. The API is the authority on prices, but the marketing page and
 * the intake form run this same function, so a quoted price and a charged price
 * cannot drift apart.
 *
 * Every amount is a whole peso held as an integer. Multipliers are integer
 * per-mille, so no float touches a price at any point.
 */
import { addHours, addWorkingDays } from './dates';
import { applyMultiplier, formatInteger, vatOn } from './money';
import type {
  ColoursId,
  FinishingId,
  PressId,
  PriceMatrix,
  ProductId,
  QuoteFieldError,
  QuoteInput,
  QuoteResult,
  SheetId,
  SignatureScheme,
  SizeId,
  StockId,
  TurnaroundId,
} from './types';
import { SHEETS, fitOnSheet, largestSchemeThatFits, pagesInScheme, wasteFor } from './imposition';

export const QUANTITIES: readonly number[] = [100, 250, 500, 1000, 2500, 5000];

/** Booklets are folded from 4pp signatures, and above 160pp we quote by hand. */
export const MIN_BOOKLET_PAGES = 8;
export const MAX_BOOKLET_PAGES = 160;
export const DEFAULT_BOOKLET_PAGES = 24;

export const DEFAULT_QUOTE_INPUT: QuoteInput = {
  product: 'flyers',
  size: 'A5',
  pageCount: null,
  stock: 'silk-150',
  colours: '4/4',
  quantity: 1000,
  finishing: ['trim'],
  turnaround: 'standard',
};

/**
 * The closed sets of every enumerated field. Exported because both sides need
 * them: the web app to coerce a query string, the API to validate a DTO.
 */
export const PRODUCTS: readonly ProductId[] = [
  'business-cards',
  'flyers',
  'booklets',
  'posters',
  'folded-leaflets',
];
export const SIZES: readonly SizeId[] = ['A6', 'A5', 'A4', 'A3', 'DL', '85x55'];
export const STOCKS: readonly StockId[] = [
  'gloss-130',
  'silk-150',
  'uncoated-170',
  'silk-board-300',
  'uncoated-board-350',
  'colorplan-270',
];
export const COLOURS: readonly ColoursId[] = ['4/4', '4/0', '1/1', '5/4'];
export const FINISHES: readonly FinishingId[] = [
  'trim',
  'half-fold',
  'roll-fold',
  'gate-fold',
  'saddle-stitch',
  'perfect-bound',
  'matt-lam',
  'gloss-lam',
  'spot-uv',
  'die-cut',
];
export const TURNAROUNDS: readonly TurnaroundId[] = ['standard', 'express', 'rush'];

/**
 * Validates an already-coerced input. Transport-agnostic: the web app calls it
 * after reading the query string, the API calls it after validating the DTO, so
 * a hand-crafted POST cannot buy a 22pp booklet the UI would have refused.
 */
export function validateQuoteInput(input: QuoteInput): readonly QuoteFieldError[] {
  const errors: QuoteFieldError[] = [];

  if (input.product === 'booklets') {
    const pageCount = input.pageCount ?? DEFAULT_BOOKLET_PAGES;
    if (pageCount % 4 !== 0) {
      errors.push({
        field: 'pageCount',
        message: `${pageCount}pp is not a multiple of 4. A booklet is folded from 4pp signatures, so the page count must be 4, 8, 12 and so on.`,
      });
    }
    if (pageCount < MIN_BOOKLET_PAGES || pageCount > MAX_BOOKLET_PAGES) {
      errors.push({
        field: 'pageCount',
        message: `Page count must be between ${MIN_BOOKLET_PAGES}pp and ${MAX_BOOKLET_PAGES}pp. Above ${MAX_BOOKLET_PAGES}pp the job is quoted by hand.`,
      });
    }
  }

  if (!QUANTITIES.includes(input.quantity)) {
    errors.push({
      field: 'quantity',
      message: `${input.quantity} is not a quoted quantity. Choose ${QUANTITIES.join(', ')}.`,
    });
  }

  if (input.finishing.length === 0) {
    errors.push({
      field: 'finishing',
      message: 'Every job is trimmed at minimum. Choose at least one finishing operation.',
    });
  }

  return errors;
}

interface SheetPlan {
  sheetId: SheetId;
  sheets: number;
  upCount: number;
  scheme: SignatureScheme | null;
}

function planFor(
  input: QuoteInput,
  matrix: PriceMatrix,
  candidates: readonly SheetId[],
): SheetPlan {
  const size = matrix.sizes.find((entry) => entry.id === input.size);
  const width = size ? size.widthMm : 148;
  const height = size ? size.heightMm : 210;
  const booklet = input.product === 'booklets' && input.pageCount !== null;

  const plans = candidates.map((sheetId): SheetPlan => {
    if (booklet && input.pageCount !== null) {
      const scheme = largestSchemeThatFits(sheetId, width, height, input.pageCount);
      const signatures = Math.ceil(input.pageCount / pagesInScheme(scheme));
      return {
        sheetId,
        scheme,
        upCount: pagesInScheme(scheme),
        sheets: signatures * input.quantity,
      };
    }
    const fit = fitOnSheet(sheetId, width, height);
    return {
      sheetId,
      scheme: null,
      upCount: fit.up,
      sheets: fit.up > 0 ? Math.ceil(input.quantity / fit.up) : input.quantity,
    };
  });

  return plans.reduce((best, plan) => (plan.sheets < best.sheets ? plan : best));
}

interface PressChoice {
  press: PressId;
  reason: string;
  plan: SheetPlan;
}

/** The press is chosen by quantity, not by preference. The system says which and why. */
function choosePress(input: QuoteInput, matrix: PriceMatrix): PressChoice {
  const digital = planFor(input, matrix, ['SRA3', 'B2']);
  const litho = planFor(input, matrix, ['B2', 'B1']);

  if (digital.sheets < 500) {
    return {
      press: 'INDIGO',
      plan: digital,
      reason: `${formatInteger(digital.sheets)} sheets \u2014 under 500 sheets a litho make-ready costs more than the run, so it goes digital on INDIGO.`,
    };
  }

  const sheets = formatInteger(litho.sheets);
  if (input.colours === '5/4') {
    return {
      press: 'XL75',
      plan: litho,
      reason: `${sheets} sheets \u2014 litho is cheaper above 500, and 5/4 needs a fifth unit and the coater, running on XL75.`,
    };
  }
  if (litho.sheetId === 'B1') {
    return {
      press: 'G40',
      plan: litho,
      reason: `${sheets} sheets on B1 707 \u00d7 1000mm \u2014 G40 is the only press that takes B1, running on G40.`,
    };
  }
  if (input.colours === '4/4' && litho.sheets >= 2000) {
    return {
      press: 'G40',
      plan: litho,
      reason: `${sheets} sheets \u2014 litho is cheaper above 500, and 4/4 perfects in one pass on G40.`,
    };
  }
  return {
    press: 'XL75',
    plan: litho,
    reason: `${sheets} sheets \u2014 litho is cheaper above 500, running on XL75.`,
  };
}

/** Thrown when the matrix has no rate for something the input asks for. */
export class MissingRateError extends Error {
  constructor(what: string, id: string) {
    super(
      `The price matrix has no ${what} rate for "${id}". A price cannot be computed from an incomplete matrix.`,
    );
    this.name = 'MissingRateError';
  }
}

function requireRate<T extends { id: string }>(
  rows: readonly T[],
  id: string,
  what: string,
): T {
  const found = rows.find((row) => row.id === id);
  // The scaffold fell back to rows[0] here. That silently prices a job off an
  // unrelated rate — a job quoted as business cards and charged as booklets —
  // which is worse than failing. An input this far in has already been
  // validated, so a miss means the matrix is broken and should say so.
  if (!found) throw new MissingRateError(what, id);
  return found;
}

export function computeQuote(input: QuoteInput, matrix: PriceMatrix, fromIso: string): QuoteResult {
  const product = requireRate(matrix.products, input.product, 'product');
  const stock = requireRate(matrix.stocks, input.stock, 'stock');
  const colours = requireRate(matrix.colours, input.colours, 'colour');
  const turnaround = requireRate(matrix.turnarounds, input.turnaround, 'turnaround');

  const breaks = [...matrix.quantityBreaks].sort((a, b) => a.quantity - b.quantity);
  const smallestBand = breaks[0];
  if (!smallestBand) {
    throw new MissingRateError('quantity break', input.quantity.toString());
  }
  // Below the smallest break the smallest band applies — that is a real rule,
  // not a fallback, so it stays.
  const band =
    [...breaks].reverse().find((entry) => input.quantity >= entry.quantity) ?? smallestBand;

  const signatures =
    input.product === 'booklets' && input.pageCount !== null ? input.pageCount / 4 : 1;

  let running = product.setup + Math.round((product.perThousand * input.quantity * signatures) / 1000);
  running = applyMultiplier(running, stock.multiplier);
  running = applyMultiplier(running, colours.multiplier);
  running = applyMultiplier(running, band.multiplier);

  for (const id of input.finishing) {
    const rate = matrix.finishing.find((entry) => entry.id === id);
    if (!rate) continue;
    running += Math.round((rate.perThousand * input.quantity) / 1000) + rate.flat;
  }

  const subtotal = applyMultiplier(running, turnaround.multiplier);
  const vat = vatOn(subtotal);
  const choice = choosePress(input, matrix);
  const digital = choice.press === 'INDIGO';

  const despatchAt =
    input.turnaround === 'rush'
      ? addHours(fromIso, 24)
      : addWorkingDays(fromIso, turnaround.workingDays);

  const notes: string[] = [];
  notes.push(
    choice.plan.scheme === null
      ? `${choice.plan.upCount} up on ${SHEETS[choice.plan.sheetId].label}, 3mm bleed shared between pieces.`
      : `${choice.plan.scheme} signatures on ${SHEETS[choice.plan.sheetId].label}, ${Math.ceil((input.pageCount ?? 0) / pagesInScheme(choice.plan.scheme))} sections per copy.`,
  );
  notes.push(
    stock.coated
      ? `${stock.label} is coated: total ink limit 300%.`
      : `${stock.label} is uncoated: total ink limit 260%.`,
  );
  if (input.turnaround === 'rush') {
    notes.push('Rush is 24 hours from proof approval and carries a 1.800\u00d7 multiplier.');
  } else {
    notes.push(
      `${turnaround.label} is ${turnaround.workingDays} working days from proof approval. The shop is closed on Sundays.`,
    );
  }

  return {
    input,
    unitPrice: Math.round(subtotal / input.quantity),
    subtotal,
    vat,
    total: subtotal + vat,
    press: choice.press,
    pressReason: choice.reason,
    sheetId: choice.plan.sheetId,
    upCount: choice.plan.upCount,
    sheetsRequired: choice.plan.sheets,
    wasteSheets: wasteFor(choice.plan.sheets, digital),
    workingDays: turnaround.workingDays,
    despatchAt,
    scheme: choice.plan.scheme,
    notes,
  };
}

import { addHours, addWorkingDays } from '@/lib/dates';
import { applyMultiplier, formatInteger, vatOn } from '@/lib/money';
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
} from '@/lib/types';
import { getNow } from './clock';
import { apiDelay } from './delay';
import { SHEETS, fitOnSheet, largestSchemeThatFits, pagesInScheme, wasteFor } from './imposition';
import { readMatrix } from './store';

export const QUANTITIES: readonly number[] = [100, 250, 500, 1000, 2500, 5000];

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

const PRODUCTS: readonly ProductId[] = [
  'business-cards',
  'flyers',
  'booklets',
  'posters',
  'folded-leaflets',
];
const SIZES: readonly SizeId[] = ['A6', 'A5', 'A4', 'A3', 'DL', '85x55'];
const STOCKS: readonly StockId[] = [
  'gloss-130',
  'silk-150',
  'uncoated-170',
  'silk-board-300',
  'uncoated-board-350',
  'colorplan-270',
];
const COLOURS: readonly ColoursId[] = ['4/4', '4/0', '1/1', '5/4'];
const FINISHES: readonly FinishingId[] = [
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
const TURNAROUNDS: readonly TurnaroundId[] = ['standard', 'express', 'rush'];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The quote lives in the URL. This is the only place that reads it. */
export function parseQuoteInput(query: Record<string, string | string[] | undefined>): {
  input: QuoteInput;
  errors: readonly QuoteFieldError[];
} {
  const errors: QuoteFieldError[] = [];
  const product = PRODUCTS.find((id) => id === one(query.product)) ?? DEFAULT_QUOTE_INPUT.product;
  const size = SIZES.find((id) => id === one(query.size)) ?? DEFAULT_QUOTE_INPUT.size;
  const stock = STOCKS.find((id) => id === one(query.stock)) ?? DEFAULT_QUOTE_INPUT.stock;
  const colours = COLOURS.find((id) => id === one(query.colours)) ?? DEFAULT_QUOTE_INPUT.colours;
  const turnaround =
    TURNAROUNDS.find((id) => id === one(query.turnaround)) ?? DEFAULT_QUOTE_INPUT.turnaround;

  const rawQuantity = Number.parseInt(one(query.quantity) ?? '', 10);
  const quantity = QUANTITIES.includes(rawQuantity) ? rawQuantity : DEFAULT_QUOTE_INPUT.quantity;

  const finishingParam = query.finishing;
  const rawFinishing = Array.isArray(finishingParam)
    ? finishingParam
    : (finishingParam ?? 'trim').split(',').filter(Boolean);
  const finishing = FINISHES.filter((id) => rawFinishing.includes(id));

  let pageCount: number | null = null;
  if (product === 'booklets') {
    const parsed = Number.parseInt(one(query.pages) ?? '', 10);
    pageCount = Number.isFinite(parsed) ? parsed : 24;
    if (pageCount % 4 !== 0) {
      errors.push({
        field: 'pageCount',
        message: `${pageCount}pp is not a multiple of 4. A booklet is folded from 4pp signatures, so the page count must be 4, 8, 12 and so on.`,
      });
    }
    if (pageCount < 8 || pageCount > 160) {
      errors.push({
        field: 'pageCount',
        message: 'Page count must be between 8pp and 160pp. Above 160pp the job is quoted by hand.',
      });
    }
  }

  return {
    input: {
      product,
      size,
      pageCount,
      stock,
      colours,
      quantity,
      finishing: finishing.length > 0 ? finishing : ['trim'],
      turnaround,
    },
    errors,
  };
}

export function quoteToQuery(input: QuoteInput): string {
  const params = new URLSearchParams({
    product: input.product,
    size: input.size,
    stock: input.stock,
    colours: input.colours,
    quantity: input.quantity.toString(),
    finishing: input.finishing.join(','),
    turnaround: input.turnaround,
  });
  if (input.pageCount !== null) params.set('pages', input.pageCount.toString());
  return params.toString();
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

export function computeQuote(input: QuoteInput, matrix: PriceMatrix, fromIso: string): QuoteResult {
  const product = matrix.products.find((entry) => entry.id === input.product) ?? matrix.products[0];
  const stock = matrix.stocks.find((entry) => entry.id === input.stock) ?? matrix.stocks[0];
  const colours = matrix.colours.find((entry) => entry.id === input.colours) ?? matrix.colours[0];
  const turnaround =
    matrix.turnarounds.find((entry) => entry.id === input.turnaround) ?? matrix.turnarounds[0];
  const breaks = [...matrix.quantityBreaks].sort((a, b) => a.quantity - b.quantity);
  const band =
    [...breaks].reverse().find((entry) => input.quantity >= entry.quantity) ?? breaks[0];

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

export async function getQuote(input: QuoteInput, fromIso = getNow()): Promise<QuoteResult> {
  await apiDelay(90);
  return computeQuote(input, readMatrix(), fromIso);
}

export function quoteFor(input: QuoteInput, fromIso: string): QuoteResult {
  return computeQuote(input, readMatrix(), fromIso);
}

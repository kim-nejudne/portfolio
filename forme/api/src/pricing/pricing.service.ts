import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type {
  ColourRate,
  FinishingRate,
  PriceEdit,
  PriceMatrix,
  ProductRate,
  QuantityBreak,
  SizeRate,
  StockRate,
  TurnaroundRate,
} from '@forme/domain';
import { DATABASE, type Database } from '../db/database.module';
import { priceRates, type PriceRateRow } from '../db/schema';

/** Fields that hold whole pesos or integer per-mille. Never fractional. */
const INTEGER_FIELDS = new Set([
  'setup',
  'perThousand',
  'flat',
  'multiplier',
  'quantity',
  'gsm',
  'inkLimit',
  'plates',
  'workingDays',
  'widthMm',
  'heightMm',
]);

const EDITABLE_GROUPS = new Set(['products', 'stocks', 'quantityBreaks', 'finishing', 'turnarounds']);

@Injectable()
export class PricingService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * The whole matrix, assembled from `price_rates`.
   *
   * Read on essentially every request that touches money, so it is worth being
   * a single query. It is not cached in memory: an admin editing a rate must
   * see the new price on the next request, and a stale process-local cache in a
   * multi-worker deploy is the kind of bug nobody reproduces.
   */
  async getMatrix(): Promise<PriceMatrix> {
    const rows = await this.db.select().from(priceRates).orderBy(asc(priceRates.sortOrder));
    const group = <T>(name: string, map: (row: PriceRateRow) => T): T[] =>
      rows.filter((row) => row.group === name).map(map);

    return {
      products: group<ProductRate>('products', (row) => ({
        id: row.id as ProductRate['id'],
        label: row.label,
        setup: num(row, 'setup'),
        perThousand: num(row, 'perThousand'),
        note: str(row, 'note'),
      })),
      stocks: group<StockRate>('stocks', (row) => ({
        id: row.id as StockRate['id'],
        label: row.label,
        gsm: num(row, 'gsm'),
        coated: bool(row, 'coated'),
        inkLimit: num(row, 'inkLimit'),
        multiplier: num(row, 'multiplier'),
      })),
      quantityBreaks: group<QuantityBreak>('quantityBreaks', (row) => ({
        quantity: num(row, 'quantity'),
        multiplier: num(row, 'multiplier'),
      })),
      finishing: group<FinishingRate>('finishing', (row) => ({
        id: row.id as FinishingRate['id'],
        label: row.label,
        perThousand: num(row, 'perThousand'),
        flat: num(row, 'flat'),
        bindery: bool(row, 'bindery'),
      })),
      turnarounds: group<TurnaroundRate>('turnarounds', (row) => ({
        id: row.id as TurnaroundRate['id'],
        label: row.label,
        workingDays: num(row, 'workingDays'),
        multiplier: num(row, 'multiplier'),
      })),
      colours: group<ColourRate>('colours', (row) => ({
        id: row.id as ColourRate['id'],
        label: row.label,
        plates: num(row, 'plates'),
        multiplier: num(row, 'multiplier'),
      })),
      sizes: group<SizeRate>('sizes', (row) => ({
        id: row.id as SizeRate['id'],
        label: row.label,
        widthMm: num(row, 'widthMm'),
        heightMm: num(row, 'heightMm'),
      })),
    };
  }

  /**
   * Updates one cell. Rejects anything that is not a non-negative integer —
   * the same rule the admin grid enforces client-side, applied again here
   * because a hand-crafted PATCH never went near that grid.
   */
  async updateCell(edit: PriceEdit): Promise<PriceMatrix> {
    if (!EDITABLE_GROUPS.has(edit.group)) {
      throw new BadRequestException(`${edit.group} is not an editable group.`);
    }
    if (!INTEGER_FIELDS.has(edit.field)) {
      throw new BadRequestException(`${edit.field} is not an editable field.`);
    }
    if (!Number.isInteger(edit.value) || edit.value < 0) {
      throw new BadRequestException(
        'Whole numbers only. No decimals, no currency symbols, no negatives.',
      );
    }

    const [row] = await this.db
      .select()
      .from(priceRates)
      .where(and(eq(priceRates.group, edit.group), eq(priceRates.id, edit.rowId)))
      .limit(1);

    if (!row) throw new NotFoundException(`No ${edit.group} rate "${edit.rowId}".`);

    await this.db
      .update(priceRates)
      .set({
        values: { ...row.values, [edit.field]: edit.value },
        updatedAt: new Date(),
      })
      .where(and(eq(priceRates.group, edit.group), eq(priceRates.id, edit.rowId)));

    return this.getMatrix();
  }
}

function num(row: PriceRateRow, field: string): number {
  const value = row.values[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `price_rates ${row.group}/${row.id} is missing a numeric "${field}". The matrix is corrupt.`,
    );
  }
  return value;
}

function str(row: PriceRateRow, field: string): string {
  const value = row.values[field];
  return typeof value === 'string' ? value : '';
}

function bool(row: PriceRateRow, field: string): boolean {
  return row.values[field] === true;
}

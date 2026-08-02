import type { PriceEdit, PriceEditResult, PriceMatrix } from '@/lib/types';
import { apiDelay } from './delay';
import { readMatrix, writeMatrix } from './store';

export async function getPriceMatrix(): Promise<PriceMatrix> {
  await apiDelay(100);
  return readMatrix();
}

interface FieldRule {
  min: number;
  max: number;
  unit: string;
}

const RULES: Record<string, FieldRule> = {
  setup: { min: 0, max: 200_000, unit: 'pesos' },
  perThousand: { min: 0, max: 200_000, unit: 'pesos per 1,000' },
  flat: { min: 0, max: 200_000, unit: 'pesos' },
  multiplier: { min: 100, max: 5_000, unit: 'per-mille, 1000 = 1.000x' },
  workingDays: { min: 1, max: 20, unit: 'working days' },
  quantity: { min: 1, max: 100_000, unit: 'units' },
};

export function validatePriceEdit(edit: PriceEdit): PriceEditResult {
  const rule = RULES[edit.field];
  if (!rule) {
    return { ok: false, message: `${edit.field} is not an editable field.` };
  }
  if (!Number.isFinite(edit.value)) {
    return { ok: false, message: 'Whole numbers only. No decimals, no currency symbols.' };
  }
  if (!Number.isInteger(edit.value)) {
    return { ok: false, message: `Whole ${rule.unit} only \u2014 decimals are not stored.` };
  }
  if (edit.value < rule.min || edit.value > rule.max) {
    return {
      ok: false,
      message: `Out of range. ${edit.field} must be between ${rule.min} and ${rule.max} ${rule.unit}.`,
    };
  }
  return { ok: true, message: 'Saved.' };
}

export async function updatePriceCell(edit: PriceEdit): Promise<PriceEditResult> {
  const validation = validatePriceEdit(edit);
  if (!validation.ok) return validation;
  await apiDelay(120);

  const matrix = readMatrix();
  const patchRow = <T extends { id?: string; quantity?: number }>(rows: readonly T[]): T[] =>
    rows.map((row) => {
      const key = row.id ?? row.quantity?.toString() ?? '';
      if (key !== edit.rowId) return row;
      return { ...row, [edit.field]: edit.value };
    });

  const next: PriceMatrix = {
    ...matrix,
    products: edit.group === 'products' ? patchRow(matrix.products) : matrix.products,
    stocks: edit.group === 'stocks' ? patchRow(matrix.stocks) : matrix.stocks,
    quantityBreaks:
      edit.group === 'quantityBreaks' ? patchRow(matrix.quantityBreaks) : matrix.quantityBreaks,
    finishing: edit.group === 'finishing' ? patchRow(matrix.finishing) : matrix.finishing,
    turnarounds: edit.group === 'turnarounds' ? patchRow(matrix.turnarounds) : matrix.turnarounds,
  };

  writeMatrix(next);
  return { ok: true, message: 'Saved to the price matrix.' };
}

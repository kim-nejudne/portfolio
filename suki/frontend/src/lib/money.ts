// Integer pesos, formatted once, here. No component may format money.
// No toFixed, no floats, no Intl currency (it inserts .00). Just ₱ + thousands separators.

import type { Peso } from './types';

export const PESO_SIGN = '₱';

function assertIntegerPeso(value: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`Peso must be an integer, got ${value}`);
  }
}

/** Format an integer peso amount as `₱15` or `₱1,240`. Negative numbers keep the sign. */
export function formatPeso(value: Peso): string {
  assertIntegerPeso(value);
  const negative = value < 0;
  const abs = Math.abs(value);
  const withSeparators = abs.toLocaleString('en-US');
  return `${negative ? '-' : ''}${PESO_SIGN}${withSeparators}`;
}

/** Format without the peso sign, e.g. for a right-aligned amount column that already has a header. */
export function formatPesoBare(value: Peso): string {
  assertIntegerPeso(value);
  const negative = value < 0;
  const abs = Math.abs(value);
  return `${negative ? '-' : ''}${abs.toLocaleString('en-US')}`;
}

/** Parse a raw string input into an integer peso value. Rejects decimals and non-numerics. */
export function parsePesoInput(raw: string): Peso | null {
  const trimmed = raw.replace(/[₱\s,]/g, '');
  if (trimmed === '') return null;
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Money is whole Philippine pesos held as integers, formatted in exactly one place.
 * Multipliers are integer per-mille (1000 = 1.000x) so no float ever touches a price.
 */
export const VAT_PERCENT = 12;

export function formatPeso(amount: number): string {
  const rounded = Math.round(amount);
  const negative = rounded < 0;
  const digits = Math.abs(rounded).toString();
  let grouped = '';
  for (let i = 0; i < digits.length; i += 1) {
    const fromEnd = digits.length - i;
    grouped += digits[i];
    if (fromEnd > 1 && fromEnd % 3 === 1) grouped += ',';
  }
  return `${negative ? '-' : ''}\u20b1${grouped}`;
}

export function formatInteger(value: number): string {
  const digits = Math.abs(Math.round(value)).toString();
  let grouped = '';
  for (let i = 0; i < digits.length; i += 1) {
    const fromEnd = digits.length - i;
    grouped += digits[i];
    if (fromEnd > 1 && fromEnd % 3 === 1) grouped += ',';
  }
  return `${value < 0 ? '-' : ''}${grouped}`;
}

export function applyMultiplier(amount: number, perMille: number): number {
  return Math.round((amount * perMille) / 1000);
}

export function formatMultiplier(perMille: number): string {
  const whole = Math.floor(perMille / 1000);
  const fraction = perMille % 1000;
  return `${whole}.${fraction.toString().padStart(3, '0')}\u00d7`;
}

export function vatOn(subtotal: number): number {
  return Math.round((subtotal * VAT_PERCENT) / 100);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

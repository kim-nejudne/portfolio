export type Format = (value: number) => string;

export function formatAll(values: number[], format: Format) {
  return values.map(format);
}

/** euros(4.5) is "€4.50". */
export function euros(value: number) {
  return `€${value.toFixed(2)}`;
}

/** percent(0.25) is "25%". */
export const percent: Format = (value) => `${Math.round(value * 100)}%`;

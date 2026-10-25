// The font sizes the reader offers. Nothing may change this list.
export const SIZES: readonly number[] = [12, 14, 16, 20];

// The largest number in a list. It only reads the list.
export function largest(sizes: readonly number[]): number {
  return Math.max(...sizes);
}

export const biggest = largest(SIZES);

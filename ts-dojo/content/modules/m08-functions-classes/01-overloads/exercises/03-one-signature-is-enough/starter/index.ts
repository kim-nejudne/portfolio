export function characters(text: string): number;
export function characters(texts: readonly string[]): number;
export function characters(input: string | readonly string[]): number {
  return typeof input === 'string'
    ? input.length
    : input.reduce((sum, text) => sum + text.length, 0);
}

export function last(items: readonly string[]): string | undefined;
export function last(items: readonly number[]): number | undefined;
export function last(
  items: readonly (string | number)[],
): string | number | undefined {
  return items.at(-1);
}

const notes: (string | readonly string[])[] = ['abc', ['de', 'f']];
export const total = notes.reduce((sum, note) => sum + characters(note), 0);
export const lastFlag = last([true, false]);

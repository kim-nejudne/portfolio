export function characters(input: string | readonly string[]): number {
  return typeof input === 'string'
    ? input.length
    : input.reduce((sum, text) => sum + text.length, 0);
}

export function last<T>(items: readonly T[]): T | undefined {
  return items.at(-1);
}

const notes: (string | readonly string[])[] = ['abc', ['de', 'f']];
export const total = notes.reduce((sum, note) => sum + characters(note), 0);
export const lastFlag = last([true, false]);

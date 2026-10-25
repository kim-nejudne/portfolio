/** The last item of a list, or undefined when the list is empty. */
export function last(items: number[]): number | undefined {
  return items.at(-1);
}

export const lastScore = last([3, 9, 4]);
export const lastName = last(['Ada', 'Grace', 'Hedy']);

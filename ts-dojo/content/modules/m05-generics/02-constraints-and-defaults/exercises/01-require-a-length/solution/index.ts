/** The shortest item, the first one on a tie, or undefined when there are none. */
export function shortest<T extends { length: number }>(
  items: readonly T[],
): T | undefined {
  if (items.length === 0) {
    return undefined;
  }
  let best = items[0];
  for (const item of items) {
    if (item.length < best.length) {
      best = item;
    }
  }
  return best;
}

export const shortestWord = shortest(['banana', 'fig', 'kiwi']);
export const shortestList = shortest([[1, 2], [3], [4, 5, 6]]);

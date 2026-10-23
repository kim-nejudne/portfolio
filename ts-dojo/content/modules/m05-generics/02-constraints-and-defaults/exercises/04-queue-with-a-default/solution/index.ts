/** A first-in, first-out queue that starts with the given items. */
export function createQueue<T = string>(
  ...initial: T[]
): {
  push(item: T): void;
  shift(): T | undefined;
  size(): number;
} {
  const items = [...initial];
  return {
    push(item) {
      items.push(item);
    },
    shift() {
      return items.shift();
    },
    size() {
      return items.length;
    },
  };
}

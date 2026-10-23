/** A last-in, first-out stack. */
export class Stack<T> {
  private items: T[];

  constructor(...items: T[]) {
    this.items = items;
  }

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }
}

/** The pages a browser tab has visited, the latest on top. */
export const history = new Stack<string>();

/** Pushes each page onto the stack, in order. */
export function visitAll(stack: Stack<string>, pages: readonly string[]): void {
  for (const page of pages) {
    stack.push(page);
  }
}

/** Pops the latest page from the history and returns it in capitals, or NONE when it is empty. */
export function leave(): string {
  const page: string | undefined = history.pop();
  return page === undefined ? 'NONE' : page.toUpperCase();
}

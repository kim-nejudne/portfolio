/** Every call of a traced method, as `name(arg, arg)`. */
export const calls: string[] = [];

/** Records each call of the method it decorates in `calls`, then runs it. */
export function traced(
  method: (this: unknown, ...args: unknown[]) => unknown,
  context: ClassMethodDecoratorContext,
) {
  const name = String(context.name);
  return function (...args: unknown[]) {
    calls.push(`${name}(${args.join(', ')})`);
    return method.call(this, ...args);
  };
}

export class Cart {
  private prices: number[] = [];

  @traced
  add(price: number, quantity: number): number {
    this.prices.push(price * quantity);
    return this.prices.length;
  }

  @traced
  total(): number {
    return this.prices.reduce((sum, price) => sum + price, 0);
  }
}

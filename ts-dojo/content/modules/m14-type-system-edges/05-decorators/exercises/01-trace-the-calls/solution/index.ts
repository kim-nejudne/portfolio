/** Every call of a traced method, as `name(arg, arg)`. */
export const calls: string[] = [];

/** Records each call of the method it decorates in `calls`, then runs it. */
export function traced<This, Args extends unknown[], Return>(
  method: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Args) => Return
  >,
) {
  const name = String(context.name);
  return function (this: This, ...args: Args): Return {
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

/**
 * A decorator factory for async methods: a call is tried up to `times` times in all, and
 * resolves with the first attempt that succeeds.
 */
export function retry(times: number) {
  if (!Number.isInteger(times) || times < 1) {
    throw new RangeError(
      `retry needs a whole number of attempts from 1, got ${times}`,
    );
  }
  // `Promise<Return>` in the method's type is the constraint: a method that returns
  // anything else doesn't fit the parameter, and `@retry(…)` on it is a compile error.
  return function <This, Args extends unknown[], Return>(
    method: (this: This, ...args: Args) => Promise<Return>,
    context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Args) => Promise<Return>
    >,
  ) {
    const name = String(context.name);
    return async function (this: This, ...args: Args): Promise<Return> {
      let lastError: unknown;
      for (let attempt = 1; attempt <= times; attempt++) {
        try {
          return await method.call(this, ...args);
        } catch (error) {
          lastError = error;
        }
      }
      throw new Error(`${name} failed after ${times} attempts`, {
        cause: lastError,
      });
    };
  };
}

/** A client whose first `failFirst` calls fail, like a server that is still starting. */
export class StockClient {
  calls = 0;

  constructor(private readonly failFirst: number) {}

  @retry(3)
  async count(sku: string): Promise<number> {
    this.calls++;
    if (this.calls <= this.failFirst) {
      throw new Error(`network error ${this.calls}`);
    }
    return sku.length * 10;
  }
}

const client = new StockClient(2);
client.count('apple').then(
  (count) => console.log(`${count} after ${client.calls} calls`),
  (error: unknown) => console.log(`failed: ${String(error)}`),
);

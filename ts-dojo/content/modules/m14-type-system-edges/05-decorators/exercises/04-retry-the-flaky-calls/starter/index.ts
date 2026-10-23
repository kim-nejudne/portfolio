/**
 * A decorator factory for async methods: a call is tried up to `times` times in all, and
 * resolves with the first attempt that succeeds.
 */
export function retry(times: number) {
  return function (
    method: unknown,
    context: ClassMethodDecoratorContext,
  ): void {
    // Not implemented yet: the method runs once, as it is.
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

export class Registry {
  register(type: unknown, make: () => unknown): Registry {
    throw new Error(`not implemented: ${String(type)} ${String(make)}`);
  }

  create(type: unknown): unknown {
    throw new Error(`not implemented: ${String(type)}`);
  }
}

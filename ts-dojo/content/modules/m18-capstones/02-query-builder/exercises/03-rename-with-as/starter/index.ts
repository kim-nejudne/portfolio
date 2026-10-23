export type Product = {
  sku: string;
  name: string;
  price: number;
  stock: number;
  discontinued: boolean;
};
export type Order = {
  id: number;
  sku: string;
  quantity: number;
  customer: string | null;
};
export type Shop = { products: Product; orders: Order };

type Op = '=' | '<' | '>';
type Filter<Row> = (row: Row) => boolean;

// Copies each column of a row under its alias. select has checked the names against the row's
// type; here they are only strings, so the result is a Record.
function project(
  row: unknown,
  pairs: readonly (readonly [column: string, alias: string])[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof row !== 'object' || row === null) return out;
  for (const [column, alias] of pairs) {
    const value: unknown = Reflect.get(row, column);
    out[alias] = value;
  }
  return out;
}

function compare<V>(left: V, op: Op, right: V): boolean {
  if (op === '=') return left === right;
  return op === '<' ? left < right : left > right;
}

export class Query<Row, Out> {
  readonly #rows: readonly Row[];
  readonly #filters: readonly Filter<Row>[];
  readonly #project: (row: Row) => Out;

  constructor(
    rows: readonly Row[],
    filters: readonly Filter<Row>[],
    project: (row: Row) => Out,
  ) {
    this.#rows = rows;
    this.#filters = filters;
    this.#project = project;
  }

  // Accept a column, or a column renamed with 'column as alias'. The output row has each alias
  // (or the column's own name) as a key, with the column's type.
  select(...specs: string[]): Query<Row, Record<string, unknown>> {
    throw new Error(`select is not implemented: ${specs.join(', ')}`);
  }

  where<K extends keyof Row>(
    column: K,
    op: Op,
    value: Row[K],
  ): Query<Row, Out> {
    const test = (row: Row) => compare(row[column], op, value);
    return new Query(this.#rows, [...this.#filters, test], this.#project);
  }

  run(): Out[] {
    return this.#rows
      .filter((row) => this.#filters.every((test) => test(row)))
      .map(this.#project);
  }
}

export class Database<S> {
  readonly #tables: { [T in keyof S]: readonly S[T][] };

  constructor(tables: { [T in keyof S]: readonly S[T][] }) {
    this.#tables = tables;
  }

  from<T extends keyof S>(table: T): Query<S[T], S[T]> {
    return new Query(this.#tables[table], [], (row) => ({ ...row }));
  }
}

export const shop = new Database<Shop>({
  products: [
    { sku: 'P-1', name: 'Pen', price: 2, stock: 120, discontinued: false },
    { sku: 'P-2', name: 'Notebook', price: 6, stock: 0, discontinued: false },
    { sku: 'P-3', name: 'Lamp', price: 35, stock: 4, discontinued: true },
  ],
  orders: [
    { id: 1, sku: 'P-1', quantity: 10, customer: 'Ada' },
    { id: 2, sku: 'P-3', quantity: 1, customer: null },
  ],
});

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

type Column<Row> = keyof Row & string;

// A column, or a column renamed with `as`.
export type Spec<Row> = Column<Row> | `${Column<Row>} as ${string}`;

// The output key of a spec: its alias, or its column's own name.
type AliasOf<S> = S extends `${string} as ${infer Alias}` ? Alias : S;

// The type of the column a spec reads.
type TypeOf<Row, S> = S extends `${infer C extends Column<Row>} as ${string}`
  ? Row[C]
  : S extends Column<Row>
    ? Row[S]
    : never;

export type Output<Row, S extends Spec<Row>> = {
  [Sp in S as AliasOf<Sp>]: TypeOf<Row, Sp>;
};

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

  select<S extends Spec<Row>>(...specs: S[]): Query<Row, Output<Row, S>> {
    const pairs = specs.map((spec) => {
      const at = spec.indexOf(' as ');
      return at < 0
        ? ([spec, spec] as const)
        : ([spec.slice(0, at), spec.slice(at + 4)] as const);
    });
    // An assertion that holds: project copies exactly the keys that Output<Row, S> lists.
    return new Query(
      this.#rows,
      this.#filters,
      (row) => project(row, pairs) as Output<Row, S>,
    );
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

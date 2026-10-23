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

export type Op = '=' | '!=' | '<' | '>';
export type Direction = 'asc' | 'desc';
type Filter<Row> = (row: Row) => boolean;
type Sorter<Out> = (a: Out, b: Out) => number;

// The types with an order. The brackets keep `string | null` in one piece (11.3).
type Ordered = number | string;
type OpFor<V> = [V] extends [Ordered] ? Op : '=' | '!=';

// The keys of T whose values have an order, kept by an `as` clause (10.2).
type SortKey<T> = keyof {
  [K in keyof T as T[K] extends Ordered ? K : never]: T[K];
};

// An assertion that holds: the loop copies every column in `columns`, which is C.
function pick<Row, C extends keyof Row>(
  row: Row,
  columns: readonly C[],
): Pick<Row, C> {
  const picked = {} as Pick<Row, C>;
  for (const column of columns) picked[column] = row[column];
  return picked;
}

function compare<V>(left: V, op: Op, right: V): boolean {
  switch (op) {
    case '=':
      return left === right;
    case '!=':
      return left !== right;
    case '<':
      return left < right;
    case '>':
      return left > right;
  }
}

export class Query<Row, Out> {
  readonly #rows: readonly Row[];
  readonly #filters: readonly Filter<Row>[];
  readonly #project: (row: Row) => Out;
  readonly #sort: Sorter<Out> | undefined;

  constructor(
    rows: readonly Row[],
    filters: readonly Filter<Row>[],
    project: (row: Row) => Out,
    sort?: Sorter<Out>,
  ) {
    this.#rows = rows;
    this.#filters = filters;
    this.#project = project;
    this.#sort = sort;
  }

  select<C extends keyof Row>(...columns: C[]): Query<Row, Pick<Row, C>> {
    return new Query(this.#rows, this.#filters, (row) => pick(row, columns));
  }

  where<K extends keyof Row>(
    column: K,
    op: OpFor<Row[K]>,
    value: Row[K],
  ): Query<Row, Out> {
    const test = (row: Row) => compare(row[column], op, value);
    return new Query(this.#rows, [...this.#filters, test], this.#project);
  }

  // ORDER BY comes last: after it, only run is left (15.1).
  orderBy<K extends SortKey<Out>>(
    column: K,
    direction: Direction,
  ): Pick<Query<Row, Out>, 'run'> {
    const sign = direction === 'asc' ? 1 : -1;
    const sort = (a: Out, b: Out) =>
      a[column] < b[column] ? -sign : a[column] > b[column] ? sign : 0;
    return new Query(this.#rows, this.#filters, this.#project, sort);
  }

  run(): Out[] {
    const rows = this.#rows
      .filter((row) => this.#filters.every((test) => test(row)))
      .map(this.#project);
    return this.#sort === undefined ? rows : rows.sort(this.#sort);
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

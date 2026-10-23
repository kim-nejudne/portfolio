export type Issue = { path: (string | number)[]; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: Issue };
export type Parser<T> = (input: unknown) => Result<T>;

export type Quantity = number & { readonly __brand: 'Quantity' };

export interface Line {
  sku: string;
  quantity: Quantity;
}

export interface Order {
  id: string;
  lines: Line[];
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail(message: string): Result<never> {
  return { ok: false, error: { path: [], message } };
}

/** Puts `step` in front of the path of a failed result. */
export function at<T>(step: string | number, result: Result<T>): Result<T> {
  if (result.ok) return result;
  const { path, message } = result.error;
  return { ok: false, error: { path: [step, ...path], message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const string: Parser<string> = (input) =>
  typeof input === 'string' ? ok(input) : fail('expected a string');

/** Parses `input[key]` with `parser`; a failure's path starts with `key`. */
export function field<T>(
  input: unknown,
  key: string,
  parser: Parser<T>,
): Result<T> {
  if (!isRecord(input)) return fail('expected an object');
  return at(key, parser(input[key]));
}

function isQuantity(n: number): n is Quantity {
  return Number.isInteger(n) && n >= 1 && n <= 99;
}

/** A whole number from 1 to 99. */
export const quantity: Parser<Quantity> = (input) =>
  typeof input === 'number' && isQuantity(input)
    ? ok(input)
    : fail('expected a whole number from 1 to 99');

/** An array whose elements `item` parses; a failure's path starts with the index. */
export function arrayOf<T>(item: Parser<T>): Parser<T[]> {
  return (input) => {
    if (!Array.isArray(input)) return fail('expected an array');
    const items: T[] = [];
    for (const [index, element] of input.entries()) {
      const result = at(index, item(element));
      if (!result.ok) return result;
      items.push(result.value);
    }
    return ok(items);
  };
}

/** A Line with exactly a sku and a quantity. */
export function line(input: unknown): Result<Line> {
  const sku = field(input, 'sku', string);
  if (!sku.ok) return sku;
  const parsedQuantity = field(input, 'quantity', quantity);
  if (!parsedQuantity.ok) return parsedQuantity;
  return ok({ sku: sku.value, quantity: parsedQuantity.value });
}

/** An Order with exactly an id and its lines. */
export function order(input: unknown): Result<Order> {
  const id = field(input, 'id', string);
  if (!id.ok) return id;
  const lines = field(input, 'lines', arrayOf(line));
  if (!lines.ok) return lines;
  return ok({ id: id.value, lines: lines.value });
}

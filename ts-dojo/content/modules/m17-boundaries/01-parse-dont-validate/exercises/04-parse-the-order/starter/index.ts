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

/** A whole number from 1 to 99. */
export const quantity: Parser<Quantity> = (input) => {
  throw new Error(`not implemented for ${typeof input}`);
};

/** An array whose elements `item` parses; a failure's path starts with the index. */
export function arrayOf<T>(item: Parser<T>): Parser<T[]> {
  throw new Error(`not implemented for ${item.name}`);
}

/** A Line with exactly a sku and a quantity. */
export function line(input: unknown): Result<Line> {
  throw new Error(`not implemented for ${typeof input}`);
}

/** An Order with exactly an id and its lines. */
export function order(input: unknown): Result<Order> {
  throw new Error(`not implemented for ${typeof input}`);
}

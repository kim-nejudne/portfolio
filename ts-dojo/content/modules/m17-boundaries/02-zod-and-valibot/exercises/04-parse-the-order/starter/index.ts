import { z } from 'zod';

export type Issue = { path: PropertyKey[]; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; errors: Issue[] };

/** A trimmed, lower-cased email address, branded 'Email'. */
export const Email = z.string();
export type Email = z.output<typeof Email>;

/** A SKU like ABC-1234, branded 'Sku'. */
export const Sku = z.string();
export type Sku = z.output<typeof Sku>;

/** An order: id, email, placedAt and at least one line. */
export const Order = z.object({});
export type Order = z.output<typeof Order>;
export type OrderInput = z.input<typeof Order>;

/** The parsed order, or every issue as its path and message. */
export function parseOrder(input: unknown): Result<Order> {
  throw new Error(`not implemented for ${typeof input}`);
}

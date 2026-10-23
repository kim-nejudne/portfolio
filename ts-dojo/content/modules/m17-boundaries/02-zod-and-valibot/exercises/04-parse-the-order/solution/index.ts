import { z } from 'zod';

export type Issue = { path: PropertyKey[]; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; errors: Issue[] };

/** A trimmed, lower-cased email address, branded 'Email'. */
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .brand<'Email'>();
export type Email = z.output<typeof Email>;

/** A SKU like ABC-1234, branded 'Sku'. */
export const Sku = z
  .string()
  .regex(/^[A-Z]{3}-\d{4}$/, 'expected a SKU like ABC-1234')
  .brand<'Sku'>();
export type Sku = z.output<typeof Sku>;

/** An order: id, email, placedAt and at least one line. */
export const Order = z.object({
  id: z.string().min(1),
  email: Email,
  placedAt: z.iso.date().transform((text) => new Date(text)),
  lines: z
    .array(
      z.object({
        sku: Sku,
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1),
});
export type Order = z.output<typeof Order>;
export type OrderInput = z.input<typeof Order>;

/** The parsed order, or every issue as its path and message. */
export function parseOrder(input: unknown): Result<Order> {
  const result = Order.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map(({ path, message }) => ({ path, message })),
  };
}

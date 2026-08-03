/**
 * Server-side validation of an incoming operation.
 *
 * This exists because the client is not trustworthy — not because the
 * shopkeeper is dishonest, but because an operation can sit in a queue on a
 * phone for three days across an app update, and the thing that finally arrives
 * may have been written by a version of the app that no longer exists.
 *
 * Returns a reason string when the operation must be refused, or `null` when it
 * is fine. Refusal is permanent: the client drops it and shows it. Anything
 * that might succeed later belongs in a retry, not here.
 */
import type { OperationType, PushOperation } from '@suki/domain';

const KNOWN_TYPES: readonly OperationType[] = [
  'cash-sale',
  'credit-sale',
  'payment',
  'stock-adjustment',
  'buy-price-change',
  'settings-change',
];

/** Money is whole pesos. A float here means a client bug or a tampered body. */
function isWholePeso(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function validateOperation(op: PushOperation): string | null {
  if (!isNonEmptyString(op.id)) return 'Operation has no id.';
  // The id is the primary key and the idempotency key, so a malformed one would
  // let the same write land twice under two different names.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(op.id)) {
    return 'Operation id is not a UUID.';
  }
  if (!KNOWN_TYPES.includes(op.type)) return `Unknown operation type "${op.type}".`;
  if (!isNonEmptyString(op.createdAt) || Number.isNaN(Date.parse(op.createdAt))) {
    return 'Operation has no valid createdAt.';
  }

  const payload = record(op.payload);
  if (!payload) return 'Operation payload must be an object.';

  switch (op.type) {
    case 'cash-sale':
    case 'credit-sale': {
      const items = payload.items;
      if (!Array.isArray(items) || items.length === 0) return 'A sale needs at least one item.';
      for (const raw of items) {
        const line = record(raw);
        if (!line) return 'Sale line is malformed.';
        if (!isNonEmptyString(line.itemId)) return 'Sale line has no item.';
        if (typeof line.qty !== 'number' || !Number.isInteger(line.qty) || line.qty <= 0) {
          return 'Sale quantities must be whole numbers above zero.';
        }
        if (!isWholePeso(line.unitPrice) || line.unitPrice < 0) {
          return 'Sale prices must be whole pesos.';
        }
      }
      if (!isWholePeso(payload.total) || payload.total < 0) {
        return 'Sale total must be a whole peso amount.';
      }
      // The total is recomputed rather than trusted: it is the number that ends
      // up in someone's utang.
      const computed = items.reduce((sum: number, raw) => {
        const line = record(raw)!;
        return sum + (line.qty as number) * (line.unitPrice as number);
      }, 0);
      if (computed !== payload.total) {
        return `Sale total ${String(payload.total)} does not match its lines (${computed}).`;
      }
      if (op.type === 'credit-sale' && !isNonEmptyString(payload.customerId)) {
        return 'A credit sale needs a customer.';
      }
      return null;
    }

    case 'payment': {
      if (!isNonEmptyString(payload.customerId)) return 'A payment needs a customer.';
      if (!isWholePeso(payload.amount) || payload.amount <= 0) {
        return 'A payment must be a whole peso amount above zero.';
      }
      return null;
    }

    case 'stock-adjustment': {
      if (!isNonEmptyString(payload.itemId)) return 'A stock adjustment needs an item.';
      if (typeof payload.qty !== 'number' || !Number.isInteger(payload.qty)) {
        return 'Stock is counted in whole sell units.';
      }
      if (!isNonEmptyString(payload.kind)) return 'A stock adjustment needs a kind.';
      return null;
    }

    case 'buy-price-change': {
      if (!isNonEmptyString(payload.itemId)) return 'A price change needs an item.';
      if (!isWholePeso(payload.buyPrice) || payload.buyPrice <= 0) {
        return 'A buy price must be a whole peso amount above zero.';
      }
      return null;
    }

    case 'settings-change':
      return null;

    default:
      return `Unhandled operation type "${String(op.type)}".`;
  }
}

export type Payment =
  | { method: 'card'; last4: string }
  | { method: 'transfer'; iban: string }
  | { method: 'voucher'; code: string };

/** Throws for a value that no case handled. */
export function assertNever(value: unknown): void {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
}

/** A line for the receipt. */
export function describe(payment: Payment): string {
  switch (payment.method) {
    case 'card':
      return `card ending ${payment.last4}`;
    case 'transfer':
      return `transfer from ${payment.iban}`;
    default:
      assertNever(payment);
  }
}

/** The fee the shop pays for the payment, in euros. */
export function fee(payment: Payment): number {
  switch (payment.method) {
    case 'card':
      return 0.3;
    case 'transfer':
      return 0;
    default:
      assertNever(payment);
  }
}

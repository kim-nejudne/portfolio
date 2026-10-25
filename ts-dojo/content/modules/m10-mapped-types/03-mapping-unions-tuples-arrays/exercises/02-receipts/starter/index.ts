export type Payment =
  | { method: 'card'; last4: string; amount: number }
  | { method: 'bank'; iban: string; amount: number }
  | { method: 'cash'; amount: number };

/** One function per payment method, which describes a payment made that way. */
export type Describers<P extends { method: string }> = {
  [K in P['method']]: (payment: P) => string;
};

export const describe: Describers<Payment> = {
  card: (payment) => `card ending in ${payment.last4}`,
  bank: (payment) => `transfer from ${payment.iban.slice(0, 4)}`,
  cash: () => 'cash',
};

/** One line of a receipt: how the payment was made, and the amount. */
export function receipt(payment: Payment): string {
  const amount = payment.amount.toFixed(2);
  switch (payment.method) {
    case 'card':
      return `${describe.card(payment)}: ${amount}`;
    case 'bank':
      return `${describe.bank(payment)}: ${amount}`;
    case 'cash':
      return `${describe.cash(payment)}: ${amount}`;
  }
}

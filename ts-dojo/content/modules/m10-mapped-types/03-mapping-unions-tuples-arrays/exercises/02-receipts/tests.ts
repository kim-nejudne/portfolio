import type { Equal, Expect } from '@dojo/type-utils';
import { describe, receipt, type Describers, type Payment } from './index';

type Card = { method: 'card'; last4: string; amount: number };
type Bank = { method: 'bank'; iban: string; amount: number };
type Cash = { method: 'cash'; amount: number };

type Refund =
  | { method: 'card'; last4: string }
  | { method: 'voucher'; code: string; expires: Date };

type cases = [
  Expect<
    Equal<
      Describers<Payment>,
      {
        card: (payment: Card) => string;
        bank: (payment: Bank) => string;
        cash: (payment: Cash) => string;
      }
    >
  >, // each function takes only its own member
  Expect<
    Equal<
      Describers<Refund>,
      {
        card: (payment: { method: 'card'; last4: string }) => string;
        voucher: (payment: {
          method: 'voucher';
          code: string;
          expires: Date;
        }) => string;
      }
    >
  >, // a second union
  Expect<Equal<Describers<Cash>, { cash: (payment: Cash) => string }>>, // a single member
  Expect<Equal<Describers<never>, {}>>, // no members
];

// @ts-expect-error
const noCash: Describers<Payment> = { card: () => '', bank: () => '' }; // every method needs a function

// @ts-expect-error
const cashByCard = () => describe.card({ method: 'cash', amount: 5 }); // card takes only card payments

test('a card payment shows its last four digits', () => {
  expect(receipt({ method: 'card', last4: '4242', amount: 12.5 })).toBe(
    'card ending in 4242: 12.50',
  );
});

test('a bank payment shows the start of its IBAN', () => {
  const bank: Payment = {
    method: 'bank',
    iban: 'DE89370400440532013000',
    amount: 99,
  };
  expect(receipt(bank)).toBe('transfer from DE89: 99.00');
});

test('a cash payment shows only the amount', () => {
  expect(receipt({ method: 'cash', amount: 3 })).toBe('cash: 3.00');
});

export { noCash, cashByCard };

import type { Equal, Expect } from '@dojo/type-utils';
import { assertNever, describe, fee, type Payment } from './index';

type cases = [
  Expect<Equal<typeof assertNever, (value: never) => never>>, // assertNever takes never and returns never
  Expect<
    Equal<
      Payment,
      | { method: 'card'; last4: string }
      | { method: 'transfer'; iban: string }
      | { method: 'voucher'; code: string }
    >
  >, // Payment keeps its three members
];

test('describe a card payment', () => {
  expect(describe({ method: 'card', last4: '4242' })).toBe('card ending 4242');
  expect(describe({ method: 'card', last4: '0005' })).toBe('card ending 0005');
});

test('describe a transfer', () => {
  expect(describe({ method: 'transfer', iban: 'NL91ABNA0417164300' })).toBe(
    'transfer from NL91ABNA0417164300',
  );
});

test('describe vouchers', () => {
  for (const code of ['SPRING10', 'WELCOME', 'X-42']) {
    expect(describe({ method: 'voucher', code })).toBe(`voucher ${code}`);
  }
});

test('the fee for each method', () => {
  expect(fee({ method: 'card', last4: '4242' })).toBe(0.3);
  expect(fee({ method: 'transfer', iban: 'NL91ABNA0417164300' })).toBe(0);
  expect(fee({ method: 'voucher', code: 'SPRING10' })).toBe(0.1);
  expect(fee({ method: 'voucher', code: 'WELCOME' })).toBe(0.1);
});

test('a payment the types do not describe still throws', () => {
  // JSON.parse returns any, so this compiles although no member has the method 'cash'.
  const cash: Payment = JSON.parse('{"method":"cash","amount":5}');
  expect(() => describe(cash)).toThrow('unexpected value: {"method":"cash"');
  expect(() => fee(cash)).toThrow('unexpected value: {"method":"cash"');
});

import type {
  Equal,
  Expect,
  ExpectExtends,
  ExpectFalse,
  NotEqual,
} from '@dojo/type-utils';
import {
  shipOrder,
  toOrderId,
  toUserId,
  type OrderId,
  type UserId,
} from './index';

// ExpectExtends<To, From> is true when a From is assignable to a To.
type cases = [
  ExpectFalse<ExpectExtends<UserId, string>>, // a plain string is no UserId
  ExpectFalse<ExpectExtends<OrderId, string>>, // a plain string is no OrderId
  ExpectFalse<ExpectExtends<UserId, OrderId>>, // an OrderId is no UserId
  ExpectFalse<ExpectExtends<OrderId, UserId>>, // a UserId is no OrderId
  Expect<ExpectExtends<string, UserId>>, // a UserId is still a string
  Expect<ExpectExtends<string, OrderId>>, // an OrderId is still a string
  Expect<NotEqual<UserId, never>>, // a UserId can exist
  Expect<NotEqual<OrderId, never>>, // an OrderId can exist
  Expect<Equal<ReturnType<typeof toUserId>, UserId>>, // toUserId makes UserIds
  Expect<Equal<ReturnType<typeof toOrderId>, OrderId>>, // toOrderId makes OrderIds
];

// @ts-expect-error
const lookalike: UserId = 'u-1'; // a literal in the right format

// @ts-expect-error
const swapped = () => shipOrder(toOrderId('o-1'), toUserId('u-1')); // swapped arguments

export { lookalike, swapped };

test('toUserId returns a user id as it is', () => {
  expect(toUserId('u-42')).toBe('u-42');
  expect(toUserId('u-7')).toBe('u-7');
});

test('toUserId rejects anything else', () => {
  expect(() => toUserId('o-7')).toThrow();
  expect(() => toUserId('u-')).toThrow();
  expect(() => toUserId('U-1')).toThrow();
  expect(() => toUserId('u-4x')).toThrow();
  expect(() => toUserId('')).toThrow();
});

test('toOrderId returns an order id as it is', () => {
  expect(toOrderId('o-7')).toBe('o-7');
  expect(toOrderId('o-1001')).toBe('o-1001');
});

test('toOrderId rejects anything else', () => {
  expect(() => toOrderId('u-42')).toThrow();
  expect(() => toOrderId('o-')).toThrow();
  expect(() => toOrderId('order-7')).toThrow();
  expect(() => toOrderId('')).toThrow();
});

test('shipOrder takes one id of each kind', () => {
  expect(shipOrder(toUserId('u-1'), toOrderId('o-9'))).toBe('o-9 ships to u-1');
});

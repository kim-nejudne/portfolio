import type { Equal, Expect } from '@dojo/type-utils';
import { octets, type Byte, type IPv4 } from './index';

type cases = [
  Expect<Equal<IPv4<'192.168.0.1'>, '192.168.0.1'>>, // a valid address is kept
  Expect<Equal<IPv4<'0.0.0.0'>, '0.0.0.0'>>, // the smallest
  Expect<Equal<IPv4<'255.255.255.255'>, '255.255.255.255'>>, // the largest
  Expect<Equal<IPv4<'256.0.0.1'>, never>>, // a part above 255
  Expect<Equal<IPv4<'10.0.0'>, never>>, // three parts
  Expect<Equal<IPv4<'10.0.0.1.5'>, never>>, // five parts
  Expect<Equal<IPv4<'10.01.0.1'>, never>>, // a leading zero
  Expect<Equal<IPv4<'10.0.0.x'>, never>>, // not a number
  Expect<Equal<IPv4<string>, never>>, // a plain string can't be checked
  Expect<Equal<IPv4<`10.0.${Byte}.1`>, `10.0.${Byte}.1`>>, // 256 addresses at once
  Expect<Equal<IPv4<'10.0.0.1' | '10.0.0.300'>, '10.0.0.1'>>, // a union keeps its valid members
];

// @ts-expect-error
const tooBig = () => octets('192.168.0.256'); // 256 is not a byte

// @ts-expect-error
const short = () => octets('192.168.1'); // only three parts

test('octets splits an address into four numbers', () => {
  expect(octets('192.168.0.1')).toEqual([192, 168, 0, 1]);
  expect(octets('10.0.0.255')).toEqual([10, 0, 0, 255]);
  expect(octets('0.0.0.0')).toEqual([0, 0, 0, 0]);
});

export { tooBig, short };

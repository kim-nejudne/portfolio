import type { Equal, Expect } from '@dojo/type-utils';
import { padding, type Shorthand, type Sides } from './index';

type cases = [
  Expect<Equal<Sides<'10px'>, ['10px', '10px', '10px', '10px']>>, // one length for all four
  Expect<Equal<Sides<'1px 2px'>, ['1px', '2px', '1px', '2px']>>, // vertical, horizontal
  Expect<Equal<Sides<'1px 2px 3px'>, ['1px', '2px', '3px', '2px']>>, // left copies right
  Expect<Equal<Sides<'1px 2px 3px 4px'>, ['1px', '2px', '3px', '4px']>>, // all four given
  Expect<Equal<Sides<'0.5px 12px'>, ['0.5px', '12px', '0.5px', '12px']>>, // decimals
  Expect<Equal<Sides<'-4px 0px 8px'>, ['-4px', '0px', '8px', '0px']>>, // negative and zero
  Expect<Equal<Sides<'7px 7px 7px 9px'>, ['7px', '7px', '7px', '9px']>>, // repeated values
  Expect<
    Equal<
      Sides<'3px' | '3px 5px'>,
      ['3px', '3px', '3px', '3px'] | ['3px', '5px', '3px', '5px']
    >
  >, // each member of a union
];

const valid: Shorthand[] = [
  '0px',
  '10px 20px',
  '1px 2px 3px',
  '1.5px 0px -2px 4px',
];

// @ts-expect-error
const em: Shorthand = '10em'; // only px

// @ts-expect-error
const noUnit: Shorthand = '10px 20'; // every length needs its unit

// @ts-expect-error
const five: Shorthand = '1px 2px 3px 4px 5px'; // at most four

// @ts-expect-error
const empty: Shorthand = ''; // at least one

// @ts-expect-error
const comma: Shorthand = '1px,2px'; // separated by spaces

// @ts-expect-error
type TooMany = Sides<'1px 2px 3px 4px 5px'>; // Sides takes only shorthands

// @ts-expect-error
const swapped: Sides<'1px 2px'> = ['1px', '2px', '2px', '1px']; // bottom is 1px

export { valid, em, noUnit, five, empty, comma, swapped };
export type { TooMany };

test('one length', () => {
  expect(padding('8px')).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
});

test('two lengths', () => {
  expect(padding('1px 2px')).toEqual({ top: 1, right: 2, bottom: 1, left: 2 });
});

test('three lengths', () => {
  expect(padding('1px 2px 3px')).toEqual({
    top: 1,
    right: 2,
    bottom: 3,
    left: 2,
  });
});

test('four lengths', () => {
  expect(padding('1px 2px 3px 4px')).toEqual({
    top: 1,
    right: 2,
    bottom: 3,
    left: 4,
  });
});

test('decimals, zero and negative lengths', () => {
  expect(padding('0.5px 0px -2px')).toEqual({
    top: 0.5,
    right: 0,
    bottom: -2,
    left: 0,
  });
});

test('many values', () => {
  for (let n = 0; n < 6; n++) {
    expect(padding(`${n}px ${n + 10}px`)).toEqual({
      top: n,
      right: n + 10,
      bottom: n,
      left: n + 10,
    });
  }
});

import type { Equal, Expect } from '@dojo/type-utils';
import type { ElementOf, ValueOf } from './index';

type Point = { x: number; y: number; label: string };
const PALETTE = { primary: '#3b82f6', danger: '#ef4444' } as const;
const SIZES = ['s', 'm', 'l'] as const;

type cases = [
  Expect<Equal<ValueOf<Point>, number | string>>, // the values of an object type
  Expect<Equal<ValueOf<{ a: 1; b: 'two'; c: true }>, 1 | 'two' | true>>, // literal values stay literal
  Expect<Equal<ValueOf<{ [key: string]: boolean }>, boolean>>, // the value type of a dictionary
  Expect<Equal<ValueOf<typeof PALETTE>, '#3b82f6' | '#ef4444'>>, // the values of an as const object
  Expect<Equal<ElementOf<string[]>, string>>, // the elements of an array
  Expect<Equal<ElementOf<(number | null)[]>, number | null>>, // an array of a union
  Expect<Equal<ElementOf<[1, 'a', true]>, 1 | 'a' | true>>, // every element of a tuple
  Expect<Equal<ElementOf<typeof SIZES>, 's' | 'm' | 'l'>>, // a readonly tuple from as const
];

// @ts-expect-error
type NotAnArray = ElementOf<string>; // a string is not an array

// @ts-expect-error
type LengthOnly = ElementOf<{ length: number; 0: string }>; // an object with a length is not an array

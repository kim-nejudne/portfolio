import type { Equal, Expect } from '@dojo/type-utils';
import { area, perimeter } from './index';

type cases = [
  Expect<Equal<typeof area, (width: number, height: number) => number>>, // area: two numbers in, a number out
  Expect<Equal<typeof perimeter, (width: number, height: number) => number>>, // perimeter: two numbers in, a number out
];

test('area of a 3 by 4 rectangle', () => {
  expect(area(3, 4)).toBe(12);
});

test('perimeter of a 3 by 4 rectangle', () => {
  expect(perimeter(3, 4)).toBe(14);
});

test('area and perimeter of every rectangle up to 10 by 10', () => {
  for (let width = 1; width <= 10; width++) {
    for (let height = 1; height <= 10; height++) {
      expect(area(width, height)).toBe(width * height);
      expect(perimeter(width, height)).toBe(2 * (width + height));
    }
  }
});

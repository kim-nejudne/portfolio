import type { Equal, Expect } from '@dojo/type-utils';
import { describe } from './index';
import type { Shape } from './shapes';

type cases = [
  Expect<Equal<Parameters<typeof describe>, [shape: Shape]>>, // describe still takes a Shape
  Expect<Equal<ReturnType<typeof describe>, string>>, // and returns a string
];

test('describes a circle', () => {
  expect(describe({ kind: 'circle', radius: 1 })).toBe(
    'circle: area 3.14, box 2x2',
  );
});

test('describes a rect', () => {
  expect(describe({ kind: 'rect', width: 3, height: 2 })).toBe(
    'rect: area 6.00, box 3x2',
  );
});

test('describes squares of many sizes', () => {
  for (let side = 1; side <= 9; side++) {
    expect(describe({ kind: 'square', side })).toBe(
      `square: area ${(side * side).toFixed(2)}, box ${side}x${side}`,
    );
  }
});

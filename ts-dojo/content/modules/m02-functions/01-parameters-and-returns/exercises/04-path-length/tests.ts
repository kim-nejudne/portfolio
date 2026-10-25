import type { Equal, Expect, ExpectValidArgs } from '@dojo/type-utils';
import { distance, pathLength, type Point } from './index';

type cases = [
  Expect<Equal<Point, readonly [number, number]>>, // a Point is still a pair of numbers
  Expect<ExpectValidArgs<typeof distance, [Point]>>, // distance can leave out the second point
  Expect<Equal<ExpectValidArgs<typeof distance, []>, false>>, // the first point is required
];

// @ts-expect-error the second point needs two coordinates too
const shortPoint = () => distance([1, 2], [3]); // [3] is not a Point

// @ts-expect-error a point is made of numbers
const stringPoint = () => distance(['3', '4']); // ['3', '4'] is not a Point

// @ts-expect-error every argument to pathLength is a point
const longPoint = () => pathLength([0, 0], [1, 2, 3]); // [1, 2, 3] is not a Point

export { shortPoint, stringPoint, longPoint };

test('distance between two points', () => {
  expect(distance([1, 1], [4, 5])).toBeCloseTo(5);
});

test('distance to the origin when the second point is left out', () => {
  expect(distance([3, 4])).toBeCloseTo(5);
});

test('distance from a point to itself is 0', () => {
  expect(distance([2, 7], [2, 7])).toBe(0);
});

test('the length of a path adds the distances between neighbours', () => {
  expect(pathLength([0, 0], [3, 4], [3, 0])).toBeCloseTo(9);
});

test('a path of one point has length 0', () => {
  expect(pathLength([5, 5])).toBe(0);
});

test('a path of no points has length 0', () => {
  expect(pathLength()).toBe(0);
});

test('a path spread from an array of points', () => {
  const route: Point[] = [
    [0, 0],
    [0, 2],
    [2, 2],
  ];
  expect(pathLength(...route)).toBeCloseTo(4);
});

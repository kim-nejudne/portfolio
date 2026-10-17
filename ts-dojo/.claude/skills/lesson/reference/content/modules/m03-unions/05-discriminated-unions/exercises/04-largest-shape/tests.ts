import { area, largest, type Shape } from './index';

const circle: Shape = { kind: 'circle', radius: 1 };
const square: Shape = { kind: 'square', side: 3 };
const rect: Shape = { kind: 'rect', width: 2, height: 5 };

test('area of a circle', () => {
  expect(area(circle)).toBeCloseTo(Math.PI);
});

test('area of a square', () => {
  expect(area(square)).toBe(9);
});

test('area of a rect', () => {
  expect(area(rect)).toBe(10);
});

test('largest picks the biggest area', () => {
  expect(largest([circle, square, rect])).toEqual(rect);
});

test('largest of one shape is that shape', () => {
  expect(largest([square])).toEqual(square);
});

test('largest of no shapes is undefined', () => {
  expect(largest([])).toBeUndefined();
});

test('largest does not change its input', () => {
  const shapes: readonly Shape[] = [square, circle];
  largest(shapes);
  expect(shapes).toEqual([square, circle]);
});

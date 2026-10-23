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

test('area of shapes of many sizes', () => {
  for (let size = 1; size <= 8; size++) {
    expect(area({ kind: 'circle', radius: size })).toBeCloseTo(
      Math.PI * size * size,
    );
    expect(area({ kind: 'square', side: size })).toBe(size * size);
    expect(area({ kind: 'rect', width: size, height: size + 3 })).toBe(
      size * (size + 3),
    );
  }
});

test('area throws for a shape the types do not describe', () => {
  // JSON.parse returns any, so this compiles although no member has the kind 'hexagon'.
  const hexagon: Shape = JSON.parse('{"kind":"hexagon","side":1}');
  expect(() => area(hexagon)).toThrow('unhandled shape');
});

test('largest finds the biggest area wherever it is', () => {
  expect(largest([circle, rect, square])).toBe(rect);
  expect(largest([square, circle])).toBe(square);
  expect(largest([circle, square])).toBe(square);
});

test('largest of many squares is the one with the longest side', () => {
  const squares = [3, 7, 2, 9, 4, 8].map((side): Shape => ({
    kind: 'square',
    side,
  }));
  expect(largest(squares)).toBe(squares[3]);
});

test('largest of one shape is that shape', () => {
  expect(largest([circle])).toBe(circle);
});

test('largest of no shapes is undefined', () => {
  expect(largest([])).toBeUndefined();
});

test('largest returns the first of equal areas', () => {
  const squareOf4: Shape = { kind: 'square', side: 2 };
  const rectOf4: Shape = { kind: 'rect', width: 1, height: 4 };
  expect(largest([squareOf4, rectOf4])).toBe(squareOf4);
  expect(largest([rectOf4, squareOf4])).toBe(rectOf4);
});

test('largest does not change its input', () => {
  const shapes: readonly Shape[] = [square, circle, rect];
  largest(shapes);
  expect(shapes).toEqual([square, circle, rect]);
});

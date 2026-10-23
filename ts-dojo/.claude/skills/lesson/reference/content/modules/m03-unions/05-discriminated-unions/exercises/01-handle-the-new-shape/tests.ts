import { area, label, type Shape } from './index';

test('area of a circle', () => {
  expect(area({ kind: 'circle', radius: 1 })).toBeCloseTo(Math.PI);
});

test('area of a square', () => {
  expect(area({ kind: 'square', side: 3 })).toBe(9);
});

test('area of a triangle', () => {
  expect(area({ kind: 'triangle', base: 4, height: 3 })).toBe(6);
});

test('area of triangles of many sizes', () => {
  for (let base = 1; base <= 6; base++) {
    for (let height = 1; height <= 6; height++) {
      expect(area({ kind: 'triangle', base, height })).toBe(
        (base * height) / 2,
      );
    }
  }
});

test('label of a circle', () => {
  expect(label({ kind: 'circle', radius: 2 })).toBe('circle, radius 2');
});

test('label of a square', () => {
  expect(label({ kind: 'square', side: 3 })).toBe('square, side 3');
});

test('label of a triangle', () => {
  expect(label({ kind: 'triangle', base: 4, height: 3 })).toBe(
    'triangle, base 4, height 3',
  );
  expect(label({ kind: 'triangle', base: 10, height: 7 })).toBe(
    'triangle, base 10, height 7',
  );
});

test('a shape the types do not describe still throws', () => {
  // JSON.parse returns any, so this compiles although no member has the kind 'hexagon'.
  const hexagon: Shape = JSON.parse('{"kind":"hexagon","side":1}');
  expect(() => area(hexagon)).toThrow('unhandled shape');
  expect(() => label(hexagon)).toThrow('unhandled shape');
});

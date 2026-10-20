import { area } from './index';

test('area of a circle', () => {
  expect(area({ kind: 'circle', radius: 1 })).toBeCloseTo(Math.PI);
});

test('area of a square', () => {
  expect(area({ kind: 'square', side: 3 })).toBe(9);
});

test('area of a triangle', () => {
  expect(area({ kind: 'triangle', base: 4, height: 3 })).toBe(6);
});

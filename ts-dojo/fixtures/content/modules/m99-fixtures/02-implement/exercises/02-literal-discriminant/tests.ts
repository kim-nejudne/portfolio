import { area } from './index';

test('area of a circle', () => {
  expect(area({ kind: 'circle', radius: 1 })).toBeCloseTo(Math.PI);
});

test('area of a square', () => {
  expect(area({ kind: 'square', side: 2 })).toBe(4);
});

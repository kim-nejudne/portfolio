import { describe } from './index';

test('describes a circle', () => {
  expect(describe({ kind: 'circle', radius: 1 })).toBe('circle r=1');
});

test('describes a square', () => {
  expect(describe({ kind: 'square', side: 3 })).toBe('square s=3');
});

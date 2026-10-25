import { padLeft } from './index';

test('a number pads with that many spaces', () => {
  expect(padLeft(4, 'x')).toBe('    x');
  expect(padLeft(1, 'total')).toBe(' total');
});

test('zero spaces leaves the input alone', () => {
  expect(padLeft(0, 'x')).toBe('x');
});

test('a string goes in front as it is', () => {
  expect(padLeft('>> ', 'quote')).toBe('>> quote');
  expect(padLeft('', 'x')).toBe('x');
});

test('a string of digits is still a string', () => {
  expect(padLeft('42', 'x')).toBe('42x');
});

test('any number of spaces, and any string in front', () => {
  for (let count = 0; count <= 30; count++) {
    const padded = padLeft(count, `v${count}`);
    expect(padded).toHaveLength(count + `v${count}`.length);
    expect(padded.trimStart()).toBe(`v${count}`);
    expect(padLeft(`[${count}] `, 'item')).toBe(`[${count}] item`);
  }
});

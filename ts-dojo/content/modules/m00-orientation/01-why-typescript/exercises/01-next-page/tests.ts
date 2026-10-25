import { nextPageFrom } from './index';

test('the page after 1 is 2', () => {
  expect(nextPageFrom('1')).toBe(2);
});

test('the page after 41 is 42', () => {
  expect(nextPageFrom('41')).toBe(42);
});

test('every page from 0 to 49 is followed by the next one', () => {
  for (let page = 0; page < 50; page++) {
    expect(nextPageFrom(String(page))).toBe(page + 1);
  }
});

test('the result is a number, not text', () => {
  expect(typeof nextPageFrom('9')).toBe('number');
});

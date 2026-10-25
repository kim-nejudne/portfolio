import { greet, repeat } from './index';

test('greet says Hello when no greeting is given', () => {
  expect(greet('Ada')).toBe('Hello, Ada!');
});

test('greet trims the greeting it is given', () => {
  expect(greet('Ada', ' Welcome ')).toBe('Welcome, Ada!');
});

test('greet accepts an explicit undefined', () => {
  expect(greet('Grace', undefined)).toBe('Hello, Grace!');
});

test('repeat repeats twice when no count is given', () => {
  expect(repeat('ab')).toBe('abab');
});

test('repeat takes a count', () => {
  expect(repeat('ab', 3)).toBe('ababab');
});

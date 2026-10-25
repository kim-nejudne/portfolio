import { initials } from './index';

test('a full name gives its initials', () => {
  expect(initials('Ada Lovelace')).toBe('AL');
  expect(initials('grace brewster hopper')).toBe('GBH');
});

test('a single name gives one letter', () => {
  expect(initials('Plato')).toBe('P');
});

test('no name gives a question mark', () => {
  expect(initials(undefined)).toBe('?');
});

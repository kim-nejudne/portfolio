import type { Equal, Expect } from '@dojo/type-utils';
import {
  button,
  deleteOptions,
  remove,
  save,
  type ButtonOptions,
} from './index';

type cases = [
  Expect<Equal<typeof deleteOptions, ButtonOptions>>, // deleteOptions is annotated as ButtonOptions
];

test('a button without a color is gray', () => {
  expect(button({ label: 'Cancel' })).toBe('[Cancel] in gray');
});

test('the save button is green', () => {
  expect(save).toBe('[Save] in green');
});

test('the delete options ask for red', () => {
  expect(deleteOptions).toEqual({ label: 'Delete', color: 'red' });
});

test('the delete button is red', () => {
  expect(remove).toBe('[Delete] in red');
});

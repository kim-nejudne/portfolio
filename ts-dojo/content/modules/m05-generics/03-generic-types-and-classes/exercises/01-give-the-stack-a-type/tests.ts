import type { Equal, Expect } from '@dojo/type-utils';
import { Stack, history, leave, visitAll } from './index';

type cases = [
  Expect<Equal<typeof history, Stack<string>>>, // the history is a stack of strings
  Expect<
    Equal<
      Parameters<typeof visitAll>,
      [stack: Stack<string>, pages: readonly string[]]
    >
  >, // visitAll takes a stack of strings
];

// @ts-expect-error
const pushNumber = () => history.push(42); // a stack of strings takes only strings

// @ts-expect-error
visitAll(new Stack<number>(), ['home']); // and visitAll takes no stack of numbers

test('leave pops the pages in reverse order, in capitals', () => {
  visitAll(history, ['home', 'about', 'contact']);
  expect(leave()).toBe('CONTACT');
  expect(leave()).toBe('ABOUT');
  expect(leave()).toBe('HOME');
  expect(leave()).toBe('NONE');
});

test('many pages, pushed one visit at a time', () => {
  for (let count = 1; count <= 8; count++) {
    const pages = Array.from({ length: count }, (_, i) => `page-${count}-${i}`);
    for (const page of pages) {
      visitAll(history, [page]);
    }
    for (const page of pages.toReversed()) {
      expect(leave()).toBe(page.toUpperCase());
    }
    expect(leave()).toBe('NONE');
  }
});

export { pushNumber };

import type { Equal, Expect } from '@dojo/type-utils';
import { alert, type Level } from './index';

const saved = alert().title('Saved').level('info').build();
const failed = alert()
  .dismissAfter(5000)
  .level('error')
  .title('Failed')
  .build();
const titled = alert().title('Offline');
const levelled = alert().level('warning');

type cases = [
  Expect<Equal<keyof typeof saved, 'title' | 'level'>>, // build returns what was set
  Expect<Equal<(typeof saved)['level'], Level>>, // each with its own type
  Expect<Equal<keyof typeof failed, 'title' | 'level' | 'dismissAfter'>>, // optional step included
  Expect<Equal<(typeof failed)['dismissAfter'], number>>, // dismissAfter is a number
];

// @ts-expect-error
const twoTitles = () => titled.title('Back online'); // title only once

// @ts-expect-error
const twoLevels = () => levelled.level('error'); // level only once

// @ts-expect-error
const twoDelays = () => alert().dismissAfter(1).dismissAfter(2); // dismissAfter only once

// @ts-expect-error
const noLevel = () => titled.build(); // build needs a level

// @ts-expect-error
const noTitle = () => levelled.dismissAfter(3000).build(); // build needs a title

// @ts-expect-error
const nothing = () => alert().build(); // build needs both

export { twoTitles, twoLevels, twoDelays, noLevel, noTitle, nothing };

test('build returns the steps that were taken', () => {
  expect(saved).toEqual({ title: 'Saved', level: 'info' });
  expect(failed).toEqual({
    title: 'Failed',
    level: 'error',
    dismissAfter: 5000,
  });
});

test('the steps can come in any order', () => {
  expect(
    alert().level('warning').dismissAfter(10).title('Slow').build(),
  ).toEqual({ title: 'Slow', level: 'warning', dismissAfter: 10 });
});

test('a partial builder can be finished in several ways', () => {
  const info = titled.level('info').build();
  const error = titled.level('error').dismissAfter(100).build();
  expect(info).toEqual({ title: 'Offline', level: 'info' });
  expect(error).toEqual({
    title: 'Offline',
    level: 'error',
    dismissAfter: 100,
  });
});

test('every alert is a new object', () => {
  const first = titled.level('info').build();
  const second = titled.level('info').build();
  expect(first).toEqual(second);
  expect(first === second).toBe(false);
});

import type { Equal, Expect } from '@dojo/type-utils';
import {
  BOARD,
  boardText,
  formatColumns,
  splitTasks,
  type Task,
} from './index';

type cases = [
  Expect<Equal<Task, { readonly id: string; title: string; done?: boolean }>>, // done may be left out, id stays read-only
  Expect<
    Equal<typeof splitTasks, (tasks: readonly Task[]) => [string[], string[]]>
  >, // a read-only list in, a pair out
  Expect<
    Equal<typeof formatColumns, (columns: [string[], string[]]) => string>
  >, // formatColumns is unchanged
  Expect<
    Equal<(typeof BOARD)[1], { readonly id: 't2'; readonly title: 'Review it' }>
  >, // BOARD is still as const
];

test('the board in two columns', () => {
  expect(boardText()).toBe('Open: Review it, Ship it | Done: Write the lesson');
});

test('splitTasks keeps the order of the list', () => {
  const tasks: Task[] = [
    { id: 'a', title: 'One', done: true },
    { id: 'b', title: 'Two' },
    { id: 'c', title: 'Three', done: true },
  ];
  expect(splitTasks(tasks)).toEqual([['Two'], ['One', 'Three']]);
});

test('the board is unchanged', () => {
  expect(BOARD).toEqual([
    { id: 't1', title: 'Write the lesson', done: true },
    { id: 't2', title: 'Review it' },
    { id: 't3', title: 'Ship it', done: false },
  ]);
});

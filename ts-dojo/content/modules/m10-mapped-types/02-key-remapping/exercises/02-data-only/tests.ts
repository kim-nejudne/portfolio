import type { Equal, Expect } from '@dojo/type-utils';
import { createTask, toSaved, type DataOnly, type Task } from './index';

class Timer {
  readonly startedAt: number = 0;
  laps: number[] = [];
  onLap?: (lap: number) => void;
  lap(): void {}
  reset(): void {}
}

type cases = [
  Expect<
    Equal<
      DataOnly<Task>,
      { readonly id: number; title: string; done: boolean; due?: Date }
    >
  >, // the methods and the optional callback go, the modifiers stay
  Expect<
    Equal<DataOnly<Timer>, { readonly startedAt: number; laps: number[] }>
  >, // a class instance type
  Expect<Equal<DataOnly<{ a: 1; f: () => 2 }>, { a: 1 }>>, // a property holding a function counts as a method
  Expect<
    Equal<DataOnly<{ a?: string; cb?: () => void; g?(): void }>, { a?: string }>
  >, // optional functions go too, optional data stays
  Expect<Equal<DataOnly<{ run(): void }>, {}>>, // only methods
  Expect<Equal<DataOnly<{}>, {}>>, // no properties
  Expect<
    Equal<
      DataOnly<{ a: 1; f(): void } | { b: 2; g(): void }>,
      { a: 1 } | { b: 2 }
    >
  >, // a union, each member filtered on its own
];

// @ts-expect-error
type NoComplete = DataOnly<Task>['complete']; // complete is not data

// @ts-expect-error
type NoOnDone = DataOnly<Task>['onDone']; // onDone is a function too

test('toSaved keeps the data and drops the functions', () => {
  const saved = toSaved(createTask(1, 'Tea', { onDone: () => {} }));
  expect(saved).toEqual({ id: 1, title: 'Tea', done: false });
  expect(Object.keys(saved)).toEqual(['id', 'title', 'done']);
});

test('toSaved sees the changes the methods made', () => {
  const finished: string[] = [];
  const task = createTask(2, 'Tea', { onDone: (t) => finished.push(t.title) });
  task.rename('Green tea');
  task.complete();
  expect(finished).toEqual(['Green tea']);
  expect(toSaved(task)).toEqual({ id: 2, title: 'Green tea', done: true });
});

test('toSaved keeps a due date when there is one', () => {
  const due = new Date(2026, 9, 23);
  const saved = toSaved(createTask(3, 'Write 10.2', { due }));
  expect(saved).toEqual({ id: 3, title: 'Write 10.2', done: false, due });
});

export type { NoComplete, NoOnDone };

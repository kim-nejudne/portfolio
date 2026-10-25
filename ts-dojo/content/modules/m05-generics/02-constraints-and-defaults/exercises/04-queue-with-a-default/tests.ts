import type { Equal, Expect } from '@dojo/type-utils';
import { createQueue } from './index';

const names = createQueue();
const scores = createQueue(3, 9, 4);
const flags = createQueue<boolean>();

type cases = [
  Expect<Equal<ReturnType<typeof names.shift>, string | undefined>>, // nothing to infer from: the default, string
  Expect<Equal<ReturnType<typeof scores.shift>, number | undefined>>, // the items are numbers: inference wins
  Expect<Equal<ReturnType<typeof flags.shift>, boolean | undefined>>, // an explicit type argument wins
  Expect<Equal<Parameters<typeof scores.push>, [item: number]>>, // push takes the same type
  Expect<
    Equal<
      typeof createQueue,
      <T = string>(
        ...initial: T[]
      ) => { push(item: T): void; shift(): T | undefined; size(): number }
    >
  >, // one signature, with a default
];

// @ts-expect-error
names.push(42); // a queue of strings takes only strings

// @ts-expect-error
scores.push('ten'); // a queue of numbers takes only numbers

// @ts-expect-error
createQueue<number>('a'); // the initial items have the queue's type

test('a queue with no initial items takes strings', () => {
  const queue = createQueue();
  expect(queue.size()).toBe(0);
  queue.push('Ada');
  queue.push('Grace');
  expect(queue.size()).toBe(2);
  expect(queue.shift()).toBe('Ada');
  expect(queue.shift()).toBe('Grace');
  expect(queue.shift()).toBeUndefined();
  expect(queue.size()).toBe(0);
});

test('initial items come out first, in order', () => {
  for (let count = 0; count <= 6; count++) {
    const initial = Array.from({ length: count }, (_, i) => i * 10);
    const queue = createQueue(...initial);
    queue.push(-1);
    expect(queue.size()).toBe(count + 1);
    const out: unknown[] = [];
    for (let i = 0; i <= count; i++) {
      out.push(queue.shift());
    }
    expect(out).toEqual([...initial, -1]);
    expect(queue.shift()).toBeUndefined();
  }
});

test('queues are independent of each other and of the initial array', () => {
  const initial = ['a', 'b'];
  const first = createQueue(...initial);
  const second = createQueue(...initial);
  first.shift();
  first.push('c');
  expect(second.size()).toBe(2);
  expect(second.shift()).toBe('a');
  expect(initial).toEqual(['a', 'b']);
});

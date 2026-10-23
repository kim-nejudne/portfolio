import type { Equal, Expect } from '@dojo/type-utils';
import { TaskQueue } from './index';

type User = { id: number; name: string };

declare const queue: TaskQueue;
declare function fetchUser(id: number, fresh?: boolean): Promise<User>;
declare function ping(): Promise<void>;
declare function total(...values: number[]): Promise<number>;

const userTask = () => queue.enqueue(fetchUser, 1);
const freshUserTask = () => queue.enqueue(fetchUser, 1, true);
const pingTask = () => queue.enqueue(ping);
const totalTask = () => queue.enqueue(total, 1, 2, 3);

type cases = [
  Expect<Equal<ReturnType<typeof userTask>, Promise<User>>>, // the task's result
  Expect<Equal<ReturnType<typeof freshUserTask>, Promise<User>>>, // with the optional argument
  Expect<Equal<ReturnType<typeof pingTask>, Promise<void>>>, // no arguments
  Expect<Equal<ReturnType<typeof totalTask>, Promise<number>>>, // a rest parameter
];

// @ts-expect-error
const noId = () => queue.enqueue(fetchUser); // id is required

// @ts-expect-error
const idAsString = () => queue.enqueue(fetchUser, '1'); // id is a number

// @ts-expect-error
const tooMany = () => queue.enqueue(fetchUser, 1, true, 2); // two at most

// @ts-expect-error
const pingWithArg = () => queue.enqueue(ping, 1); // ping takes nothing

// @ts-expect-error
const notNumbers = () => queue.enqueue(total, 1, '2'); // values are numbers

export { userTask, freshUserTask, pingTask, totalTask };
export { noId, idAsString, tooMany, pingWithArg, notNumbers };

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function add(a: number, b: number): Promise<number> {
  await delay(1);
  return a + b;
}

async function fail(message: string): Promise<never> {
  await delay(1);
  throw new Error(message);
}

test('enqueue resolves with what the task returns for the arguments', async () => {
  const tasks = new TaskQueue();
  expect(await tasks.enqueue(add, 1, 2)).toBe(3);
  expect(await tasks.enqueue(add, 20, 22)).toBe(42);
  expect(
    await tasks.enqueue(
      async (...words: string[]) => words.join(' '),
      'a',
      'b',
    ),
  ).toBe('a b');
});

test('tasks run one at a time, in the order they were enqueued', async () => {
  const tasks = new TaskQueue();
  const log: string[] = [];
  const step = async (name: string, ms: number) => {
    log.push(`start ${name}`);
    await delay(ms);
    log.push(`end ${name}`);
    return name;
  };
  const results = await Promise.all([
    tasks.enqueue(step, 'a', 30),
    tasks.enqueue(step, 'b', 10),
    tasks.enqueue(step, 'c', 0),
  ]);
  expect(results).toEqual(['a', 'b', 'c']);
  expect(log).toEqual([
    'start a',
    'end a',
    'start b',
    'end b',
    'start c',
    'end c',
  ]);
});

test('a rejected task rejects its own promise, and the next one still runs', async () => {
  const tasks = new TaskQueue();
  const failing = tasks.enqueue(fail, 'boom');
  const next = tasks.enqueue(add, 2, 3);
  await expect(failing).rejects.toThrow('boom');
  expect(await next).toBe(5);
  expect(await tasks.enqueue(add, 1, 1)).toBe(2);
});

test('size counts the tasks that have not settled', async () => {
  const tasks = new TaskQueue();
  expect(tasks.size).toBe(0);
  const first = tasks.enqueue(add, 1, 1);
  const second = tasks.enqueue(fail, 'no');
  const third = tasks.enqueue(add, 3, 3);
  expect(tasks.size).toBe(3);
  await first;
  expect(tasks.size).toBe(2);
  await expect(second).rejects.toThrow('no');
  expect(tasks.size).toBe(1);
  await third;
  expect(tasks.size).toBe(0);
});

test('each queue runs its own tasks', async () => {
  const slow = new TaskQueue();
  const fast = new TaskQueue();
  const log: string[] = [];
  const done = slow.enqueue(async () => {
    await delay(40);
    log.push('slow');
  });
  await fast.enqueue(async () => {
    log.push('fast');
  });
  expect(log).toEqual(['fast']);
  await done;
  expect(log).toEqual(['fast', 'slow']);
});

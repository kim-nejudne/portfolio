import type { Equal, Expect } from '@dojo/type-utils';
import { touch } from './index';

type Note = { title: string; updatedAt: number };
type Task = { done: boolean; tags: string[]; updatedAt: number };

const note: Note = { title: 'Plan the week', updatedAt: 1 };
const task: Task = { done: false, tags: ['home'], updatedAt: 2 };

const touchedNote = touch(note, 50);
const touchedTask = touch(task, 60);

type cases = [
  Expect<Equal<typeof touchedNote, Note>>, // a note comes back as a note
  Expect<Equal<typeof touchedTask, Task>>, // a task comes back as a task
];

// @ts-expect-error
touch({ title: 'No time' }, 5); // only objects with an updatedAt

// @ts-expect-error
touch({ updatedAt: '5' }, 5); // and updatedAt must be a number

test('sets updatedAt and keeps every other property', () => {
  expect(touchedNote).toEqual({ title: 'Plan the week', updatedAt: 50 });
  expect(touchedTask).toEqual({ done: false, tags: ['home'], updatedAt: 60 });
});

test('works for many times and many objects', () => {
  for (let now = 0; now < 20; now++) {
    const item = { id: now, label: `item ${now}`, updatedAt: -1 };
    expect(touch(item, now * 7)).toEqual({
      id: now,
      label: `item ${now}`,
      updatedAt: now * 7,
    });
  }
});

test('returns a new object and leaves the item alone', () => {
  const before = { title: 'Draft', updatedAt: 3 };
  const after = touch(before, 9);
  expect(after).not.toBe(before);
  expect(before).toEqual({ title: 'Draft', updatedAt: 3 });
});

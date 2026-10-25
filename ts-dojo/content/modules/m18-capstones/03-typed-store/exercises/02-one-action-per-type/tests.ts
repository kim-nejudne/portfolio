import type { Equal, Expect } from '@dojo/type-utils';
import { todos, type ActionOf, type TodoAction, type TodoState } from './index';

type cases = [
  Expect<
    Equal<
      TodoAction,
      | { type: 'add'; payload: string }
      | { type: 'toggle'; payload: number }
      | { type: 'rename'; payload: { id: number; title: string } }
      | { type: 'clearDone' }
    >
  >, // one action per key of TodoMap
  Expect<
    Equal<
      ActionOf<{ ping: void; load: string[] }>,
      { type: 'ping' } | { type: 'load'; payload: string[] }
    >
  >, // ActionOf works on any map
];

// @ts-expect-error
const mismatched: TodoAction = { type: 'add', payload: 1 }; // add takes a title

export { mismatched };

const empty: TodoState = { todos: [], nextId: 1 };

function run(actions: TodoAction[], state = empty): TodoState {
  return actions.reduce(todos, state);
}

test('add appends a todo with the next id', () => {
  const state = run([
    { type: 'add', payload: 'Write the store' },
    { type: 'add', payload: 'Test it' },
  ]);
  expect(state).toEqual({
    todos: [
      { id: 1, title: 'Write the store', done: false },
      { id: 2, title: 'Test it', done: false },
    ],
    nextId: 3,
  });
});

test('toggle flips one todo', () => {
  const state = run([
    { type: 'add', payload: 'a' },
    { type: 'add', payload: 'b' },
    { type: 'toggle', payload: 2 },
  ]);
  expect(state.todos.map((todo) => todo.done)).toEqual([false, true]);
  expect(run([{ type: 'toggle', payload: 2 }], state).todos[1]?.done).toBe(
    false,
  );
});

test('rename changes the title of one todo', () => {
  const state = run([
    { type: 'add', payload: 'a' },
    { type: 'add', payload: 'b' },
    { type: 'rename', payload: { id: 1, title: 'first' } },
  ]);
  expect(state.todos.map((todo) => todo.title)).toEqual(['first', 'b']);
});

test('clearDone removes every todo that is done', () => {
  const titles = ['a', 'b', 'c', 'd', 'e'];
  const state = run([
    ...titles.map((title): TodoAction => ({ type: 'add', payload: title })),
    { type: 'toggle', payload: 2 },
    { type: 'toggle', payload: 4 },
    { type: 'toggle', payload: 5 },
    { type: 'clearDone' },
  ]);
  expect(state.todos.map((todo) => todo.title)).toEqual(['a', 'c']);
  expect(state.nextId).toBe(6);
});

test('the reducer does not change the state it is given', () => {
  const before = run([{ type: 'add', payload: 'a' }]);
  const after = run(
    [{ type: 'toggle', payload: 1 }, { type: 'clearDone' }],
    before,
  );
  expect(before.todos).toEqual([{ id: 1, title: 'a', done: false }]);
  expect(after.todos).toEqual([]);
});

test('an action the map does not have throws', () => {
  // JSON.parse returns any, so this compiles although TodoMap has no 'archive'.
  const archive: TodoAction = JSON.parse('{"type":"archive","payload":1}');
  expect(() => todos(empty, archive)).toThrow('unhandled action');
});

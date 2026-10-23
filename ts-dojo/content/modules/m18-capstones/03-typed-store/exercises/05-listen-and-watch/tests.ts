import type { Equal, Expect } from '@dojo/type-utils';
import { createStore, type ActionOf } from './index';

type Todo = { id: number; title: string; done: boolean };
type TodoState = { readonly todos: readonly Todo[]; readonly nextId: number };

interface TodoMap {
  add: string;
  toggle: number;
  clearDone: void;
}
type TodoAction = ActionOf<TodoMap>;

// Returns the same state object when an action changes nothing.
function todos(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'add':
      return {
        todos: [
          ...state.todos,
          { id: state.nextId, title: action.payload, done: false },
        ],
        nextId: state.nextId + 1,
      };
    case 'toggle':
      if (!state.todos.some((todo) => todo.id === action.payload)) return state;
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.payload ? { ...todo, done: !todo.done } : todo,
        ),
      };
    case 'clearDone': {
      const open = state.todos.filter((todo) => !todo.done);
      return open.length === state.todos.length
        ? state
        : { ...state, todos: open };
    }
  }
}

const empty: TodoState = { todos: [], nextId: 1 };
const makeStore = () => createStore(todos, empty);
declare const store: ReturnType<typeof makeStore>;

type cases = [
  Expect<
    Equal<
      Parameters<Parameters<typeof store.on<'toggle'>>[1]>[0],
      { type: 'toggle'; payload: number }
    >
  >, // a toggle listener gets a toggle action
  Expect<
    Equal<
      Parameters<Parameters<typeof store.on<'clearDone'>>[1]>[0],
      { type: 'clearDone' }
    >
  >, // with no payload for clearDone
  Expect<
    Equal<
      Parameters<Parameters<typeof store.on<'add' | 'clearDone'>>[1]>[0],
      { type: 'add'; payload: string } | { type: 'clearDone' }
    >
  >, // a union of types gets those members
  Expect<
    Equal<Parameters<Parameters<typeof store.on<'add'>>[1]>[1], TodoState>
  >, // and the new state
  Expect<
    Equal<
      Parameters<typeof store.watch<number>>[1],
      (next: number, previous: number) => void
    >
  >, // watch's listener takes the selected type twice
];

// @ts-expect-error
const unknownType = () => store.on('archive', () => {}); // the todos have no archive action

// @ts-expect-error
const titleIsText = () => store.on('add', (a) => a.payload.toFixed()); // a title is a string

const selectNextId = (state: TodoState) => state.nextId;

// @ts-expect-error
const countIsNumber = () => store.watch(selectNextId, (n) => n.trim()); // nextId is a number

export { unknownType, titleIsText, countIsNumber };

test('on calls its listener for its own type only', () => {
  const todoStore = createStore(todos, empty);
  const seen: unknown[] = [];
  todoStore.on('toggle', (action, state) =>
    seen.push([action, state.todos.length]),
  );
  todoStore.dispatch({ type: 'add', payload: 'a' });
  todoStore.dispatch({ type: 'add', payload: 'b' });
  todoStore.dispatch({ type: 'toggle', payload: 2 });
  todoStore.dispatch({ type: 'clearDone' });
  todoStore.dispatch({ type: 'toggle', payload: 1 });
  expect(seen).toEqual([
    [{ type: 'toggle', payload: 2 }, 2],
    [{ type: 'toggle', payload: 1 }, 1],
  ]);
});

test('on runs even when the state did not change', () => {
  const todoStore = createStore(todos, empty);
  const seen: string[] = [];
  todoStore.subscribe((_, action) => seen.push(`subscribe ${action.type}`));
  todoStore.on('clearDone', (action) => seen.push(`on ${action.type}`));
  todoStore.dispatch({ type: 'clearDone' });
  todoStore.dispatch({ type: 'clearDone' });
  expect(seen).toEqual(['on clearDone', 'on clearDone']);
});

test('several on listeners run in order, and each can be removed', () => {
  const todoStore = createStore(todos, empty);
  const seen: string[] = [];
  const stopFirst = todoStore.on('add', () => seen.push('first'));
  todoStore.on('add', () => seen.push('second'));
  todoStore.on('toggle', () => seen.push('toggle'));
  todoStore.dispatch({ type: 'add', payload: 'a' });
  stopFirst();
  stopFirst();
  todoStore.dispatch({ type: 'add', payload: 'b' });
  expect(seen).toEqual(['first', 'second', 'second']);
});

test('watch calls its listener when the selected value changes', () => {
  const todoStore = createStore(todos, empty);
  const seen: unknown[] = [];
  todoStore.watch(
    (state) => state.todos.filter((todo) => todo.done).length,
    (next, previous) => seen.push([next, previous]),
  );
  todoStore.dispatch({ type: 'add', payload: 'a' });
  todoStore.dispatch({ type: 'add', payload: 'b' });
  todoStore.dispatch({ type: 'toggle', payload: 1 });
  todoStore.dispatch({ type: 'toggle', payload: 2 });
  todoStore.dispatch({ type: 'add', payload: 'c' });
  todoStore.dispatch({ type: 'clearDone' });
  expect(seen).toEqual([
    [1, 0],
    [2, 1],
    [0, 2],
  ]);
});

test('watch starts from the state at the time it is called', () => {
  const todoStore = createStore(todos, empty);
  todoStore.dispatch({ type: 'add', payload: 'a' });
  todoStore.dispatch({ type: 'add', payload: 'b' });
  const seen: unknown[] = [];
  todoStore.watch(
    (state) => state.nextId,
    (next, previous) => seen.push([next, previous]),
  );
  todoStore.dispatch({ type: 'toggle', payload: 1 });
  todoStore.dispatch({ type: 'add', payload: 'c' });
  expect(seen).toEqual([[4, 3]]);
});

test('watch compares with Object.is and can be removed', () => {
  const todoStore = createStore(todos, empty);
  let calls = 0;
  // A new list of the same titles on every change: Object.is sees a new value each time.
  const stop = todoStore.watch(
    (state) => state.todos.map((todo) => todo.title),
    () => calls++,
  );
  todoStore.dispatch({ type: 'add', payload: 'a' });
  todoStore.dispatch({ type: 'toggle', payload: 1 });
  expect(calls).toBe(2);
  todoStore.dispatch({ type: 'toggle', payload: 9 });
  expect(calls).toBe(2);
  stop();
  todoStore.dispatch({ type: 'add', payload: 'b' });
  expect(calls).toBe(2);
});

test('subscribe, select and getState still work', () => {
  const todoStore = createStore(todos, empty);
  let calls = 0;
  todoStore.subscribe(() => calls++);
  for (let i = 1; i <= 3; i++)
    todoStore.dispatch({ type: 'add', payload: `t${i}` });
  todoStore.dispatch({ type: 'toggle', payload: 7 });
  expect(calls).toBe(3);
  expect(
    todoStore.select((state) => state.todos.map((todo) => todo.title)),
  ).toEqual(['t1', 't2', 't3']);
  expect(todoStore.getState().nextId).toBe(4);
});

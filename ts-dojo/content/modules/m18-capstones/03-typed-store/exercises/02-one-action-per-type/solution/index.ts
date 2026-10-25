export type Todo = { id: number; title: string; done: boolean };
export type TodoState = {
  readonly todos: readonly Todo[];
  readonly nextId: number;
};

export interface TodoMap {
  add: string;
  toggle: number;
  rename: { id: number; title: string };
  clearDone: void;
}

// One action per key of the map, so the type decides the payload.
export type ActionOf<M, K extends keyof M = keyof M> = {
  [P in keyof M]: M[P] extends void ? { type: P } : { type: P; payload: M[P] };
}[K];

export type TodoAction = ActionOf<TodoMap>;

export function todos(state: TodoState, action: TodoAction): TodoState {
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
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.payload ? { ...todo, done: !todo.done } : todo,
        ),
      };
    case 'rename':
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.payload.id
            ? { ...todo, title: action.payload.title }
            : todo,
        ),
      };
    case 'clearDone':
      return { ...state, todos: state.todos.filter((todo) => !todo.done) };
    default: {
      const unhandled: never = action;
      throw new Error(`unhandled action ${JSON.stringify(unhandled)}`);
    }
  }
}

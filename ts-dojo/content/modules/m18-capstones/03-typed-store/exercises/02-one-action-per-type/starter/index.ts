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

// One object type for every action: nothing ties a payload to its type.
export type TodoAction = {
  type: keyof TodoMap;
  payload: TodoMap[keyof TodoMap];
};

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
    default: {
      const unhandled: never = action;
      throw new Error(`unhandled action ${JSON.stringify(unhandled)}`);
    }
  }
}

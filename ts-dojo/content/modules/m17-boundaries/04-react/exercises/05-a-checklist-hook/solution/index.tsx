import { useReducer } from 'react';

export type Filter = 'all' | 'open' | 'done';
export type Item = { id: number; text: string; done: boolean };
export type ChecklistState = { items: Item[]; filter: Filter; nextId: number };

export type ChecklistAction =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'filter'; filter: Filter }
  | { type: 'clear-done' };

export function checklistReducer(
  state: ChecklistState,
  action: ChecklistAction,
): ChecklistState {
  switch (action.type) {
    case 'add': {
      const item = { id: state.nextId, text: action.text, done: false };
      return {
        ...state,
        items: [...state.items, item],
        nextId: state.nextId + 1,
      };
    }
    case 'toggle':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, done: !item.done } : item,
        ),
      };
    case 'filter':
      return { ...state, filter: action.filter };
    case 'clear-done':
      return { ...state, items: state.items.filter((item) => !item.done) };
  }
}

function start(texts: readonly string[]): ChecklistState {
  const items = texts.map((text, i) => ({ id: i + 1, text, done: false }));
  return { items, filter: 'all', nextId: items.length + 1 };
}

export function useChecklist(initial: readonly string[]) {
  const [state, dispatch] = useReducer(checklistReducer, initial, start);
  const visible = state.items.filter(
    (item) => state.filter === 'all' || item.done === (state.filter === 'done'),
  );
  return [visible, dispatch] as const;
}

export function Checklist({ initial }: { initial: readonly string[] }) {
  const [visible, dispatch] = useChecklist(initial);
  return (
    <ul>
      {visible.map((item) => (
        <li
          key={item.id}
          onClick={() => dispatch({ type: 'toggle', id: item.id })}
        >
          {item.done ? '[x]' : '[ ]'} {item.text}
        </li>
      ))}
    </ul>
  );
}

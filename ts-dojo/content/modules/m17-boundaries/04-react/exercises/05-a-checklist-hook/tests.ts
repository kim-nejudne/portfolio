import type { Dispatch } from 'react';
import type { Equal, Expect } from '@dojo/type-utils';
import {
  checklistReducer,
  useChecklist,
  type ChecklistAction,
  type ChecklistState,
  type Filter,
  type Item,
} from './index';

// Flattens each member, so the actions may be written with a shared base type.
type Flat<T> = { [K in keyof T]: T[K] };

declare const state: ChecklistState;

type cases = [
  Expect<
    Equal<
      Flat<ChecklistAction>,
      | { type: 'add'; text: string }
      | { type: 'toggle'; id: number }
      | { type: 'filter'; filter: Filter }
      | { type: 'clear-done' }
    >
  >, // one member per action
  Expect<
    Equal<
      ReturnType<typeof useChecklist>,
      readonly [Item[], Dispatch<ChecklistAction>]
    >
  >, // the hook returns a pair
];

// @ts-expect-error
const addNothing = () => checklistReducer(state, { type: 'add' }); // add needs text

// @ts-expect-error
const toggleText = () => checklistReducer(state, { type: 'toggle', text: 'a' }); // toggle takes an id

// @ts-expect-error
const remove = () => checklistReducer(state, { type: 'remove', id: 1 }); // no remove action

// @ts-expect-error
const noFilter = () => checklistReducer(state, { type: 'filter' }); // filter needs a filter

export { addNothing, toggleText, remove, noFilter };

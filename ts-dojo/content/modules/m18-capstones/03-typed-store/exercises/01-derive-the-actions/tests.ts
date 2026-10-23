import type { Equal, Expect } from '@dojo/type-utils';
import type { ActionOf, SetterMap } from './index';

interface CounterMap {
  add: number;
  rename: string;
  reset: void;
}

type Settings = { theme: 'light' | 'dark'; fontSize: number };

// Keys made by a template literal type: loadUsers, loadPosts, loadTags
type LoadMap = Record<`load${'Users' | 'Posts' | 'Tags'}`, string[]>;

type cases = [
  Expect<
    Equal<
      ActionOf<CounterMap>,
      | { type: 'add'; payload: number }
      | { type: 'rename'; payload: string }
      | { type: 'reset' }
    >
  >, // one action per key, and no payload for void
  Expect<Equal<ActionOf<CounterMap, 'add'>, { type: 'add'; payload: number }>>, // K picks one action
  Expect<
    Equal<
      ActionOf<CounterMap, 'rename' | 'reset'>,
      { type: 'rename'; payload: string } | { type: 'reset' }
    >
  >, // K picks several
  Expect<Equal<ActionOf<{ clear: undefined }>, { type: 'clear' }>>, // no payload for undefined
  Expect<
    Equal<
      ActionOf<{ search: string | undefined }>,
      { type: 'search'; payload: string | undefined }
    >
  >, // a payload that may be undefined is still a payload
  Expect<
    Equal<
      ActionOf<LoadMap>,
      | { type: 'loadUsers'; payload: string[] }
      | { type: 'loadPosts'; payload: string[] }
      | { type: 'loadTags'; payload: string[] }
    >
  >, // a generated map
  Expect<
    Equal<
      SetterMap<Settings>,
      { setTheme: 'light' | 'dark'; setFontSize: number }
    >
  >, // a setter per property
  Expect<
    Equal<
      SetterMap<{ 0: boolean; [Symbol.iterator]: number; userName: string }>,
      { setUserName: string }
    >
  >, // only string keys get a setter
  Expect<
    Equal<
      ActionOf<SetterMap<Settings>>,
      | { type: 'setTheme'; payload: 'light' | 'dark' }
      | { type: 'setFontSize'; payload: number }
    >
  >, // the setters as actions
];

type CounterAction = ActionOf<CounterMap>;
type SettingsAction = ActionOf<SetterMap<Settings>>;

// @ts-expect-error
const wrongPayload: CounterAction = { type: 'add', payload: '2' }; // a payload belongs to its type

// @ts-expect-error
const resetWithPayload: CounterAction = { type: 'reset', payload: 0 }; // reset carries nothing

// @ts-expect-error
const missingPayload: CounterAction = { type: 'rename' }; // rename needs its payload

// @ts-expect-error
const blue: SettingsAction = { type: 'setTheme', payload: 'blue' }; // light or dark only

export { wrongPayload, resetWithPayload, missingPayload, blue };

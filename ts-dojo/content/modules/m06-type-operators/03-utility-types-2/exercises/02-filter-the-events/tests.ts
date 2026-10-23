import type { Equal, Expect } from '@dojo/type-utils';
import type { EventOf, OtherEvents, Payload } from './index';

type UIEvent =
  | { type: 'click'; x: number; y: number }
  | { type: 'keydown'; key: string; repeat: boolean }
  | { type: 'keyup'; key: string }
  | { type: 'scroll'; deltaY: number };

type Action =
  | { type: 'add'; item: string }
  | { type: 'remove'; index: number }
  | { type: 'clear' };

type cases = [
  Expect<
    Equal<EventOf<UIEvent, 'click'>, { type: 'click'; x: number; y: number }>
  >, // the click event
  Expect<
    Equal<
      EventOf<UIEvent, 'keydown' | 'keyup'>,
      | { type: 'keydown'; key: string; repeat: boolean }
      | { type: 'keyup'; key: string }
    >
  >, // both key events
  Expect<Equal<EventOf<Action, 'clear'>, { type: 'clear' }>>, // works on any tagged union
  Expect<
    Equal<
      OtherEvents<UIEvent, 'scroll'>,
      | { type: 'click'; x: number; y: number }
      | { type: 'keydown'; key: string; repeat: boolean }
      | { type: 'keyup'; key: string }
    >
  >, // everything but scroll
  Expect<Equal<OtherEvents<Action, 'add' | 'remove'>, { type: 'clear' }>>, // everything but add and remove
  Expect<Equal<Payload<UIEvent, 'click'>, { x: number; y: number }>>, // a click carries x and y
  Expect<Equal<Payload<UIEvent, 'keydown'>, { key: string; repeat: boolean }>>, // a keydown carries its key
  Expect<Equal<Payload<Action, 'remove'>, { index: number }>>, // a remove carries an index
  Expect<Equal<Payload<Action, 'clear'>, {}>>, // a clear carries nothing
];

// @ts-expect-error
type Hover = EventOf<UIEvent, 'hover'>; // hover is not a UIEvent type

// @ts-expect-error
type Undo = OtherEvents<Action, 'undo'>; // undo is not an Action type

// @ts-expect-error
type ResetPayload = Payload<Action, 'reset'>; // reset is not an Action type

// @ts-expect-error
type Untagged = EventOf<{ name: string }, 'x'>; // a union without type is not tagged

// @ts-expect-error
const scroll: EventOf<UIEvent, 'click'> = { type: 'scroll', deltaY: 1 }; // a scroll is not a click

// @ts-expect-error
const add: OtherEvents<Action, 'add'> = { type: 'add', item: 'tea' }; // add was left out

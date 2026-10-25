import type { Equal, Expect } from '@dojo/type-utils';
import type { UIEvent } from './index';

type cases = [
  Expect<
    Equal<
      UIEvent,
      | { type: 'click'; x: number; y: number }
      | { type: 'keydown'; key: string }
      | { type: 'scroll'; deltaY: number }
    >
  >, // exactly the three members
  Expect<
    Equal<
      Extract<UIEvent, { type: 'keydown' }>,
      { type: 'keydown'; key: string }
    >
  >, // narrowing by type finds the keydown
];

const click: UIEvent = { type: 'click', x: 1, y: 2 }; // a click is accepted
const scroll: UIEvent = { type: 'scroll', deltaY: 3 }; // a scroll is accepted

// @ts-expect-error a click has no key
const clickWithKey: UIEvent = { type: 'click', x: 1, y: 2, key: 'a' };

// @ts-expect-error hover is not one of the three types
const hover: UIEvent = { type: 'hover', x: 1, y: 2 };

export { click, scroll, clickWithKey, hover };

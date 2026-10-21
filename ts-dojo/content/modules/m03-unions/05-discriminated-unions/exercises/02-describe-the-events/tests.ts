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
  >, // exactly the three events
];

const click: UIEvent = { type: 'click', x: 1, y: 2 };
const keydown: UIEvent = { type: 'keydown', key: 'Enter' };
const scroll: UIEvent = { type: 'scroll', deltaY: 3 };

// @ts-expect-error
const clickWithKey: UIEvent = { type: 'click', x: 1, y: 2, key: 'a' }; // a click has no key

// @ts-expect-error
const keydownWithoutKey: UIEvent = { type: 'keydown' }; // a keydown needs its key

// @ts-expect-error
const hover: UIEvent = { type: 'hover', x: 1, y: 2 }; // hover is not one of the three

export { click, keydown, scroll, clickWithKey, keydownWithoutKey, hover };

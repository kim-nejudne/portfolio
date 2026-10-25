import type { Equal, Expect } from '@dojo/type-utils';
import type { EventName } from './index';

type cases = [
  Expect<Equal<EventName<'onClick'>, 'click'>>, // the prefix goes, the C is lowercased
  Expect<Equal<EventName<'onKeyDown'>, 'keyDown'>>, // only the first character changes
  Expect<Equal<EventName<'onX'>, 'x'>>, // one character after the prefix
  Expect<Equal<EventName<'onPointerLeaveCapture'>, 'pointerLeaveCapture'>>, // a long name
  Expect<
    Equal<EventName<'onDoubleClick' | 'onScroll'>, 'doubleClick' | 'scroll'>
  >, // each member of a union
  Expect<Equal<EventName<'click'>, never>>, // no prefix
  Expect<Equal<EventName<'handleClick'>, never>>, // a different prefix
  Expect<Equal<EventName<'onFocus' | 'handleBlur' | 'blur'>, 'focus'>>, // only the handlers are kept
  Expect<Equal<EventName<42>, never>>, // not a string at all
  Expect<Equal<EventName<never>, never>>, // no names, no events
  Expect<Equal<EventName<`onItem${number}`>, `item${number}`>>, // a pattern of names
  Expect<Equal<`on${Capitalize<EventName<'onWheel'>>}`, 'onWheel'>>, // the round trip
];

// @ts-expect-error
const wrongCase: EventName<'onKeyUp'> = 'KeyUp'; // the first letter is lowercase

// @ts-expect-error
const notAHandler: EventName<'onBlur' | 'reset'> = 'reset'; // reset is not a handler name

export { wrongCase, notAHandler };

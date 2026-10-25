import type { Equal, Expect } from '@dojo/type-utils';
import type debounce from 'tiny-debounce';

// The tests declare a value of the declared type: nothing here runs.
declare const debounceFn: typeof debounce;

const save = debounceFn((text: string, id: number) => text.length + id, 200);
const resize = debounceFn(() => {});
const log = debounceFn((...lines: string[]) => console.log(lines.join('\n')));

type cases = [
  Expect<Equal<typeof import('tiny-debounce'), typeof debounce>>, // the module is the function itself
  Expect<Equal<typeof save, debounce.Debounced<[text: string, id: number]>>>, // a debounced function of fn's arguments
  Expect<Equal<Parameters<typeof save>, [text: string, id: number]>>, // it takes fn's arguments
  Expect<Equal<ReturnType<typeof save>, void>>, // and returns nothing
  Expect<Equal<Parameters<typeof resize>, []>>, // no arguments stay no arguments
  Expect<Equal<Parameters<typeof log>, string[]>>, // rest parameters stay rest parameters
  Expect<Equal<ReturnType<typeof save.cancel>, void>>, // cancel returns nothing
  Expect<
    Equal<Pick<typeof debounceFn, 'defaultWait'>, { defaultWait: number }>
  >, // the default wait is a number that callers may change
  Expect<Equal<Parameters<typeof debounceFn>[1], number | undefined>>, // the wait is optional
];

// @ts-expect-error
save('draft'); // save needs an id too

// @ts-expect-error
save(1, 2); // the text is a string

// @ts-expect-error
debounceFn(() => {}, '200'); // the wait is a number

// @ts-expect-error
debounceFn.cancel(); // only a debounced function has cancel

// @ts-expect-error
debounceFn('save'); // debounce takes a function

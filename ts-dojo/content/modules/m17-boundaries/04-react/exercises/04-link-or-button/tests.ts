import type { ComponentProps, ReactNode } from 'react';
import type { Equal, Expect } from '@dojo/type-utils';
import { Action } from './index';

// Flattens each member, so the props may be written with a shared base type.
type Flat<T> = { [K in keyof T]: T[K] };

// The props as a call or a JSX element sees them.
type P = ComponentProps<typeof Action>;

const go = () => {};

type cases = [
  Expect<
    Equal<
      Flat<P>,
      | { variant: 'link'; href: string; children: ReactNode }
      | {
          variant: 'button';
          onPress: () => void;
          disabled?: boolean;
          children: ReactNode;
        }
    >
  >, // one member per variant
];

// @ts-expect-error
const noHref: P = { variant: 'link', children: 'Home' }; // a link needs its href

// @ts-expect-error
const linkPress: P = { variant: 'link', href: '/', onPress: go, children: 1 }; // no onPress on a link

// @ts-expect-error
const noPress: P = { variant: 'button', children: 'Save' }; // a button needs onPress

// @ts-expect-error
const btnHref: P = { variant: 'button', onPress: go, href: '/', children: 1 }; // no href on a button

// @ts-expect-error
const linkOff: P = { variant: 'link', href: '/', disabled: true, children: 1 }; // a link can't be disabled

export { noHref, linkPress, noPress, btnHref, linkOff };

import type { ComponentProps, ReactNode } from 'react';
import type { Equal, Expect } from '@dojo/type-utils';
import { Notice } from './index';

// Flattens an intersection, so the props may be written as one object type or several.
type Flat<T> = { [K in keyof T]: T[K] };

type cases = [
  Expect<
    Equal<
      Flat<ComponentProps<typeof Notice>>,
      { title: string; tone?: 'info' | 'warn' | 'error'; children: ReactNode }
    >
  >, // exactly these props
];

// @ts-expect-error
const numberTitle = () => Notice({ title: 404, children: 'Gone' }); // a title is a string

// @ts-expect-error
const loudTone = () => Notice({ title: 'Saved', tone: 'loud', children: 'Ok' }); // three tones

// @ts-expect-error
const noChildren = () => Notice({ title: 'Saved' }); // children are required

export { numberTitle, loudTone, noChildren };

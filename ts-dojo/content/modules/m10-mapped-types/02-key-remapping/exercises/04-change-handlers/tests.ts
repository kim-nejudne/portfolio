import type { Equal, Expect } from '@dojo/type-utils';
import type { ChangeHandlers } from './index';

declare const key: unique symbol;

type Editor = {
  readonly id: string;
  text: string;
  cursor: number;
  selection?: [number, number];
  _history: string[];
  save(): Promise<void>;
  format: (text: string) => string;
  1: string;
  [key]: boolean;
};

type cases = [
  Expect<
    Equal<
      ChangeHandlers<{ text: string; _draft: string; save(): void }>,
      { onTextChange?: (value: string) => void }
    >
  >, // the prompt's example
  Expect<
    Equal<
      ChangeHandlers<Editor>,
      {
        onIdChange?: (value: string) => void;
        onTextChange?: (value: string) => void;
        onCursorChange?: (value: number) => void;
        onSelectionChange?: (value: [number, number] | undefined) => void;
      }
    >
  >, // data only, optional and writable
  Expect<
    Equal<
      ChangeHandlers<{ URL: string; isOpen: boolean }>,
      {
        onURLChange?: (value: string) => void;
        onIsOpenChange?: (value: boolean) => void;
      }
    >
  >, // only the first letter changes
  Expect<
    Equal<
      ChangeHandlers<{ count?: number; label: string | null }>,
      {
        onCountChange?: (value: number | undefined) => void;
        onLabelChange?: (value: string | null) => void;
      }
    >
  >, // a second state type
  Expect<
    Equal<
      ChangeHandlers<{ a_b: 1; _a: 2; __b: 3 }>,
      { onA_bChange?: (value: 1) => void }
    >
  >, // only a leading underscore counts
  Expect<Equal<ChangeHandlers<{ _a: 1; run(): void }>, {}>>, // nothing left
  Expect<Equal<ChangeHandlers<{}>, {}>>, // no properties
];

// @ts-expect-error
type OnSave = ChangeHandlers<Editor>['onSaveChange']; // save is a method

// @ts-expect-error
const wrong: ChangeHandlers<Editor> = { onCursorChange: (v: string) => {} }; // a cursor is a number

export type { OnSave };
export { wrong };

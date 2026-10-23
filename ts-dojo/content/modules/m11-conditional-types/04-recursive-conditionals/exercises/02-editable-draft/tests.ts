import type { Equal, Expect } from '@dojo/type-utils';
import { applyEdits, type Draft, type Settings } from './index';

type Format = (size: number) => string;

type cases = [
  Expect<
    Equal<
      Draft<Settings>,
      {
        theme: { mode: 'light' | 'dark'; accent: [number, number, number] };
        editor: {
          tabSize: number;
          rulers: number[];
          vim: { enabled: boolean; leader: string };
        };
        format: Format;
      }
    >
  >, // every level is writable
  Expect<Equal<Settings['theme']['accent'], readonly [number, number, number]>>, // Settings is as it was
  Expect<Equal<Settings['editor']['vim']['enabled'], boolean>>, // Settings is as it was
  Expect<Equal<Draft<readonly string[]>, string[]>>, // a read-only array
  Expect<
    Equal<Draft<{ readonly a?: { readonly b: 1 }[] }>, { a?: { b: 1 }[] }>
  >, // ? stays
  Expect<Equal<Draft<Format>, Format>>, // a function is kept
  Expect<Equal<Draft<{ readonly n: number } | null>, { n: number } | null>>, // a union
  Expect<Equal<Draft<string>, string>>, // a primitive
];

function makeDraft(): Draft<Settings> {
  return {
    theme: { mode: 'light', accent: [12, 90, 50] },
    editor: {
      tabSize: 2,
      rulers: [80],
      vim: { enabled: false, leader: ' ' },
    },
    format: (size) => `${size} spaces`,
  };
}

test('applyEdits changes every level of the draft', () => {
  const draft = makeDraft();
  applyEdits(draft);
  expect(draft.theme.mode).toBe('dark');
  expect(draft.theme.accent).toEqual([210, 90, 50]);
  expect(draft.editor.rulers).toEqual([80, 120]);
  expect(draft.editor.vim).toEqual({ enabled: true, leader: ' ' });
  expect(draft.editor.tabSize).toBe(4);
});

test('applyEdits formats the new tab size', () => {
  expect(applyEdits(makeDraft())).toBe('4 spaces');
});

// `^?` widget placement (§4 Twoslash queries; §12 F3: "A //   ^? line shows the queried type
// under it and updates on edit"): one widget per answered query at the end of its comment
// line, the error text for a query that points at nothing, nothing for a line that is gone.
import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { placeTwoslash } from './twoslash.ts';

const doc = Text.of(['const a = 1;', '//    ^?', 'const b = a;', '//    ^?']);

describe('placeTwoslash', () => {
  it('puts each answer at the end of its comment line', () => {
    expect(
      placeTwoslash(doc, [
        { line: 2, column: 7, offset: 6, text: 'const a: 1' },
        { line: 4, column: 7, offset: 32, text: 'const b: number' },
      ]),
    ).toEqual([
      { pos: doc.line(2).to, text: 'const a: 1', error: false },
      { pos: doc.line(4).to, text: 'const b: number', error: false },
    ]);
  });

  it('shows the error text when the query points at nothing', () => {
    expect(
      placeTwoslash(doc, [
        { line: 2, column: 3, offset: 2, error: 'Nothing to show here' },
      ]),
    ).toEqual([
      { pos: doc.line(2).to, text: 'Nothing to show here', error: true },
    ]);
  });

  it('drops a query whose line is outside the document or that has no text', () => {
    expect(
      placeTwoslash(doc, [
        { line: 9, column: 7, offset: null, text: 'gone' },
        { line: 0, column: 7, offset: null, text: 'gone' },
        { line: 2, column: 7, offset: 6 },
      ]),
    ).toEqual([]);
  });
});

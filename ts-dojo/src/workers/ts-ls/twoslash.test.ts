// The `^?` site scanner (§4 Type feedback): one site per line matching `//\s*\^\?`, with the
// comment's line, the caret column and the offset of the character above it; no offset when
// nothing is above the caret; `^?` outside a comment line is not a query.
import { describe, expect, it } from 'vitest';
import { findTwoslashQueries } from './twoslash';

describe('findTwoslashQueries', () => {
  it('finds the caret column and the offset on the line above', () => {
    const text = 'const greeting = "hi";\n//    ^?\n';
    expect(findTwoslashQueries(text)).toEqual([
      { line: 2, column: 7, offset: 6 },
    ]);
    expect(text[6]).toBe('g');
  });

  it('handles indentation, no space after //, several queries and CRLF', () => {
    const text = [
      'function f() {',
      '  const inner = 1;',
      '  //    ^?',
      '  return inner;',
      '  //     ^?',
      '}',
      'const last = f();',
      '//^?',
      '',
    ].join('\r\n');
    const sites = findTwoslashQueries(text);
    expect(sites.map((site) => [site.line, site.column])).toEqual([
      [3, 9],
      [5, 10],
      [8, 3],
    ]);
    for (const site of sites) {
      expect(site.offset).not.toBeNull();
    }
    expect(
      text.slice(sites[0]?.offset ?? -1, (sites[0]?.offset ?? -1) + 5),
    ).toBe('inner');
    expect(
      text.slice(sites[1]?.offset ?? -1, (sites[1]?.offset ?? -1) + 5),
    ).toBe('inner');
    expect(text[sites[2]?.offset ?? -1]).toBe('n');
  });

  it('gives no offset when the query is on the first line or the caret is past the line above', () => {
    expect(findTwoslashQueries('//  ^?\nconst x = 1;')).toEqual([
      { line: 1, column: 5, offset: null },
    ]);
    expect(findTwoslashQueries('x\n//       ^?')).toEqual([
      { line: 2, column: 10, offset: null },
    ]);
    // The caret under the position right after the last character is the line break.
    expect(findTwoslashQueries('ab\n//^?')).toEqual([
      { line: 2, column: 3, offset: null },
    ]);
  });

  it('ignores ^? that is not a comment line of its own', () => {
    expect(
      findTwoslashQueries('const s = "// ^?";\nconst t = 1; // ^?\n/* ^? */'),
    ).toEqual([]);
  });
});

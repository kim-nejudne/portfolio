// Short content text (hints, and the question, options and explanation of a Check yourself or
// `predict` question) is plain text with Markdown's code spans: `x` shows as code, as §3's own
// hint example writes it (`The parameter type is \`"on" | "off"\`.`). Nothing else is Markdown.
import { describe, expect, it } from 'vitest';
import { codeSpans, hasCodeSpan, shownText } from './inline-code';

describe('codeSpans', () => {
  it('splits text into prose and code spans', () => {
    expect(codeSpans('The parameter type is `"on" | "off"`.')).toEqual([
      { code: false, text: 'The parameter type is ' },
      { code: true, text: '"on" | "off"' },
      { code: false, text: '.' },
    ]);
    expect(codeSpans('`K` and `keyof`')).toEqual([
      { code: true, text: 'K' },
      { code: false, text: ' and ' },
      { code: true, text: 'keyof' },
    ]);
  });

  it('leaves text without a pair of backticks alone, a lone backtick included', () => {
    expect(codeSpans('no code here')).toEqual([
      { code: false, text: 'no code here' },
    ]);
    expect(codeSpans('a lone ` stays')).toEqual([
      { code: false, text: 'a lone ` stays' },
    ]);
    expect(codeSpans('`a` and a lone `')).toEqual([
      { code: true, text: 'a' },
      { code: false, text: ' and a lone `' },
    ]);
    expect(codeSpans('')).toEqual([]);
  });

  it('says whether there is a code span, and gives the text as the page shows it', () => {
    expect(hasCodeSpan('`never`')).toBe(true);
    expect(hasCodeSpan('never')).toBe(false);
    expect(hasCodeSpan('a lone `')).toBe(false);
    expect(shownText('What is `K`, or `keyof T`?')).toBe(
      'What is K, or keyof T?',
    );
  });
});

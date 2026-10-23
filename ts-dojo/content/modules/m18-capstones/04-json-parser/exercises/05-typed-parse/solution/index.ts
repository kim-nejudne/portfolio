import type { ParseError, ParseJson } from './json';

// What parse returns: the parsed type for a literal, unknown for a plain string, whose text
// isn't known until run time.
export type Parsed<S extends string> = string extends S
  ? unknown
  : ParseJson<S>;

// unknown when the text parses, or is a plain string; the ParseError when a literal doesn't.
type Problem<S extends string> = string extends S
  ? unknown
  : ParseJson<S> extends ParseError
    ? ParseJson<S>
    : unknown;

// Parses JSON text. A literal argument gets the exact type its text spells, a literal that
// isn't JSON doesn't compile, and a plain string gives unknown.
export function parse<S extends string>(text: S & Problem<S>): Parsed<S> {
  const value: unknown = JSON.parse(text);
  // The compiler can't follow ParseJson through JSON.parse; the tests check that they agree.
  return value as Parsed<S>;
}

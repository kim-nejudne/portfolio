import type { ParseError, ParseJson } from './json';

// Parses JSON text. A literal argument gets the exact type its text spells, a literal that
// isn't JSON doesn't compile, and a plain string gives unknown.
export function parse(text: string): unknown {
  throw new Error(`not implemented: ${text}`);
}

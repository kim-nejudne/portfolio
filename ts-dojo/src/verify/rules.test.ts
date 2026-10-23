// The §5 rule table: every id in the spec's order, the three that can never be turned off, a
// message for each, and the tests.ts check the worker's rules key on.
import { describe, expect, it } from 'vitest';
import {
  ALWAYS_ON_RULES,
  IMPLICIT_ANY_CODES,
  isRuleId,
  isTestFile,
  RULE_IDS,
  RULE_MESSAGES,
} from './rules';

describe('§5 rule ids', () => {
  it("lists the spec's eight rules in its order, then the two opt-in rules of the pre-F13 fixes and F13's type-utils-import", () => {
    expect(RULE_IDS).toEqual([
      'ts-directive',
      'explicit-any',
      'implicit-any',
      'as-unknown-as',
      'non-null-assertion',
      'angle-cast',
      'eval',
      'no-skipped-tests',
      'type-assertion',
      'any-expression',
      'type-utils-import',
    ]);
  });

  it('names every double assertion, and the two new rules say what they forbid (pre-F13)', () => {
    expect(RULE_MESSAGES['as-unknown-as']).toBe(
      'a double assertion (`x as unknown as T`, `x as object as T`) is not allowed',
    );
    expect(RULE_MESSAGES['type-assertion']).toBe(
      'a type assertion (`x as T`, `<T>x`) is not allowed; `as const` is fine',
    );
    expect(RULE_MESSAGES['any-expression']).toBe(
      'this expression has type `any`; give it a type (an `any` passed to `unknown` is fine)',
    );
  });

  it('ts-directive, eval, no-skipped-tests and type-utils-import are always on', () => {
    expect([...ALWAYS_ON_RULES]).toEqual([
      'ts-directive',
      'eval',
      'no-skipped-tests',
      'type-utils-import',
    ]);
  });

  // After F13 (Kim, 23 October 2026): the test helpers are for tests.ts, so a solution can't
  // borrow `IsAny` or `UnionToIntersection` instead of writing it.
  it('type-utils-import says the helpers are for tests.ts', () => {
    expect(RULE_MESSAGES['type-utils-import']).toBe(
      '@dojo/type-utils is for tests.ts; write the helper in your own file',
    );
  });

  it('has a message for every rule and recognises ids', () => {
    for (const id of RULE_IDS) {
      expect(RULE_MESSAGES[id]).toMatch(/\S/);
      expect(isRuleId(id)).toBe(true);
    }
    expect(isRuleId('no-console')).toBe(false);
    expect(isRuleId(7006)).toBe(false);
  });

  it('implicit-any is diagnostic codes 7006 and 7031', () => {
    expect(IMPLICIT_ANY_CODES).toEqual([7006, 7031]);
  });

  it('tests.ts is the test file whatever directory it is in', () => {
    expect(isTestFile('/tests.ts')).toBe(true);
    expect(isTestFile('tests.ts')).toBe(true);
    expect(isTestFile('/src/tests.ts')).toBe(true);
    expect(isTestFile('/index.ts')).toBe(false);
    expect(isTestFile('/my-tests.ts')).toBe(false);
  });
});

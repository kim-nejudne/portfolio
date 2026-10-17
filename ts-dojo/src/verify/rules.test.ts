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
  it('lists the eight rules in the spec order', () => {
    expect(RULE_IDS).toEqual([
      'ts-directive',
      'explicit-any',
      'implicit-any',
      'as-unknown-as',
      'non-null-assertion',
      'angle-cast',
      'eval',
      'no-skipped-tests',
    ]);
  });

  it('ts-directive, eval and no-skipped-tests are always on', () => {
    expect([...ALWAYS_ON_RULES]).toEqual([
      'ts-directive',
      'eval',
      'no-skipped-tests',
    ]);
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

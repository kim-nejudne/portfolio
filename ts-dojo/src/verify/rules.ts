// The §5 rule ids, their messages and which ones are always on, plus the two opt-in rules of
// the pre-F13 fixes, `type-assertion` and `any-expression` (Kim's decision on 23 October 2026;
// under Deviations in docs/progress.md), which also widened `as-unknown-as` to every double
// assertion. After F13 (Kim, 23 October 2026) `type-utils-import` keeps `@dojo/type-utils` in
// tests.ts, always on. The ts-ls worker's AST walk
// (src/workers/ts-ls/rules.ts) produces the hits; exercises list ids in `forbid` (§3); the
// verifier assembles the Rules group of the verdict from the hits (F7).

export const RULE_IDS = [
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
] as const;

export type RuleId = (typeof RULE_IDS)[number];

/** §5 "always; cannot be turned off": run on every lintAst call whatever `rules` says. */
export const ALWAYS_ON_RULES = [
  'ts-directive',
  'eval',
  'no-skipped-tests',
  'type-utils-import',
] as const satisfies readonly RuleId[];

export const RULE_MESSAGES: Record<RuleId, string> = {
  'ts-directive':
    '@ts-ignore, @ts-nocheck and @ts-expect-error are not allowed outside tests.ts',
  'explicit-any': 'explicit `any` is not allowed',
  'implicit-any': 'this value implicitly has an `any` type',
  'as-unknown-as':
    'a double assertion (`x as unknown as T`, `x as object as T`) is not allowed',
  'non-null-assertion': 'the non-null assertion `!` is not allowed',
  'angle-cast': 'the angle-bracket cast `<T>x` is not allowed',
  eval: 'eval and new Function are not allowed',
  'no-skipped-tests': 'test.skip is not allowed in tests.ts',
  'type-assertion':
    'a type assertion (`x as T`, `<T>x`) is not allowed; `as const` is fine',
  'any-expression':
    'this expression has type `any`; give it a type (an `any` passed to `unknown` is fine)',
  'type-utils-import':
    '@dojo/type-utils is for tests.ts; write the helper in your own file',
};

/** §5: the diagnostic codes the `implicit-any` rule reports (only reachable with noImplicitAny off). */
export const IMPLICIT_ANY_CODES: readonly number[] = [7006, 7031];

export function isRuleId(value: unknown): value is RuleId {
  return (
    typeof value === 'string' && (RULE_IDS as readonly string[]).includes(value)
  );
}

/** The basename rules key on: `ts-directive` skips it, `no-skipped-tests` only looks at it. */
export const TEST_FILE_NAME = 'tests.ts';

export function isTestFile(path: string): boolean {
  return path === TEST_FILE_NAME || path.endsWith(`/${TEST_FILE_NAME}`);
}

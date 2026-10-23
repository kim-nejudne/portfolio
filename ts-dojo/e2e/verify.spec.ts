// §12 F7, exercise verification (spec §5, and the Tests tab of §4 "Running and the output
// pane"), on the three editor fixtures under fixtures/content/modules/m99-fixtures, driven from the
// keyboard in Chrome:
//   1. "For a `type-challenge` fixture, each `cases` element is its own case with pass or fail,
//      and an unused `@ts-expect-error` fails its case."
//   2. "For an `implement` fixture, every runtime test reports pass or fail with expected and
//      actual; a 1 s hang reports `timeout`."
//   3. "`forbid: [explicit-any]` fails a solution with `any` and names the line; without the
//      rule the same solution passes."
//   4. "A `@ts-ignore`, `@ts-nocheck` or `@ts-expect-error` in a non-test user file always
//      fails, and so does `eval`."
//   5. "A `fix` exercise passes only when every file has zero diagnostics."
//   6. "Compiles failing stops the other groups, with the reason shown."
//   7. "The Tests tab shows the four groups; `j`/`k` move, `Enter` expands or jumps to the
//      source."
// A page cannot change a fixture's `forbid` list, so criterion 3's second half ("without the
// rule the same solution passes") and criterion 4 with `forbid: []` are proven in Node by
// src/verify/exercise.test.ts; here the always-on rules fire on an exercise whose `forbid` does
// not list them. Every attempt is the repository's starter, solution or tests.ts, read at test
// time, with one named edit; expected lines and columns are computed from those texts. `:test`
// goes through `runTest` (e2e/helpers/verify.ts), which waits until this run has shown
// `running` and then a verdict, so a previous verdict never satisfies a wait. Keyboard only;
// the seam is used to replace a file's text (`setDoc`) and to read the cursor, never to drive
// the Tests tab. No fixed sleeps.
import { expect, test, type Page } from '@playwright/test';
import type { FixtureLesson } from './helpers/content';
import {
  currentPath,
  cursor,
  ex,
  outputPane,
  press,
  runStatus,
  setDoc,
} from './helpers/editor';
import {
  caseRows,
  diagnosticRows,
  field,
  GROUP_LABELS,
  GROUPS,
  group,
  groupRows,
  gotoExercise,
  hitRows,
  openBuffer,
  readExerciseFile,
  readRows,
  rows,
  rowsUnder,
  runTest,
  selectedIndex,
  selectRow,
  testRow,
  testRows,
  testsTab,
  verdict,
  type RowData,
} from './helpers/verify';

interface Fixture {
  lesson: FixtureLesson;
  exercise: string;
}

const TYPE_CHALLENGE: Fixture = {
  lesson: '03-type-challenge',
  exercise: '01-describe-the-events',
};
const IMPLEMENT: Fixture = {
  lesson: '02-implement',
  exercise: '01-largest-shape',
};
const FIX: Fixture = { lesson: '01-fix', exercise: '01-handle-the-new-shape' };

const NOT_RUN_REASON = 'not run: fix the compile errors first';
const PASSED = 'Passed. :next opens the next exercise.';
const COMPILES_FAILED =
  'Failed: Compiles failed, so the other groups did not run.';
const UNUSED_DIRECTIVE = "Unused '@ts-expect-error' directive.";

const read = (fixture: Fixture, file: string): string =>
  readExerciseFile(fixture.lesson, fixture.exercise, file);

const open = (page: Page, fixture: Fixture): Promise<void> =>
  gotoExercise(page, fixture.lesson, fixture.exercise);

/** `text` with `from` replaced once; throws when `from` is not there, so an edit never no-ops. */
function replaceOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at === -1) throw new Error(`the fixture has no ${JSON.stringify(from)}`);
  return `${text.slice(0, at)}${to}${text.slice(at + from.length)}`;
}

/** The 1-based number of the first line containing `needle`. */
function lineOf(text: string, needle: string): number {
  const index = text.split('\n').findIndex((line) => line.includes(needle));
  if (index === -1) throw new Error(`no line has ${JSON.stringify(needle)}`);
  return index + 1;
}

/** The 0-based column of `needle` on the first line containing `lineNeedle`. */
function columnOf(text: string, lineNeedle: string, needle: string): number {
  const line = text.split('\n')[lineOf(text, lineNeedle) - 1] ?? '';
  const column = line.indexOf(needle);
  if (column === -1) throw new Error(`no ${JSON.stringify(needle)} there`);
  return column;
}

/** The names of the `test('name', ...)` calls in a tests.ts, in order. */
function testNames(text: string): string[] {
  return [...text.matchAll(/^test\('([^']+)'/gm)].map((m) => m[1] as string);
}

/** The exercise's `forbid` list from its exercise.yaml (a flow sequence). */
function forbidList(fixture: Fixture): string[] {
  const match = /^forbid:\s*\[(.*)\]\s*$/m.exec(read(fixture, 'exercise.yaml'));
  if (match === null) throw new Error('exercise.yaml has no forbid line');
  return (match[1] as string)
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');
}

function rowAt(all: RowData[], index: number): RowData {
  const row = all[index];
  if (row === undefined) throw new Error(`no row ${String(index)}`);
  return row;
}

/** The line number in a `file:line` or `file:line:column` location. */
function locLine(loc: string | undefined): number {
  return Number(/^[^:]+:(\d+)/.exec(loc ?? '')?.[1] ?? Number.NaN);
}

test.describe('§12 F7: for a type-challenge fixture, each cases element is its own case with pass or fail, and an unused @ts-expect-error fails its case', () => {
  test('the starter fails all four cases, each with its own diagnostic inside its own range; the solution passes all four', async ({
    page,
  }) => {
    const tests = read(TYPE_CHALLENGE, 'tests.ts');
    const firstElement = {
      from: lineOf(tests, 'Expect<'),
      to: lineOf(tests, '// exactly the three members'),
    };
    const secondElement = {
      from: firstElement.to + 1,
      to: lineOf(tests, '// narrowing by type finds the keydown'),
    };
    const clickDirective = lineOf(tests, '@ts-expect-error a click has no key');
    const hoverDirective = lineOf(tests, '@ts-expect-error hover is not');
    await open(page, TYPE_CHALLENGE);
    await runTest(page);

    await expect(verdict(page)).toHaveAttribute('data-verdict', 'failed');
    await expect(verdict(page)).toHaveText('Failed: Type cases.');
    await expect(testsTab(page)).toHaveText('Tests ✗');
    await expect(group(page, 'compiles')).toHaveAttribute(
      'data-status',
      'pass',
    );
    const typeCases = group(page, 'typeCases');
    await expect(typeCases).toHaveAttribute('data-status', 'fail');
    await expect(typeCases).toHaveAttribute('data-expanded', 'true');
    await expect(field(typeCases, 'summary')).toHaveText('0 of 4 cases pass');

    // The tuple's two elements and the two directive statements are four cases, in source
    // order, each row followed by the diagnostics that fall inside that case.
    const under = rowsUnder(await readRows(page), 'typeCases');
    expect(under.map((r) => r.row)).toEqual([
      'case',
      'diagnostic',
      'case',
      'diagnostic',
      'case',
      'diagnostic',
      'case',
      'diagnostic',
    ]);
    expect(
      under
        .filter((r) => r.row === 'case')
        .map((r) => [r.fields.name, r.status]),
    ).toEqual([
      ['exactly the three members', 'fail'],
      ['narrowing by type finds the keydown', 'fail'],
      ['case 3', 'fail'],
      ['case 4', 'fail'],
    ]);
    // Each tuple element fails on its own Equal, with the diagnostic inside its own range.
    for (const [index, range] of [
      [1, firstElement],
      [3, secondElement],
    ] as const) {
      const element = rowAt(under, index);
      expect(locLine(element.fields.loc)).toBeGreaterThanOrEqual(range.from);
      expect(locLine(element.fields.loc)).toBeLessThanOrEqual(range.to);
      expect(element.text, 'the element fails on its own Equal').toContain(
        'TS2344',
      );
    }
    // `unknown` accepts both objects, so both directives are unused: TS2578 on each one's line.
    for (const [index, line] of [
      [5, clickDirective],
      [7, hoverDirective],
    ] as const) {
      const diagnostic = rowAt(under, index);
      expect(diagnostic.fields.loc).toBe(`tests.ts:${String(line)}:1`);
      expect(diagnostic.fields.message).toBe(UNUSED_DIRECTIVE);
      expect(diagnostic.text).toContain('TS2578');
    }

    // The solution: four passes. A passed group starts collapsed; Enter opens it.
    await setDoc(page, read(TYPE_CHALLENGE, 'solution/index.ts'));
    await runTest(page);
    await expect(verdict(page)).toHaveAttribute('data-verdict', 'passed');
    await expect(verdict(page)).toHaveText(PASSED);
    await expect(testsTab(page)).toHaveText('Tests ✓');
    await expect(typeCases).toHaveAttribute('data-status', 'pass');
    await expect(field(typeCases, 'summary')).toHaveText('4 of 4 cases pass');
    await expect(typeCases).toHaveAttribute('data-expanded', 'false');
    await expect(caseRows(page)).toHaveCount(0);
    await ex(page, 'output');
    await expect(outputPane(page)).toBeFocused();
    await selectRow(page, typeCases);
    await press(page, '<CR>');
    await expect(typeCases).toHaveAttribute('data-expanded', 'true');
    await expect(caseRows(page).locator('[data-field="name"]')).toHaveText([
      'exactly the three members',
      'narrowing by type finds the keydown',
      'case 3',
      'case 4',
    ]);
    for (const row of await caseRows(page).all()) {
      await expect(row).toHaveAttribute('data-status', 'pass');
    }
    await expect(diagnosticRows(page)).toHaveCount(0);
  });

  test('an unused @ts-expect-error fails its own case and no other, and is not a compile error', async ({
    page,
  }) => {
    const tests = read(TYPE_CHALLENGE, 'tests.ts');
    const solution = read(TYPE_CHALLENGE, 'solution/index.ts');
    const hoverDirective = lineOf(tests, '@ts-expect-error hover is not');
    await open(page, TYPE_CHALLENGE);

    // A fourth member makes `hover` assignable, so case 4's directive goes unused. Case 3's
    // directive still has its error and passes. In the tuple, case 1 fails on its own Equal
    // (not on TS2578) while case 2, the element beside it, still passes.
    await setDoc(
      page,
      replaceOnce(
        solution,
        "| { type: 'scroll'; deltaY: number };",
        "| { type: 'scroll'; deltaY: number }\n  | { type: 'hover'; x: number; y: number };",
      ),
    );
    await runTest(page);
    await expect(verdict(page)).toHaveText('Failed: Type cases.');
    await expect(group(page, 'compiles')).toHaveAttribute(
      'data-status',
      'pass',
    );
    await expect(field(group(page, 'typeCases'), 'summary')).toHaveText(
      '2 of 4 cases pass',
    );
    let under = rowsUnder(await readRows(page), 'typeCases');
    expect(
      under.map((r) =>
        r.row === 'case'
          ? `case ${r.fields.name ?? ''}: ${r.status ?? ''}`
          : `diagnostic ${r.fields.loc ?? ''}`,
      ),
    ).toEqual([
      'case exactly the three members: fail',
      expect.stringMatching(/^diagnostic tests\.ts:\d+:\d+$/),
      'case narrowing by type finds the keydown: pass',
      'case case 3: pass',
      'case case 4: fail',
      `diagnostic tests.ts:${String(hoverDirective)}:1`,
    ]);
    expect(rowAt(under, 1).text).not.toContain('TS2578');
    expect(rowAt(under, 5).fields.message).toBe(UNUSED_DIRECTIVE);
    expect(rowAt(under, 5).text).toContain('TS2578');

    // The same with the solution untouched and the `hover` statement in tests.ts made valid:
    // case 4 is the only failure, and Compiles still passes.
    await setDoc(page, solution);
    await openBuffer(page, 'tests.ts');
    await setDoc(
      page,
      replaceOnce(
        tests,
        "const hover: UIEvent = { type: 'hover', x: 1, y: 2 };",
        "const hover: UIEvent = { type: 'scroll', deltaY: 1 };",
      ),
    );
    await runTest(page);
    await expect(verdict(page)).toHaveText('Failed: Type cases.');
    await expect(group(page, 'compiles')).toHaveAttribute(
      'data-status',
      'pass',
    );
    await expect(field(group(page, 'compiles'), 'summary')).toHaveText(
      'no errors',
    );
    await expect(field(group(page, 'typeCases'), 'summary')).toHaveText(
      '3 of 4 cases pass',
    );
    under = rowsUnder(await readRows(page), 'typeCases');
    expect(
      under.map((r) =>
        r.row === 'case'
          ? `case ${r.fields.name ?? ''}: ${r.status ?? ''}`
          : `diagnostic ${r.fields.loc ?? ''}: ${r.fields.message ?? ''}`,
      ),
    ).toEqual([
      'case exactly the three members: pass',
      'case narrowing by type finds the keydown: pass',
      'case case 3: pass',
      'case case 4: fail',
      `diagnostic tests.ts:${String(hoverDirective)}:1: ${UNUSED_DIRECTIVE}`,
    ]);
  });
});

test.describe('§12 F7: for an implement fixture, every runtime test reports pass or fail with expected and actual; a 1 s hang reports timeout', () => {
  test('with area of a square returning 0, each of the seven tests reports pass or fail, and the failure shows expected 9 and actual 0', async ({
    page,
  }) => {
    const names = testNames(read(IMPLEMENT, 'tests.ts'));
    expect(names).toHaveLength(7);
    await open(page, IMPLEMENT);
    await setDoc(
      page,
      replaceOnce(
        read(IMPLEMENT, 'solution/index.ts'),
        'return shape.side ** 2;',
        'return 0 * shape.side;',
      ),
    );
    await runTest(page);

    await expect(verdict(page)).toHaveText('Failed: Runtime tests.');
    const runtime = group(page, 'runtime');
    await expect(runtime).toHaveAttribute('data-status', 'fail');
    await expect(runtime).toHaveAttribute('data-expanded', 'true');
    await expect(field(runtime, 'summary')).toHaveText('6 of 7 tests pass');
    const under = rowsUnder(await readRows(page), 'runtime');
    expect(under.map((r) => r.row)).toEqual(names.map(() => 'test'));
    expect(under.map((r) => [r.fields.name, r.status])).toEqual(
      names.map((name) => [
        name,
        name === 'area of a square' ? 'fail' : 'pass',
      ]),
    );
    for (const row of under) {
      expect(row.fields.ms, `${row.fields.name ?? ''} has a time`).toMatch(
        /^\d+ ms$/,
      );
      if (row.status === 'pass') {
        expect(row.fields.expected).toBeUndefined();
        expect(row.fields.actual).toBeUndefined();
      }
    }
    const square = testRow(page, 'area of a square');
    await expect(field(square, 'status')).toHaveText('fail');
    await expect(field(square, 'expected')).toHaveText('expected: 9');
    await expect(field(square, 'actual')).toHaveText('actual: 0');
    await expect(field(square, 'message')).not.toBeEmpty();
  });

  test('a test that never settles reports timeout after 1 s, the test after it still reports, and rows stream in while the verdict is running', async ({
    page,
  }) => {
    const tests = read(IMPLEMENT, 'tests.ts');
    const names = testNames(tests);
    await open(page, IMPLEMENT);
    await setDoc(page, read(IMPLEMENT, 'solution/index.ts'));
    await openBuffer(page, 'tests.ts');
    await setDoc(
      page,
      `${tests}\ntest('hangs', () => new Promise<void>(() => {}));\n\ntest('after the hang', () => {\n  expect(1 + 1).toBe(2);\n});\n`,
    );
    const seen = await runTest(page);

    // What the tab showed during the run (recorded on every change): the seven results while
    // `hangs` was still pending, then `hangs` too, all under a `running` verdict.
    expect(seen, 'seven rows while the hang ran').toContainEqual({
      verdict: 'running',
      tests: 7,
      runtimeStatus: 'running',
    });
    expect(
      seen,
      'the timeout row before the last test finished',
    ).toContainEqual({
      verdict: 'running',
      tests: 8,
      runtimeStatus: 'running',
    });
    expect(seen.at(-1)).toEqual({
      verdict: 'failed',
      tests: 9,
      runtimeStatus: 'fail',
    });

    await expect(verdict(page)).toHaveText('Failed: Runtime tests.');
    await expect(field(group(page, 'runtime'), 'summary')).toHaveText(
      '8 of 9 tests pass',
    );
    await expect(testRows(page).locator('[data-field="name"]')).toHaveText([
      ...names,
      'hangs',
      'after the hang',
    ]);
    const hangs = testRow(page, 'hangs');
    await expect(hangs).toHaveAttribute('data-status', 'timeout');
    await expect(field(hangs, 'status')).toHaveText('timeout');
    await expect(field(hangs, 'message')).toHaveText('timed out after 1000 ms');
    const ms = Number(
      /^(\d+) ms$/.exec(await field(hangs, 'ms').innerText())?.[1],
    );
    expect(ms).toBeGreaterThanOrEqual(1000);
    await expect(testRow(page, 'after the hang')).toHaveAttribute(
      'data-status',
      'pass',
    );
    // The per-test timeout ended the hang, not the run's 5 s deadline.
    await expect(runStatus(page)).toHaveAttribute('data-status', 'done');
  });
});

test.describe('§12 F7: forbid: [explicit-any] fails a solution with any and names the line; without the rule the same solution passes', () => {
  // The second half needs the same solution with the rule off: src/verify/exercise.test.ts.
  test('the implement solution with `let best: any` fails Rules only, with an explicit-any hit on that line, and Enter goes there', async ({
    page,
  }) => {
    expect(forbidList(IMPLEMENT)).toContain('explicit-any');
    const solution = replaceOnce(
      read(IMPLEMENT, 'solution/index.ts'),
      'let best: Shape | undefined;',
      'let best: any;',
    );
    const line = lineOf(solution, 'let best: any;');
    await open(page, IMPLEMENT);
    await setDoc(page, solution);
    await runTest(page);

    await expect(verdict(page)).toHaveText('Failed: Rules.');
    for (const name of ['compiles', 'typeCases', 'runtime'] as const) {
      await expect(group(page, name)).toHaveAttribute('data-status', 'pass');
    }
    await expect(field(group(page, 'runtime'), 'summary')).toHaveText(
      '7 of 7 tests pass',
    );
    const rules = group(page, 'rules');
    await expect(rules).toHaveAttribute('data-status', 'fail');
    await expect(rules).toHaveAttribute('data-expanded', 'true');
    await expect(field(rules, 'summary')).toHaveText('1 forbidden construct');
    await expect(hitRows(page)).toHaveCount(1);
    const hit = hitRows(page).first();
    await expect(field(hit, 'loc')).toHaveText(`index.ts:${String(line)}`);
    await expect(field(hit, 'rule')).toHaveText('explicit-any');

    // Enter on the hit, from tests.ts: the editor opens index.ts on the `any`.
    await openBuffer(page, 'tests.ts');
    await ex(page, 'output');
    await selectRow(page, hit);
    await press(page, '<CR>');
    await expect(page.locator('.cm-content')).toBeFocused();
    expect(await currentPath(page)).toBe('/index.ts');
    expect(await cursor(page)).toEqual([
      line,
      columnOf(solution, 'let best: any;', 'any'),
    ]);
  });
});

test.describe('§12 F7: a @ts-ignore, @ts-nocheck or @ts-expect-error in a non-test user file always fails, and so does eval', () => {
  const VARIANTS: {
    name: string;
    edit: (solution: string) => string;
    rule: 'ts-directive' | 'eval';
    at: string;
  }[] = [
    {
      name: '// @ts-ignore on its own line inside largest',
      edit: (s) =>
        replaceOnce(
          s,
          '  let best: Shape | undefined;',
          '  // @ts-ignore\n  let best: Shape | undefined;',
        ),
      rule: 'ts-directive',
      at: '// @ts-ignore',
    },
    {
      name: '// @ts-nocheck at the top of index.ts',
      edit: (s) => `// @ts-nocheck\n${s}`,
      rule: 'ts-directive',
      at: '// @ts-nocheck',
    },
    {
      name: '// @ts-expect-error over a real error, so the file still compiles',
      edit: (s) =>
        `${s}\n// @ts-expect-error a string is not a number\nexport const n: number = 'x';\n`,
      rule: 'ts-directive',
      at: '// @ts-expect-error',
    },
    {
      name: "export const one = eval('1');",
      edit: (s) => `${s}\nexport const one = eval('1');\n`,
      rule: 'eval',
      at: "eval('1')",
    },
  ];

  for (const variant of VARIANTS) {
    test(`${variant.name} fails Rules with a ${variant.rule} hit, though the exercise does not forbid it`, async ({
      page,
    }) => {
      expect(forbidList(IMPLEMENT)).not.toContain(variant.rule);
      const text = variant.edit(read(IMPLEMENT, 'solution/index.ts'));
      await open(page, IMPLEMENT);
      await setDoc(page, text);
      await runTest(page);

      await expect(verdict(page)).toHaveAttribute('data-verdict', 'failed');
      await expect(group(page, 'compiles')).toHaveAttribute(
        'data-status',
        'pass',
      );
      await expect(group(page, 'rules')).toHaveAttribute('data-status', 'fail');
      await expect(hitRows(page)).toHaveCount(1);
      const hit = hitRows(page).first();
      await expect(field(hit, 'rule')).toHaveText(variant.rule);
      await expect(field(hit, 'loc')).toHaveText(
        `index.ts:${String(lineOf(text, variant.at))}`,
      );
    });
  }
});

test.describe('§12 F7: a fix exercise passes only when every file has zero diagnostics', () => {
  test('the starter fails Compiles, the solution passes, and the solution with an error in tests.ts fails Compiles again', async ({
    page,
  }) => {
    await open(page, FIX);
    await runTest(page);
    await expect(verdict(page)).toHaveAttribute('data-verdict', 'failed');
    await expect(verdict(page)).toHaveText(COMPILES_FAILED);
    await expect(group(page, 'compiles')).toHaveAttribute(
      'data-status',
      'fail',
    );

    // The alias `:t` (§4) is the same command on the lesson page.
    await setDoc(page, read(FIX, 'solution/index.ts'));
    await runTest(page, { command: 't' });
    await expect(verdict(page)).toHaveAttribute('data-verdict', 'passed');
    await expect(verdict(page)).toHaveText(PASSED);
    const count = String(testNames(read(FIX, 'tests.ts')).length);
    for (const name of GROUPS) {
      await expect(group(page, name)).toHaveAttribute('data-status', 'pass');
    }
    await expect(groupRows(page).locator('[data-field="summary"]')).toHaveText([
      'no errors',
      'none in this exercise',
      `${count} of ${count} tests pass`,
      'no forbidden constructs',
    ]);

    // index.ts stays the solution; tests.ts gets one error outside any case.
    const tests = `${read(FIX, 'tests.ts')}\nconst count: number = 'three';\n`;
    await openBuffer(page, 'tests.ts');
    await setDoc(page, tests);
    await runTest(page);
    await expect(verdict(page)).toHaveText(COMPILES_FAILED);
    const compiles = group(page, 'compiles');
    await expect(compiles).toHaveAttribute('data-status', 'fail');
    await expect(field(compiles, 'summary')).toHaveText('1 error');
    await expect(diagnosticRows(page)).toHaveCount(1);
    const diagnostic = diagnosticRows(page).first();
    await expect(field(diagnostic, 'loc')).toHaveText(
      `tests.ts:${String(lineOf(tests, 'const count'))}:${String(columnOf(tests, 'const count', 'count') + 1)}`,
    );
    await expect(field(diagnostic, 'message')).toHaveText(
      /^tests\.ts does not compile against your code; see its first diagnostic: /,
    );
  });
});

test.describe('§12 F7: Compiles failing stops the other groups, with the reason shown', () => {
  test('the fix starter with a forbidden cast fails Compiles alone; the other three groups say why they did not run, and run once it compiles', async ({
    page,
  }) => {
    expect(forbidList(FIX)).toContain('as-unknown-as');
    const cast = '\nexport const n = 1 as unknown as number;\n';
    const starter = `${read(FIX, 'starter/index.ts')}${cast}`;
    const errorLine = lineOf(starter, 'const unreachable: never = shape;');
    const errorColumn =
      columnOf(starter, 'const unreachable: never', 'unreachable') + 1;
    await open(page, FIX);
    await setDoc(page, starter);
    const seen = await runTest(page);

    await expect(verdict(page)).toHaveAttribute('data-verdict', 'failed');
    await expect(verdict(page)).toHaveText(COMPILES_FAILED);
    await expect(testsTab(page)).toHaveText('Tests ✗');
    const compiles = group(page, 'compiles');
    await expect(compiles).toHaveAttribute('data-status', 'fail');
    await expect(compiles).toHaveAttribute('data-expanded', 'true');
    await expect(field(compiles, 'summary')).toHaveText('1 error');
    const diagnostic = diagnosticRows(page).first();
    await expect(field(diagnostic, 'loc')).toHaveText(
      `index.ts:${String(errorLine)}:${String(errorColumn)}`,
    );
    await expect(field(diagnostic, 'message')).toContainText(
      "is not assignable to type 'never'",
    );
    for (const name of ['typeCases', 'runtime', 'rules'] as const) {
      const row = group(page, name);
      await expect(row).toHaveAttribute('data-status', 'not-run');
      await expect(row).toHaveAttribute('data-expanded', 'false');
      await expect(field(row, 'summary')).toHaveText(NOT_RUN_REASON);
    }
    // Nothing but the four groups and the one diagnostic: the cast's hit and the triangle
    // test's failure are not reported, and the runtime never started.
    expect((await readRows(page)).map((r) => r.row)).toEqual([
      'group',
      'diagnostic',
      'group',
      'group',
      'group',
    ]);
    expect(seen.some((r) => r.runtimeStatus === 'running' || r.tests > 0)).toBe(
      false,
    );

    // Once it compiles, the same cast is a Rules failure and the tests run.
    await setDoc(page, `${read(FIX, 'solution/index.ts')}${cast}`);
    await runTest(page);
    await expect(verdict(page)).toHaveText('Failed: Rules.');
    await expect(field(group(page, 'runtime'), 'summary')).toHaveText(
      '3 of 3 tests pass',
    );
    await expect(field(hitRows(page).first(), 'rule')).toHaveText(
      'as-unknown-as',
    );
  });
});

test.describe('§12 F7: the Tests tab shows the four groups; j/k move, Enter expands or jumps to the source', () => {
  test('four groups in order; j/k move the selection; Enter collapses and expands a group, does nothing on a passed test, and jumps to a failed test and a rule hit; Esc returns to the editor', async ({
    page,
  }) => {
    const tests = read(IMPLEMENT, 'tests.ts');
    const solution = replaceOnce(
      replaceOnce(
        read(IMPLEMENT, 'solution/index.ts'),
        'return shape.side ** 2;',
        'return 0 * shape.side;',
      ),
      'let best: Shape | undefined;',
      'let best: any;',
    );
    await open(page, IMPLEMENT);
    await setDoc(page, solution);
    await runTest(page);

    await expect(groupRows(page)).toHaveCount(4);
    for (const [index, name] of GROUPS.entries()) {
      await expect(groupRows(page).nth(index)).toHaveAttribute(
        'data-group',
        name,
      );
      await expect(field(groupRows(page).nth(index), 'label')).toHaveText(
        GROUP_LABELS[name],
      );
    }
    await expect(verdict(page)).toHaveText('Failed: Runtime tests, Rules.');

    // `:output` focuses the pane; the selection starts on the first row.
    await expect(page.locator('.cm-content')).toBeFocused();
    await ex(page, 'output');
    await expect(outputPane(page)).toBeFocused();
    await expect(rows(page).first()).toHaveAttribute('data-selected', 'true');
    for (const [key, expected] of [
      ['j', 1],
      ['j', 2],
      ['k', 1],
      ['j', 2],
    ] as const) {
      await press(page, key);
      await expect
        .poll(() => selectedIndex(page), `after ${key}`)
        .toBe(expected);
    }
    await expect(outputPane(page)).toBeFocused();

    // Enter on the failed Runtime group (open by default) closes it and opens it again.
    const runtime = group(page, 'runtime');
    await expect(runtime).toHaveAttribute('data-selected', 'true');
    await expect(runtime).toHaveAttribute('data-expanded', 'true');
    await expect(testRows(page)).toHaveCount(7);
    await press(page, '<CR>');
    await expect(runtime).toHaveAttribute('data-expanded', 'false');
    await expect(testRows(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(5);
    await press(page, '<CR>');
    await expect(runtime).toHaveAttribute('data-expanded', 'true');
    await expect(testRows(page)).toHaveCount(7);
    await expect(outputPane(page)).toBeFocused();

    // Enter on a passed test has nowhere to go: focus and the editor stay put.
    const before = await cursor(page);
    await selectRow(page, testRow(page, 'area of a circle'));
    await press(page, '<CR>');
    await expect(outputPane(page)).toBeFocused();
    expect(await currentPath(page)).toBe('/index.ts');
    expect(await cursor(page)).toEqual(before);

    // Enter on the failed test: tests.ts, on its `test('area of a square'` line.
    await selectRow(page, testRow(page, 'area of a square'));
    await press(page, '<CR>');
    await expect(page.locator('.cm-content')).toBeFocused();
    expect(await currentPath(page)).toBe('/tests.ts');
    expect(await cursor(page)).toEqual([
      lineOf(tests, "test('area of a square'"),
      columnOf(tests, "test('area of a square'", "test('area of a square'"),
    ]);

    // Back in the pane the selection is where it was; Enter on the rule hit goes to index.ts.
    await ex(page, 'output');
    await expect(outputPane(page)).toBeFocused();
    await expect(testRow(page, 'area of a square')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await selectRow(page, hitRows(page).first());
    await press(page, '<CR>');
    await expect(page.locator('.cm-content')).toBeFocused();
    expect(await currentPath(page)).toBe('/index.ts');
    expect(await cursor(page)).toEqual([
      lineOf(solution, 'let best: any;'),
      columnOf(solution, 'let best: any;', 'any'),
    ]);

    // Esc from the pane returns to the editor.
    await ex(page, 'output');
    await expect(outputPane(page)).toBeFocused();
    await press(page, '<Esc>');
    await expect(page.locator('.cm-content')).toBeFocused();
  });

  test('Enter on a Compiles diagnostic moves the cursor to its file, line and column', async ({
    page,
  }) => {
    const starter = read(FIX, 'starter/index.ts');
    await open(page, FIX);
    await openBuffer(page, 'tests.ts');
    await runTest(page);
    await expect(verdict(page)).toHaveText(COMPILES_FAILED);

    await ex(page, 'output');
    await expect(outputPane(page)).toBeFocused();
    await expect(group(page, 'compiles')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await press(page, 'j');
    const diagnostic = diagnosticRows(page).first();
    await expect(diagnostic).toHaveAttribute('data-selected', 'true');
    await press(page, '<CR>');
    await expect(page.locator('.cm-content')).toBeFocused();
    expect(await currentPath(page)).toBe('/index.ts');
    expect(await cursor(page)).toEqual([
      lineOf(starter, 'const unreachable: never = shape;'),
      columnOf(starter, 'const unreachable: never', 'unreachable'),
    ]);
  });

  test('Enter on a failed type case and on its diagnostic moves the cursor to the case in tests.ts', async ({
    page,
  }) => {
    const tests = read(TYPE_CHALLENGE, 'tests.ts');
    const hoverDirective = lineOf(tests, '@ts-expect-error hover is not');
    await open(page, TYPE_CHALLENGE);
    await runTest(page);
    await expect(caseRows(page)).toHaveCount(4);

    for (const row of [
      caseRows(page).nth(3),
      diagnosticRows(page).nth(3),
    ] as const) {
      await ex(page, 'output');
      await expect(outputPane(page)).toBeFocused();
      await selectRow(page, row);
      await press(page, '<CR>');
      await expect(page.locator('.cm-content')).toBeFocused();
      expect(await currentPath(page)).toBe('/tests.ts');
      expect(await cursor(page)).toEqual([hoverDirective, 0]);
      await ex(page, 'b index.ts');
      await expect.poll(() => currentPath(page)).toBe('/index.ts');
    }
  });
});

// Two glitches the first pass of this spec found (neither breaks a criterion): a second `:test`
// listed the previous run's runtime results as live until its own run started, and an exercise
// without runtime tests showed Runtime tests as `running` for a moment.
test.describe('the Tests tab shows only the current run', () => {
  test("a second :test never lists the previous run's runtime results while it runs", async ({
    page,
  }) => {
    await open(page, IMPLEMENT);
    await setDoc(page, read(IMPLEMENT, 'solution/index.ts'));
    const first = await runTest(page);
    expect(first.at(-1)).toMatchObject({ verdict: 'passed', tests: 0 });
    // Expand Runtime tests so its seven rows are on screen when the second :test starts.
    await ex(page, 'output');
    await selectRow(page, group(page, 'runtime'));
    await press(page, '<CR>');
    await expect(testRows(page)).toHaveCount(7);
    await press(page, '<Esc>');
    await expect(page.locator('.cm-content')).toBeFocused();

    const second = await runTest(page);
    const running = second.filter((record) => record.verdict === 'running');
    expect(running.length).toBeGreaterThan(0);
    expect(running[0]?.tests, 'the first running state lists no tests').toBe(0);
    const counts = running.map((record) => record.tests);
    expect(
      counts.every((count, i) => i === 0 || count >= (counts[i - 1] ?? 0)),
      `runtime rows only grow while running: ${counts.join(', ')}`,
    ).toBe(true);
    expect(second.at(-1)?.verdict).toBe('passed');
  });

  test('an exercise without runtime tests never shows Runtime tests running', async ({
    page,
  }) => {
    await open(page, TYPE_CHALLENGE);
    await setDoc(page, read(TYPE_CHALLENGE, 'solution/index.ts'));
    const records = await runTest(page);
    expect(records.map((record) => record.runtimeStatus)).not.toContain(
      'running',
    );
    await expect(verdict(page)).toHaveText(PASSED);
    await expect(field(group(page, 'runtime'), 'summary')).toHaveText(
      'none in this exercise',
    );
  });
});

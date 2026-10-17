// §12 F3: "Every P item in the §4 checklist passes in Chrome; every W item has its mapping or
// definition applied by default." The Prep checklist (spike/vim/checklist.spec.ts) run against
// the real editor on /repl: one test per §4 row, with the spike's assertions, and nothing
// applied by hand (the W definitions and the shipped vimrc are on by default; a test that
// needed `apply(...)` in the spike proves the default here). The documented gaps (`it at`,
// insert-mode Ctrl-w) assert the documented behaviour. The `"+` and `"*` rows are in
// editor-clipboard.spec.ts. Keyboard only; waits are expect polls, never sleeps.
import { expect, test } from '@playwright/test';
import {
  cursor,
  ex,
  gotoRepl,
  lines,
  messages,
  press,
  setDoc,
  snapshot,
  type,
  waitForCompilerReady,
} from './helpers/editor';

test.beforeEach(async ({ page }) => {
  await gotoRepl(page);
});

test.describe('Modes (P)', () => {
  test('normal mode at start', async ({ page }) => {
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test('insert: i, typing, Esc back to normal one column left', async ({
    page,
  }) => {
    await setDoc(page, 'abc');
    await press(page, 'i');
    expect((await snapshot(page)).mode).toBe('insert');
    await type(page, 'XY');
    await press(page, '<Esc>');
    const s = await snapshot(page);
    expect(s.doc).toBe('XYabc');
    expect(s.mode).toBe('normal');
    expect([s.line, s.col]).toEqual([1, 1]);
  });

  test('replace: R types over, Esc', async ({ page }) => {
    await setDoc(page, 'abcdef');
    await press(page, 'R');
    expect((await snapshot(page)).mode).toBe('replace');
    await type(page, 'XY');
    await press(page, '<Esc>');
    const s = await snapshot(page);
    expect(s.doc).toBe('XYcdef');
    expect(s.mode).toBe('normal');
  });

  test('visual: v then e selects, d deletes the selection', async ({
    page,
  }) => {
    await setDoc(page, 'hello world');
    await press(page, 've');
    const s = await snapshot(page);
    expect(s.mode).toBe('visual');
    expect([s.anchorCol, s.col]).toEqual([0, 5]);
    await press(page, 'd');
    expect((await snapshot(page)).doc).toBe(' world');
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test('visual-line: V j d deletes two lines', async ({ page }) => {
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, 'Vj');
    expect((await snapshot(page)).mode).toBe('visual-line');
    await press(page, 'd');
    expect((await snapshot(page)).doc).toBe('three');
  });

  test('visual-block: Ctrl-v j j d deletes a column (allowMultipleSelections is on)', async ({
    page,
  }) => {
    await setDoc(page, lines('abc', 'def', 'ghi'));
    await press(page, '<C-v>jj');
    expect((await snapshot(page)).mode).toBe('visual-block');
    await press(page, 'd');
    expect((await snapshot(page)).doc).toBe(lines('bc', 'ef', 'hi'));
  });

  test('visual-block: Ctrl-v j I inserts on every line', async ({ page }) => {
    await setDoc(page, lines('abc', 'def'));
    await press(page, '<C-v>jI');
    await type(page, '# ');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe(lines('# abc', '# def'));
  });
});

const MOTION_DOC = lines(
  'alpha beta gamma delta', // 1
  '  indented line here', // 2
  'foo(bar[baz{qux}])', // 3
  '', // 4
  'second paragraph starts', // 5
  'with two lines', // 6
  '', // 7
  'third paragraph', // 8
);
const LONG_DOC = Array.from({ length: 80 }, (_, i) => `line ${i + 1}`).join(
  '\n',
);

test.describe('Motions (P)', () => {
  test('h j k l', async ({ page }) => {
    await setDoc(page, MOTION_DOC, { line: 1, col: 5 });
    await press(page, 'l');
    expect(await cursor(page)).toEqual([1, 6]);
    await press(page, 'h');
    expect(await cursor(page)).toEqual([1, 5]);
    await press(page, 'j');
    expect(await cursor(page)).toEqual([2, 5]);
    await press(page, 'k');
    expect(await cursor(page)).toEqual([1, 5]);
  });

  test('w b e ge', async ({ page }) => {
    await setDoc(page, MOTION_DOC);
    await press(page, 'w');
    expect(await cursor(page)).toEqual([1, 6]);
    await press(page, 'w');
    expect(await cursor(page)).toEqual([1, 11]);
    await press(page, 'b');
    expect(await cursor(page)).toEqual([1, 6]);
    await press(page, 'e');
    expect(await cursor(page)).toEqual([1, 9]);
    await press(page, 'ge');
    expect(await cursor(page)).toEqual([1, 4]);
  });

  test('W B E treat punctuation as part of the word', async ({ page }) => {
    await setDoc(page, 'a-b c.d e');
    await press(page, 'W');
    expect(await cursor(page)).toEqual([1, 4]);
    await press(page, 'E');
    expect(await cursor(page)).toEqual([1, 6]);
    await press(page, 'B');
    expect(await cursor(page)).toEqual([1, 4]);
  });

  test('0 ^ $', async ({ page }) => {
    await setDoc(page, MOTION_DOC, { line: 2, col: 10 });
    await press(page, '0');
    expect(await cursor(page)).toEqual([2, 0]);
    await press(page, '^');
    expect(await cursor(page)).toEqual([2, 2]);
    await press(page, '$');
    expect(await cursor(page)).toEqual([2, 19]);
  });

  test('gg G', async ({ page }) => {
    await setDoc(page, MOTION_DOC, { line: 3, col: 2 });
    await press(page, 'G');
    expect(await cursor(page)).toEqual([8, 0]);
    await press(page, 'gg');
    expect(await cursor(page)).toEqual([1, 0]);
  });

  test('{ } move by paragraph', async ({ page }) => {
    await setDoc(page, MOTION_DOC);
    await press(page, '}');
    expect(await cursor(page)).toEqual([4, 0]);
    await press(page, '}');
    expect(await cursor(page)).toEqual([7, 0]);
    await press(page, '{');
    expect(await cursor(page)).toEqual([4, 0]);
  });

  test('% jumps between matching brackets', async ({ page }) => {
    await setDoc(page, MOTION_DOC, { line: 3, col: 3 });
    await press(page, '%');
    expect(await cursor(page)).toEqual([3, 17]);
    await press(page, '%');
    expect(await cursor(page)).toEqual([3, 3]);
    await setDoc(page, MOTION_DOC, { line: 3, col: 7 });
    await press(page, '%');
    expect(await cursor(page)).toEqual([3, 16]);
  });

  test('f t F T ; ,', async ({ page }) => {
    await setDoc(page, MOTION_DOC);
    await press(page, 'fa');
    expect(await cursor(page)).toEqual([1, 4]);
    await press(page, ';');
    expect(await cursor(page)).toEqual([1, 9]);
    await press(page, ',');
    expect(await cursor(page)).toEqual([1, 4]);
    await press(page, 'ta');
    expect(await cursor(page)).toEqual([1, 8]);
    await press(page, 'Fa');
    expect(await cursor(page)).toEqual([1, 4]);
    await press(page, 'Ta');
    expect(await cursor(page)).toEqual([1, 1]);
  });

  // The spike's editor had a fixed height; here the screen is what fits in the /repl editor,
  // so the bounds come from the visible line count instead of fixed numbers.
  test('H M L move within the visible screen', async ({ page }) => {
    await setDoc(page, LONG_DOC);
    const { visibleLines } = await snapshot(page);
    expect(visibleLines).toBeGreaterThan(8);
    await press(page, 'L');
    const bottom = await snapshot(page);
    expect(bottom.line).toBeGreaterThan(8);
    expect(bottom.line).toBeLessThanOrEqual(visibleLines + 1);
    expect(
      bottom.scrollTop,
      'L stays on the current screen (no line scrolled in)',
    ).toBeLessThan(bottom.lineHeight);
    await press(page, 'M');
    const middle = (await snapshot(page)).line;
    expect(middle).toBeGreaterThan(1);
    expect(middle).toBeLessThan(bottom.line);
    await press(page, 'H');
    expect(await cursor(page)).toEqual([1, 0]);
  });

  test('Ctrl-d Ctrl-u Ctrl-f Ctrl-b scroll by half and full pages', async ({
    page,
  }) => {
    await setDoc(page, LONG_DOC);
    const { visibleLines } = await snapshot(page);
    await press(page, '<C-d>');
    const half = (await snapshot(page)).line;
    expect(half).toBeGreaterThan(4);
    expect(half).toBeLessThanOrEqual(visibleLines);
    await expect
      .poll(async () => (await snapshot(page)).scrollTop)
      .toBeGreaterThan(0);
    await press(page, '<C-u>');
    expect(await cursor(page)).toEqual([1, 0]);
    await press(page, '<C-f>');
    expect((await snapshot(page)).line).toBeGreaterThan(10);
    await expect
      .poll(async () => (await snapshot(page)).scrollTop)
      .toBeGreaterThan(0);
    await press(page, '<C-b>');
    expect((await snapshot(page)).line).toBeLessThan(5);
  });

  test('counts: 3w 2j 5l 2k', async ({ page }) => {
    await setDoc(page, MOTION_DOC);
    await press(page, '3w');
    expect(await cursor(page)).toEqual([1, 17]);
    await press(page, '2j');
    expect(await cursor(page)).toEqual([3, 17]);
    await press(page, '0');
    await press(page, '5l');
    expect(await cursor(page)).toEqual([3, 5]);
    await press(page, '2k');
    expect(await cursor(page)).toEqual([1, 5]);
  });
});

test.describe('Operators (P)', () => {
  test('d with motions and counts: dw d2w 2dw d3l', async ({ page }) => {
    await setDoc(page, 'alpha beta gamma delta');
    await press(page, 'dw');
    expect((await snapshot(page)).doc).toBe('beta gamma delta');
    await press(page, 'd2w');
    expect((await snapshot(page)).doc).toBe('delta');
    await setDoc(page, 'a b c d e');
    await press(page, '2dw');
    expect((await snapshot(page)).doc).toBe('c d e');
    await press(page, 'd3l');
    expect((await snapshot(page)).doc).toBe(' e');
  });

  test('c with a motion: cw types over a word', async ({ page }) => {
    await setDoc(page, 'alpha beta');
    await press(page, 'cw');
    await type(page, 'X');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe('X beta');
  });

  test('y with a motion and p: yw then p', async ({ page }) => {
    await setDoc(page, 'alpha beta');
    await press(page, 'yw$p');
    expect((await snapshot(page)).doc).toBe('alpha betaalpha ');
  });

  test('> and < with motions and counts: >j <j 2>>', async ({ page }) => {
    await setDoc(page, lines('a', 'b', 'c'));
    await press(page, '>j');
    expect((await snapshot(page)).doc).toBe(lines('  a', '  b', 'c'));
    await press(page, '<j');
    expect((await snapshot(page)).doc).toBe(lines('a', 'b', 'c'));
    await press(page, '2>>');
    expect((await snapshot(page)).doc).toBe(lines('  a', '  b', 'c'));
  });

  test('= reindents through the language: == on a misindented line', async ({
    page,
  }) => {
    await setDoc(page, lines('function f() {', 'return 1;', '}'), {
      line: 2,
      col: 0,
    });
    await press(page, '==');
    expect((await snapshot(page)).doc).toBe(
      lines('function f() {', '  return 1;', '}'),
    );
  });

  test('g~ gu gU with motions', async ({ page }) => {
    await setDoc(page, 'hello World');
    await press(page, 'g~w');
    expect((await snapshot(page)).doc).toBe('HELLO World');
    await press(page, 'guw');
    expect((await snapshot(page)).doc).toBe('hello World');
    await press(page, 'gU$');
    expect((await snapshot(page)).doc).toBe('HELLO WORLD');
  });

  test('dd cc yy with counts: 2dd cc yyp', async ({ page }) => {
    await setDoc(page, lines('one', 'two', 'three', 'four'));
    await press(page, '2dd');
    expect((await snapshot(page)).doc).toBe(lines('three', 'four'));
    await press(page, 'cc');
    await type(page, 'X');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe(lines('X', 'four'));
    await press(page, 'yyp');
    expect((await snapshot(page)).doc).toBe(lines('X', 'X', 'four'));
  });

  test('D C Y', async ({ page }) => {
    await setDoc(page, 'alpha beta', { line: 1, col: 5 });
    await press(page, 'D');
    expect((await snapshot(page)).doc).toBe('alpha');
    await press(page, 'C');
    await type(page, 'Z');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe('alphZ');
    await setDoc(page, lines('one', 'two'));
    await press(page, 'Yp');
    expect((await snapshot(page)).doc).toBe(lines('one', 'one', 'two'));
  });

  test('x X s S r J with counts', async ({ page }) => {
    await setDoc(page, 'abcdef', { line: 1, col: 2 });
    await press(page, 'x');
    expect((await snapshot(page)).doc).toBe('abdef');
    await press(page, 'X');
    expect((await snapshot(page)).doc).toBe('adef');
    await press(page, '2x');
    expect((await snapshot(page)).doc).toBe('af');
    await press(page, 's');
    await type(page, 'Q');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe('aQ');
    await press(page, 'S');
    await type(page, 'new');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe('new');
    await press(page, '0rN');
    expect((await snapshot(page)).doc).toBe('New');
    await setDoc(page, lines('a', 'b', 'c', 'd'));
    await press(page, 'J');
    expect((await snapshot(page)).doc).toBe(lines('a b', 'c', 'd'));
    await press(page, '3J');
    expect((await snapshot(page)).doc).toBe('a b c d');
  });
});

test.describe('Text objects (P; it at W)', () => {
  test('iw aw', async ({ page }) => {
    await setDoc(page, 'alpha beta gamma', { line: 1, col: 7 });
    await press(page, 'diw');
    expect((await snapshot(page)).doc).toBe('alpha  gamma');
    await setDoc(page, 'alpha beta gamma', { line: 1, col: 7 });
    await press(page, 'daw');
    expect((await snapshot(page)).doc).toBe('alpha gamma');
  });

  test('iW aW', async ({ page }) => {
    await setDoc(page, 'a-b c.d e', { line: 1, col: 5 });
    await press(page, 'diW');
    expect((await snapshot(page)).doc).toBe('a-b  e');
    await setDoc(page, 'a-b c.d e', { line: 1, col: 5 });
    await press(page, 'daW');
    expect((await snapshot(page)).doc).toBe('a-b e');
  });

  test('is as', async ({ page }) => {
    await setDoc(page, 'One two. Three four. Five six.', { line: 1, col: 12 });
    await press(page, 'dis');
    let doc = (await snapshot(page)).doc;
    expect(doc).not.toContain('Three four.');
    expect(doc).toContain('One two.');
    expect(doc).toContain('Five six.');
    await setDoc(page, 'One two. Three four. Five six.', { line: 1, col: 12 });
    await press(page, 'das');
    doc = (await snapshot(page)).doc;
    expect(doc).toBe('One two. Five six.');
  });

  test('ip ap', async ({ page }) => {
    const doc = lines('p1a', 'p1b', '', 'p2a', 'p2b', '', 'p3');
    await setDoc(page, doc, { line: 4, col: 0 });
    await press(page, 'dip');
    expect((await snapshot(page)).doc).toBe(lines('p1a', 'p1b', '', '', 'p3'));
    await setDoc(page, doc, { line: 4, col: 0 });
    await press(page, 'dap');
    expect((await snapshot(page)).doc).toBe(lines('p1a', 'p1b', '', 'p3'));
  });

  test('brackets ( [ { < with i and a', async ({ page }) => {
    await setDoc(page, 'f(a, (b))', { line: 1, col: 3 });
    await press(page, 'di(');
    expect((await snapshot(page)).doc).toBe('f()');
    await setDoc(page, 'x[1, 2]y', { line: 1, col: 3 });
    await press(page, 'da[');
    expect((await snapshot(page)).doc).toBe('xy');
    await setDoc(page, '{ a: 1 }', { line: 1, col: 3 });
    await press(page, 'ci{');
    await type(page, 'b');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe('{b}');
    await setDoc(page, 'Map<string, number>', { line: 1, col: 6 });
    await press(page, 'di<');
    expect((await snapshot(page)).doc).toBe('Map<>');
    await setDoc(page, 'f(a, (b))', { line: 1, col: 6 });
    await press(page, 'yi(P');
    expect((await snapshot(page)).doc).toBe('f(a, (bb))');
  });

  test('quotes " \' ` with i and a (a-quote objects keep the surrounding spaces, unlike Vim)', async ({
    page,
  }) => {
    await setDoc(page, 'say "hello there" now', { line: 1, col: 7 });
    await press(page, 'di"');
    expect((await snapshot(page)).doc).toBe('say "" now');
    await setDoc(page, "say 'x' here", { line: 1, col: 5 });
    await press(page, "da'");
    expect((await snapshot(page)).doc).toBe('say  here');
    await setDoc(page, 'x = `tmpl ${y}`;', { line: 1, col: 6 });
    await press(page, 'di`');
    expect((await snapshot(page)).doc).toBe('x = ``;');
    await setDoc(page, 'x = `tmpl`;', { line: 1, col: 6 });
    await press(page, 'da`');
    expect((await snapshot(page)).doc).toBe('x = ;');
  });

  test('it at do nothing on JSX or TypeScript generics (documented gap: the adapter looks for HTML/XML tag nodes)', async ({
    page,
  }) => {
    await setDoc(page, 'const x = <div><b>bold text</b></div>;', {
      line: 1,
      col: 20,
    });
    await press(page, 'dit');
    expect((await snapshot(page)).doc).toBe(
      'const x = <div><b>bold text</b></div>;',
    );
    await press(page, 'dat');
    expect((await snapshot(page)).doc).toBe(
      'const x = <div><b>bold text</b></div>;',
    );
    await setDoc(page, 'const x: Array<string> = [];', { line: 1, col: 17 });
    await press(page, 'dit');
    expect((await snapshot(page)).doc).toBe('const x: Array<string> = [];');
    expect((await snapshot(page)).mode).toBe('normal');
  });
});

test.describe('Registers (P)', () => {
  test('unnamed: dw then P puts it back', async ({ page }) => {
    await setDoc(page, 'alpha beta');
    await press(page, 'dwP');
    expect((await snapshot(page)).doc).toBe('alpha beta');
  });

  test('named a–z and append with A–Z', async ({ page }) => {
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, '"ayyj"Ayyj"ap');
    expect((await snapshot(page)).doc).toBe(
      lines('one', 'two', 'three', 'one', 'two'),
    );
  });

  test('0 holds the last yank after a delete', async ({ page }) => {
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, 'yyjdd"0p');
    expect((await snapshot(page)).doc).toBe(lines('one', 'three', 'one'));
    await press(page, 'p');
    expect((await snapshot(page)).doc).toBe(
      lines('one', 'three', 'one', 'two'),
    );
  });

  test('_ discards without touching the unnamed register', async ({ page }) => {
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, 'yyj"_ddp');
    expect((await snapshot(page)).doc).toBe(lines('one', 'three', 'one'));
  });
});

test.describe('Marks and jumps (P; jumps W)', () => {
  test("m then ' and ` return to the line and the exact position", async ({
    page,
  }) => {
    await setDoc(page, MOTION_DOC, { line: 2, col: 5 });
    await press(page, 'maG');
    expect(await cursor(page)).toEqual([8, 0]);
    await press(page, "'a");
    expect(await cursor(page)).toEqual([2, 2]);
    await press(page, 'G`a');
    expect(await cursor(page)).toEqual([2, 5]);
  });

  test("'' returns to the position before the last jump", async ({ page }) => {
    await setDoc(page, MOTION_DOC, { line: 3, col: 4 });
    await press(page, 'G');
    expect(await cursor(page)).toEqual([8, 0]);
    await press(page, "''");
    expect(await cursor(page)).toEqual([3, 0]);
  });

  test('Ctrl-o and Ctrl-i walk the jump list (W)', async ({ page }) => {
    await setDoc(page, LONG_DOC);
    await press(page, 'G');
    await press(page, '<C-o>');
    expect(await cursor(page)).toEqual([1, 0]);
    await press(page, '<C-i>');
    expect(await cursor(page)).toEqual([80, 0]);
    await press(page, 'gg/line 40<CR>');
    expect(await cursor(page)).toEqual([40, 0]);
    await press(page, '<C-o>');
    expect(await cursor(page)).toEqual([1, 0]);
  });
});

const SEARCH_DOC = lines(
  'find the target here',
  'no match on this line',
  'another target',
  'last target line',
);

test.describe('Search (P)', () => {
  test('/ n N', async ({ page }) => {
    await setDoc(page, SEARCH_DOC);
    await press(page, '/target<CR>');
    expect(await cursor(page)).toEqual([1, 9]);
    await press(page, 'n');
    expect(await cursor(page)).toEqual([3, 8]);
    await press(page, 'n');
    expect(await cursor(page)).toEqual([4, 5]);
    await press(page, 'n');
    expect(await cursor(page)).toEqual([1, 9]);
    await press(page, 'N');
    expect(await cursor(page)).toEqual([4, 5]);
  });

  test('? searches backwards (from inside a match it skips that match; Vim would stop at its start)', async ({
    page,
  }) => {
    await setDoc(page, SEARCH_DOC, { line: 4, col: 12 });
    await press(page, '?target<CR>');
    expect(await cursor(page)).toEqual([4, 5]);
    await press(page, 'n');
    expect(await cursor(page)).toEqual([3, 8]);
    await setDoc(page, SEARCH_DOC, { line: 4, col: 8 });
    await press(page, '?target<CR>');
    expect(await cursor(page)).toEqual([3, 8]);
  });

  test('* and # search the word under the cursor', async ({ page }) => {
    await setDoc(page, SEARCH_DOC, { line: 1, col: 10 });
    await press(page, '*');
    expect(await cursor(page)).toEqual([3, 8]);
    await press(page, '#');
    expect(await cursor(page)).toEqual([1, 9]);
  });

  test('incremental: matches highlight while typing the pattern', async ({
    page,
  }) => {
    await setDoc(page, SEARCH_DOC);
    await press(page, '/');
    await type(page, 'targ');
    await expect
      .poll(async () => (await snapshot(page)).matches)
      .toBeGreaterThan(0);
    await press(page, '<Esc>');
  });

  test('highlight stays after Enter and :noh clears it', async ({ page }) => {
    await setDoc(page, SEARCH_DOC);
    await press(page, '/target<CR>');
    await expect.poll(async () => (await snapshot(page)).matches).toBe(3);
    await press(page, 'j');
    expect((await snapshot(page)).matches).toBe(3);
    await ex(page, 'noh');
    await expect.poll(async () => (await snapshot(page)).matches).toBe(0);
  });
});

test.describe('Repeat (P; macros W)', () => {
  test('. repeats the last change, with a count', async ({ page }) => {
    await setDoc(page, 'a b c d e f');
    await press(page, 'dw.');
    expect((await snapshot(page)).doc).toBe('c d e f');
    await press(page, '2.');
    expect((await snapshot(page)).doc).toBe('e f');
    await press(page, 'A!<Esc>j.');
    expect((await snapshot(page)).doc).toBe('e f!!');
  });

  test('; and , repeat f t F T', async ({ page }) => {
    await setDoc(page, 'a1 a2 a3 a4');
    await press(page, 'fa;;');
    expect(await cursor(page)).toEqual([1, 9]);
    await press(page, ',');
    expect(await cursor(page)).toEqual([1, 6]);
  });

  test('macros: q records, @ plays, @@ repeats (W)', async ({ page }) => {
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, 'qaA!<Esc>jq');
    expect((await snapshot(page)).doc).toBe(lines('one!', 'two', 'three'));
    await press(page, '@a');
    expect((await snapshot(page)).doc).toBe(lines('one!', 'two!', 'three'));
    await press(page, '@@');
    expect((await snapshot(page)).doc).toBe(lines('one!', 'two!', 'three!'));
  });
});

test.describe('Undo (P)', () => {
  test('u and Ctrl-r', async ({ page }) => {
    await setDoc(page, 'abc');
    await press(page, 'xx');
    expect((await snapshot(page)).doc).toBe('c');
    await press(page, 'u');
    expect((await snapshot(page)).doc).toBe('bc');
    await press(page, 'u');
    expect((await snapshot(page)).doc).toBe('abc');
    await press(page, '<C-r>');
    expect((await snapshot(page)).doc).toBe('bc');
  });

  test("U undoes like u (the lineUndo default; not Vim's line undo, documented)", async ({
    page,
  }) => {
    await setDoc(page, 'abc');
    await press(page, 'xU');
    expect((await snapshot(page)).doc).toBe('abc');
  });
});

const EX_DOC = lines('a a', 'a a', 'b');

test.describe('Ex (P; :g :sort W)', () => {
  test(':w runs the code: the host reports the emitted modules', async ({
    page,
  }) => {
    await waitForCompilerReady(page);
    await expect(messages(page)).toHaveCount(0);
    await ex(page, 'w');
    await expect(messages(page)).toHaveCount(1);
    await expect(messages(page).first()).toContainText('emitted 2 modules');
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test(':s and :%s with the g flag', async ({ page }) => {
    await setDoc(page, EX_DOC);
    await ex(page, 's/a/x/');
    expect((await snapshot(page)).doc).toBe(lines('x a', 'a a', 'b'));
    await ex(page, 's/a/y/g');
    expect((await snapshot(page)).doc).toBe(lines('x y', 'a a', 'b'));
    await ex(page, '%s/a/z/g');
    expect((await snapshot(page)).doc).toBe(lines('x y', 'z z', 'b'));
  });

  test(':%s with the c flag asks per match: y, n, a', async ({ page }) => {
    await setDoc(page, EX_DOC);
    await ex(page, '%s/a/x/gc');
    await press(page, 'y');
    await press(page, 'n');
    await press(page, 'a');
    await expect
      .poll(async () => (await snapshot(page)).doc)
      .toBe(lines('x a', 'x x', 'b'));
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test(':g with d and with s (W)', async ({ page }) => {
    await setDoc(page, lines('foo1', 'bar', 'foo2', 'baz'));
    await ex(page, 'g/foo/d');
    expect((await snapshot(page)).doc).toBe(lines('bar', 'baz'));
    await ex(page, 'g/^b/s/$/!/');
    expect((await snapshot(page)).doc).toBe(lines('bar!', 'baz!'));
  });

  test(':sort, :sort! and :sort u (W)', async ({ page }) => {
    await setDoc(page, lines('c', 'a', 'b', 'a'));
    await ex(page, 'sort');
    expect((await snapshot(page)).doc).toBe(lines('a', 'a', 'b', 'c'));
    await ex(page, 'sort!');
    expect((await snapshot(page)).doc).toBe(lines('c', 'b', 'a', 'a'));
    await ex(page, 'sort u');
    expect((await snapshot(page)).doc).toBe(lines('a', 'b', 'c'));
  });

  test(':<n> goes to a line', async ({ page }) => {
    await setDoc(page, MOTION_DOC);
    await ex(page, '5');
    expect(await cursor(page)).toEqual([5, 0]);
    await ex(page, '2');
    expect(await cursor(page)).toEqual([2, 2]);
  });

  test(':map :nmap :noremap :nnoremap and :unmap in normal mode', async ({
    page,
  }) => {
    await setDoc(page, lines('one', 'two', 'three', 'four', 'five'));
    await ex(page, 'map Q dd');
    await press(page, 'Q');
    expect((await snapshot(page)).doc).toBe(
      lines('two', 'three', 'four', 'five'),
    );
    await ex(page, 'nmap W dd');
    await press(page, 'W');
    expect((await snapshot(page)).doc).toBe(lines('three', 'four', 'five'));
    await ex(page, 'noremap E dd');
    await press(page, 'E');
    expect((await snapshot(page)).doc).toBe(lines('four', 'five'));
    await ex(page, 'nnoremap R dd');
    await press(page, 'R');
    expect((await snapshot(page)).doc).toBe('five');
    await ex(page, 'unmap Q');
    await press(page, 'Q');
    expect((await snapshot(page)).doc).toBe('five');
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test(':imap and :inoremap in insert mode', async ({ page }) => {
    await setDoc(page, 'abc');
    await ex(page, 'imap jj <Esc>');
    await press(page, 'A');
    await type(page, 'xjj');
    expect((await snapshot(page)).mode).toBe('normal');
    expect((await snapshot(page)).doc).toBe('abcx');
    await ex(page, 'inoremap kk <Esc>');
    await press(page, 'A');
    await type(page, 'ykk');
    expect((await snapshot(page)).mode).toBe('normal');
    expect((await snapshot(page)).doc).toBe('abcxy');
  });

  test(':vmap and :vnoremap in visual mode', async ({ page }) => {
    await setDoc(page, 'alpha beta');
    await ex(page, 'vmap Q d');
    await press(page, 'veQ');
    expect((await snapshot(page)).doc).toBe(' beta');
    await ex(page, 'vnoremap W d');
    await press(page, 'wveW');
    expect((await snapshot(page)).doc).toBe(' ');
  });

  test(':set rnu / nornu / nu / nonu / wrap / nowrap (the setOptions default)', async ({
    page,
  }) => {
    await setDoc(page, lines('one', 'two', 'three', 'four', 'five'), {
      line: 3,
      col: 0,
    });
    await ex(page, 'set rnu');
    await expect
      .poll(async () => (await snapshot(page)).gutter)
      .toEqual(['2', '1', '3', '1', '2']);
    await press(page, 'j');
    await expect
      .poll(async () => (await snapshot(page)).gutter)
      .toEqual(['3', '2', '1', '4', '1']);
    await ex(page, 'set nornu');
    await expect
      .poll(async () => (await snapshot(page)).gutter)
      .toEqual(['1', '2', '3', '4', '5']);
    await ex(page, 'set nonu');
    await expect.poll(async () => (await snapshot(page)).gutter).toEqual([]);
    await ex(page, 'set nu');
    await expect
      .poll(async () => (await snapshot(page)).gutter)
      .toEqual(['1', '2', '3', '4', '5']);
    await ex(page, 'set wrap');
    await expect.poll(async () => (await snapshot(page)).wrapping).toBe(true);
    await ex(page, 'set nowrap');
    await expect.poll(async () => (await snapshot(page)).wrapping).toBe(false);
  });
});

test.describe('Insert mode (W)', () => {
  test('Ctrl-u deletes to the start of the line', async ({ page }) => {
    await setDoc(page, 'hello world');
    await press(page, 'A<C-u>');
    expect((await snapshot(page)).doc).toBe('');
    expect((await snapshot(page)).mode).toBe('insert');
  });

  test('Ctrl-o runs one normal-mode command', async ({ page }) => {
    await setDoc(page, 'abc');
    await press(page, 'i<C-o>$');
    await type(page, 'X');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe('abcX');
  });

  test('Ctrl-r <reg> inserts a register', async ({ page }) => {
    await setDoc(page, 'alpha beta');
    await press(page, '"ayw');
    await press(page, 'o<C-r>a<Esc>');
    expect((await snapshot(page)).doc).toBe(lines('alpha beta', 'alpha '));
  });

  test('Ctrl-h is backspace in insert mode only (the insertCtrlH default; normal mode has the vimrc :focus left)', async ({
    page,
  }) => {
    await setDoc(page, 'abc');
    await press(page, 'A<C-h>');
    expect((await snapshot(page)).doc).toBe('ab');
    expect((await snapshot(page)).mode).toBe('insert');
    await press(page, '<Esc>');
    await press(page, '<C-h>');
    expect((await snapshot(page)).doc).toBe('ab');
    await press(page, 'v<C-h>');
    expect((await snapshot(page)).doc).toBe('ab');
    await press(page, '<Esc>');
  });

  test('Ctrl-w deletes a word in the engine (documented browser gap: Chrome keeps the real key; synthetic keys reach the page)', async ({
    page,
  }) => {
    await setDoc(page, 'alpha beta');
    await press(page, 'A<C-w>');
    expect((await snapshot(page)).doc).toBe('alpha ');
  });

  test('Ctrl-Backspace deletes a word through CodeMirror (the Ctrl-w stand-in)', async ({
    page,
  }) => {
    await setDoc(page, 'alpha beta');
    await press(page, 'A<C-BS>');
    expect((await snapshot(page)).doc).toBe('alpha ');
  });
});

const FOLD_DOC = lines(
  'function f() {',
  '  return 1;',
  '}',
  'function g() {',
  '  return 2;',
  '}',
);

test.describe('Folding (W)', () => {
  test('zo zc za zR zM over CodeMirror folds (the foldKeys default)', async ({
    page,
  }) => {
    await setDoc(page, FOLD_DOC);
    await press(page, 'zc');
    await expect.poll(async () => (await snapshot(page)).folds).toBe(1);
    await press(page, 'zo');
    await expect.poll(async () => (await snapshot(page)).folds).toBe(0);
    await press(page, 'za');
    await expect.poll(async () => (await snapshot(page)).folds).toBe(1);
    await press(page, 'za');
    await expect.poll(async () => (await snapshot(page)).folds).toBe(0);
    await press(page, 'zM');
    await expect.poll(async () => (await snapshot(page)).folds).toBe(2);
    await press(page, 'zR');
    await expect.poll(async () => (await snapshot(page)).folds).toBe(0);
  });
});

test.describe('Not expected (gap, documented)', () => {
  test(':normal works, beyond what the spec expects', async ({ page }) => {
    await setDoc(page, lines('a', 'b'));
    await ex(page, '%normal A;');
    expect((await snapshot(page)).doc).toBe(lines('a;', 'b;'));
  });

  test('gq hard-wraps at textwidth, beyond what the spec expects', async ({
    page,
  }) => {
    await setDoc(page, 'one two three four five six seven eight nine ten');
    await ex(page, 'set tw=20');
    await press(page, 'gqq');
    expect((await snapshot(page)).doc).toBe(
      lines('one two three four', 'five six seven eight', 'nine ten'),
    );
  });

  test('Ctrl-v insert edge case: $A appends on ragged lines (other edge cases untested, documented)', async ({
    page,
  }) => {
    await setDoc(page, lines('short', 'longer line', 'mid'));
    await press(page, '<C-v>jj$A!<Esc>');
    expect((await snapshot(page)).doc).toBe(
      lines('short!', 'longer line!', 'mid!'),
    );
  });

  test('other g and z commands: gv gJ zt zz exist; the rest are gaps, documented', async ({
    page,
  }) => {
    await setDoc(page, lines('alpha', 'beta'));
    await press(page, 'gJ');
    const joined = (await snapshot(page)).doc;
    await setDoc(page, 'alpha beta');
    await press(page, 've<Esc>0gv');
    const reselect = await snapshot(page);
    await setDoc(page, LONG_DOC, { line: 40, col: 0 });
    await press(page, 'zt');
    const top = (await snapshot(page)).scrollTop;
    await press(page, 'zz');
    const middle = (await snapshot(page)).scrollTop;
    expect(joined).toBe('alphabeta');
    expect([reselect.mode, reselect.anchorCol, reselect.col]).toEqual([
      'visual',
      0,
      5,
    ]);
    expect(top).toBeGreaterThan(0);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(top);
  });
});

test.describe('Leader (the shipped vimrc, let mapleader = " ")', () => {
  test('<Space>r runs :run: the host reports the emitted modules', async ({
    page,
  }) => {
    await waitForCompilerReady(page);
    await expect(messages(page)).toHaveCount(0);
    await press(page, '<Space>r');
    await expect(messages(page)).toHaveCount(1);
    await expect(messages(page).first()).toContainText(
      'emitted 2 modules (index.ts, shapes.ts)',
    );
    expect((await snapshot(page)).mode).toBe('normal');
  });
});

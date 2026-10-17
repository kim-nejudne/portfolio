// The §4 Vim checklist, run against @replit/codemirror-vim 6.4.0 in Chrome. One describe per
// row; each test title ends with the result it records in docs/prep-vim.md: pass, workaround
// (the test applies the definition from workarounds.ts) or gap (the test pins what happens today).
import { expect, test } from '@playwright/test';
import {
  apply,
  cursor,
  ex,
  lines,
  press,
  readClipboard,
  setDoc,
  snapshot,
  type,
  writeClipboard,
} from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeFocused();
});

test.describe('Modes (P)', () => {
  test('normal mode at start — pass', async ({ page }) => {
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test('insert: i, typing, Esc back to normal one column left — pass', async ({
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

  test('replace: R types over, Esc — pass', async ({ page }) => {
    await setDoc(page, 'abcdef');
    await press(page, 'R');
    expect((await snapshot(page)).mode).toBe('replace');
    await type(page, 'XY');
    await press(page, '<Esc>');
    const s = await snapshot(page);
    expect(s.doc).toBe('XYcdef');
    expect(s.mode).toBe('normal');
  });

  test('visual: v then e selects, d deletes the selection — pass', async ({
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

  test('visual-line: V j d deletes two lines — pass', async ({ page }) => {
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, 'Vj');
    expect((await snapshot(page)).mode).toBe('visual-line');
    await press(page, 'd');
    expect((await snapshot(page)).doc).toBe('three');
  });

  test('visual-block: Ctrl-v j j d deletes a column — pass', async ({
    page,
  }) => {
    await setDoc(page, lines('abc', 'def', 'ghi'));
    await press(page, '<C-v>jj');
    expect((await snapshot(page)).mode).toBe('visual-block');
    await press(page, 'd');
    expect((await snapshot(page)).doc).toBe(lines('bc', 'ef', 'hi'));
  });

  test('visual-block: Ctrl-v j I inserts on every line — pass', async ({
    page,
  }) => {
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
  test('h j k l — pass', async ({ page }) => {
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

  test('w b e ge — pass', async ({ page }) => {
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

  test('W B E treat punctuation as part of the word — pass', async ({
    page,
  }) => {
    await setDoc(page, 'a-b c.d e');
    await press(page, 'W');
    expect(await cursor(page)).toEqual([1, 4]);
    await press(page, 'E');
    expect(await cursor(page)).toEqual([1, 6]);
    await press(page, 'B');
    expect(await cursor(page)).toEqual([1, 4]);
  });

  test('0 ^ $ — pass', async ({ page }) => {
    await setDoc(page, MOTION_DOC, { line: 2, col: 10 });
    await press(page, '0');
    expect(await cursor(page)).toEqual([2, 0]);
    await press(page, '^');
    expect(await cursor(page)).toEqual([2, 2]);
    await press(page, '$');
    expect(await cursor(page)).toEqual([2, 19]);
  });

  test('gg G — pass', async ({ page }) => {
    await setDoc(page, MOTION_DOC, { line: 3, col: 2 });
    await press(page, 'G');
    expect(await cursor(page)).toEqual([8, 0]);
    await press(page, 'gg');
    expect(await cursor(page)).toEqual([1, 0]);
  });

  test('{ } move by paragraph — pass', async ({ page }) => {
    await setDoc(page, MOTION_DOC);
    await press(page, '}');
    expect(await cursor(page)).toEqual([4, 0]);
    await press(page, '}');
    expect(await cursor(page)).toEqual([7, 0]);
    await press(page, '{');
    expect(await cursor(page)).toEqual([4, 0]);
  });

  test('% jumps between matching brackets — pass', async ({ page }) => {
    await setDoc(page, MOTION_DOC, { line: 3, col: 3 });
    await press(page, '%');
    expect(await cursor(page)).toEqual([3, 17]);
    await press(page, '%');
    expect(await cursor(page)).toEqual([3, 3]);
    await setDoc(page, MOTION_DOC, { line: 3, col: 7 });
    await press(page, '%');
    expect(await cursor(page)).toEqual([3, 16]);
  });

  test('f t F T ; , — pass', async ({ page }) => {
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

  test('H M L move within the visible screen — pass', async ({ page }) => {
    await setDoc(page, LONG_DOC);
    await press(page, 'L');
    const bottom = (await snapshot(page)).line;
    expect(bottom).toBeGreaterThan(8);
    expect(bottom).toBeLessThan(20);
    await press(page, 'M');
    const middle = (await snapshot(page)).line;
    expect(middle).toBeGreaterThan(1);
    expect(middle).toBeLessThan(bottom);
    await press(page, 'H');
    expect(await cursor(page)).toEqual([1, 0]);
  });

  test('Ctrl-d Ctrl-u Ctrl-f Ctrl-b scroll by half and full pages — pass', async ({
    page,
  }) => {
    await setDoc(page, LONG_DOC);
    await press(page, '<C-d>');
    const half = (await snapshot(page)).line;
    expect(half).toBeGreaterThan(4);
    expect(half).toBeLessThan(14);
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

  test('counts: 3w 2j 5l 2k — pass', async ({ page }) => {
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
  test('d with motions and counts: dw d2w 2dw d3l — pass', async ({ page }) => {
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

  test('c with a motion: cw types over a word — pass', async ({ page }) => {
    await setDoc(page, 'alpha beta');
    await press(page, 'cw');
    await type(page, 'X');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe('X beta');
  });

  test('y with a motion and p: yw then p — pass', async ({ page }) => {
    await setDoc(page, 'alpha beta');
    await press(page, 'yw$p');
    expect((await snapshot(page)).doc).toBe('alpha betaalpha ');
  });

  test('> and < with motions and counts: >j <j 2>> — pass', async ({
    page,
  }) => {
    await setDoc(page, lines('a', 'b', 'c'));
    await press(page, '>j');
    expect((await snapshot(page)).doc).toBe(lines('  a', '  b', 'c'));
    await press(page, '<j');
    expect((await snapshot(page)).doc).toBe(lines('a', 'b', 'c'));
    await press(page, '2>>');
    expect((await snapshot(page)).doc).toBe(lines('  a', '  b', 'c'));
  });

  test('= reindents through the language: == on a misindented line — pass', async ({
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

  test('g~ gu gU with motions — pass', async ({ page }) => {
    await setDoc(page, 'hello World');
    await press(page, 'g~w');
    expect((await snapshot(page)).doc).toBe('HELLO World');
    await press(page, 'guw');
    expect((await snapshot(page)).doc).toBe('hello World');
    await press(page, 'gU$');
    expect((await snapshot(page)).doc).toBe('HELLO WORLD');
  });

  test('dd cc yy with counts: 2dd cc yyp — pass', async ({ page }) => {
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

  test('D C Y — pass', async ({ page }) => {
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

  test('x X s S r J with counts — pass', async ({ page }) => {
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

test.describe('Marks and jumps (P; jumps W)', () => {
  test("m then ' and ` return to the line and the exact position — pass", async ({
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

  test("'' returns to the position before the last jump — pass", async ({
    page,
  }) => {
    await setDoc(page, MOTION_DOC, { line: 3, col: 4 });
    await press(page, 'G');
    expect(await cursor(page)).toEqual([8, 0]);
    await press(page, "''");
    expect(await cursor(page)).toEqual([3, 0]);
  });

  test('Ctrl-o and Ctrl-i walk the jump list — pass (W)', async ({ page }) => {
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

test.describe('Repeat (P; macros W)', () => {
  test('. repeats the last change, with a count — pass', async ({ page }) => {
    await setDoc(page, 'a b c d e f');
    await press(page, 'dw.');
    expect((await snapshot(page)).doc).toBe('c d e f');
    await press(page, '2.');
    expect((await snapshot(page)).doc).toBe('e f');
    await press(page, 'A!<Esc>j.');
    expect((await snapshot(page)).doc).toBe('e f!!');
  });

  test('; and , repeat f t F T — pass', async ({ page }) => {
    await setDoc(page, 'a1 a2 a3 a4');
    await press(page, 'fa;;');
    expect(await cursor(page)).toEqual([1, 9]);
    await press(page, ',');
    expect(await cursor(page)).toEqual([1, 6]);
  });

  test('macros: q records, @ plays, @@ repeats — pass (W)', async ({
    page,
  }) => {
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
  test('u and Ctrl-r — pass', async ({ page }) => {
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

  test('U as shipped does nothing in normal mode — gap', async ({ page }) => {
    await setDoc(page, 'abc');
    await press(page, 'xU');
    expect((await snapshot(page)).doc).toBe('bc');
  });

  test("U with lineUndo undoes like u — workaround (not Vim's line undo)", async ({
    page,
  }) => {
    await apply(page, 'lineUndo');
    await setDoc(page, 'abc');
    await press(page, 'xU');
    expect((await snapshot(page)).doc).toBe('abc');
  });
});

const EX_DOC = lines('a a', 'a a', 'b');

test.describe('Ex (P; :g :sort W)', () => {
  test(':w as shipped has nothing to call; with defineEx the app owns it — pass (defineEx)', async ({
    page,
  }) => {
    await setDoc(page, 'abc');
    await ex(page, 'w');
    expect((await snapshot(page)).doc).toBe('abc');
    expect((await snapshot(page)).writes).toBe(0);
    await apply(page, 'writeEx');
    await ex(page, 'w');
    expect((await snapshot(page)).writes).toBe(1);
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test(':s and :%s with the g flag — pass', async ({ page }) => {
    await setDoc(page, EX_DOC);
    await ex(page, 's/a/x/');
    expect((await snapshot(page)).doc).toBe(lines('x a', 'a a', 'b'));
    await ex(page, 's/a/y/g');
    expect((await snapshot(page)).doc).toBe(lines('x y', 'a a', 'b'));
    await ex(page, '%s/a/z/g');
    expect((await snapshot(page)).doc).toBe(lines('x y', 'z z', 'b'));
  });

  test(':%s with the c flag asks per match: y, n, a — pass', async ({
    page,
  }) => {
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

  test(':g with d and with s — pass (W)', async ({ page }) => {
    await setDoc(page, lines('foo1', 'bar', 'foo2', 'baz'));
    await ex(page, 'g/foo/d');
    expect((await snapshot(page)).doc).toBe(lines('bar', 'baz'));
    await ex(page, 'g/^b/s/$/!/');
    expect((await snapshot(page)).doc).toBe(lines('bar!', 'baz!'));
  });

  test(':sort, :sort! and :sort u — pass (W)', async ({ page }) => {
    await setDoc(page, lines('c', 'a', 'b', 'a'));
    await ex(page, 'sort');
    expect((await snapshot(page)).doc).toBe(lines('a', 'a', 'b', 'c'));
    await ex(page, 'sort!');
    expect((await snapshot(page)).doc).toBe(lines('c', 'b', 'a', 'a'));
    await ex(page, 'sort u');
    expect((await snapshot(page)).doc).toBe(lines('a', 'b', 'c'));
  });

  test(':<n> goes to a line — pass', async ({ page }) => {
    await setDoc(page, MOTION_DOC);
    await ex(page, '5');
    expect(await cursor(page)).toEqual([5, 0]);
    await ex(page, '2');
    expect(await cursor(page)).toEqual([2, 2]);
  });

  test(':map :nmap :noremap :nnoremap and :unmap in normal mode — pass', async ({
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

  test(':imap and :inoremap in insert mode — pass', async ({ page }) => {
    await setDoc(page, 'abc');
    await ex(page, 'imap jk <Esc>');
    await press(page, 'A');
    await type(page, 'xjk');
    expect((await snapshot(page)).mode).toBe('normal');
    expect((await snapshot(page)).doc).toBe('abcx');
    await ex(page, 'inoremap jj <Esc>');
    await press(page, 'A');
    await type(page, 'yjj');
    expect((await snapshot(page)).mode).toBe('normal');
    expect((await snapshot(page)).doc).toBe('abcxy');
  });

  test(':vmap and :vnoremap in visual mode — pass', async ({ page }) => {
    await setDoc(page, 'alpha beta');
    await ex(page, 'vmap Q d');
    await press(page, 'veQ');
    expect((await snapshot(page)).doc).toBe(' beta');
    await ex(page, 'vnoremap W d');
    await press(page, 'wveW');
    expect((await snapshot(page)).doc).toBe(' ');
  });

  test(':set rnu nu wrap as shipped are unknown options — gap', async ({
    page,
  }) => {
    await setDoc(page, lines('one', 'two', 'three'), { line: 2, col: 0 });
    await ex(page, 'set rnu');
    await expect
      .poll(async () => (await snapshot(page)).status)
      .toContain('Unknown option: rnu');
    expect((await snapshot(page)).gutter).toEqual(['1', '2', '3']);
    await ex(page, 'set wrap');
    await expect
      .poll(async () => (await snapshot(page)).status)
      .toContain('Unknown option: wrap');
    expect((await snapshot(page)).wrapping).toBe(false);
  });

  test(':set rnu / nornu / nu / nonu / wrap / nowrap with setOptions — workaround', async ({
    page,
  }) => {
    await apply(page, 'setOptions');
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

const FOLD_DOC = lines(
  'function f() {',
  '  return 1;',
  '}',
  'function g() {',
  '  return 2;',
  '}',
);

test.describe('Folding (W)', () => {
  test('zc as shipped does not fold — gap', async ({ page }) => {
    await setDoc(page, FOLD_DOC);
    await press(page, 'zc');
    expect((await snapshot(page)).folds).toBe(0);
  });

  test('zo zc za zR zM with foldKeys over CodeMirror folds — workaround', async ({
    page,
  }) => {
    await apply(page, 'foldKeys');
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

test.describe('Text objects (P; it at W)', () => {
  test('iw aw — pass', async ({ page }) => {
    await setDoc(page, 'alpha beta gamma', { line: 1, col: 7 });
    await press(page, 'diw');
    expect((await snapshot(page)).doc).toBe('alpha  gamma');
    await setDoc(page, 'alpha beta gamma', { line: 1, col: 7 });
    await press(page, 'daw');
    expect((await snapshot(page)).doc).toBe('alpha gamma');
  });

  test('iW aW — pass', async ({ page }) => {
    await setDoc(page, 'a-b c.d e', { line: 1, col: 5 });
    await press(page, 'diW');
    expect((await snapshot(page)).doc).toBe('a-b  e');
    await setDoc(page, 'a-b c.d e', { line: 1, col: 5 });
    await press(page, 'daW');
    expect((await snapshot(page)).doc).toBe('a-b e');
  });

  test('is as — pass', async ({ page }) => {
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

  test('ip ap — pass', async ({ page }) => {
    const doc = lines('p1a', 'p1b', '', 'p2a', 'p2b', '', 'p3');
    await setDoc(page, doc, { line: 4, col: 0 });
    await press(page, 'dip');
    expect((await snapshot(page)).doc).toBe(lines('p1a', 'p1b', '', '', 'p3'));
    await setDoc(page, doc, { line: 4, col: 0 });
    await press(page, 'dap');
    expect((await snapshot(page)).doc).toBe(lines('p1a', 'p1b', '', 'p3'));
  });

  test('brackets ( [ { < with i and a — pass', async ({ page }) => {
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

  test('quotes " \' ` with i and a — pass (a-quote objects keep the surrounding spaces, unlike Vim)', async ({
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

  test('it at do nothing on JSX or TypeScript generics: the adapter looks for HTML/XML tag nodes — gap (W), documented', async ({
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
  test('unnamed: dw then P puts it back — pass', async ({ page }) => {
    await setDoc(page, 'alpha beta');
    await press(page, 'dwP');
    expect((await snapshot(page)).doc).toBe('alpha beta');
  });

  test('named a–z and append with A–Z — pass', async ({ page }) => {
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, '"ayyj"Ayyj"ap');
    expect((await snapshot(page)).doc).toBe(
      lines('one', 'two', 'three', 'one', 'two'),
    );
  });

  test('0 holds the last yank after a delete — pass', async ({ page }) => {
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, 'yyjdd"0p');
    expect((await snapshot(page)).doc).toBe(lines('one', 'three', 'one'));
    await press(page, 'p');
    expect((await snapshot(page)).doc).toBe(
      lines('one', 'three', 'one', 'two'),
    );
  });

  test('_ discards without touching the unnamed register — pass', async ({
    page,
  }) => {
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, 'yyj"_ddp');
    expect((await snapshot(page)).doc).toBe(lines('one', 'three', 'one'));
  });

  test('+ writes the system clipboard on yank, linewise, charwise and from visual mode — pass', async ({
    page,
  }) => {
    await setDoc(page, lines('one', 'two'));
    await press(page, 'j"+yy');
    await expect.poll(() => readClipboard(page)).toBe('two\n');
    await setDoc(page, 'alpha beta');
    await press(page, '"+yw');
    await expect.poll(() => readClipboard(page)).toBe('alpha ');
    await setDoc(page, 'gamma delta');
    await press(page, 'v$"+y');
    await expect.poll(() => readClipboard(page)).toBe('gamma delta');
    expect((await snapshot(page)).mode).toBe('normal');
  });

  test('+ reads the system clipboard on put: charwise text pastes in place, but a copied line is pasted charwise too and splits the line — pass with a gap (no linewise detection)', async ({
    page,
  }) => {
    await setDoc(page, 'x');
    await writeClipboard(page, 'from the system');
    await press(page, '"+p');
    await expect
      .poll(async () => (await snapshot(page)).doc)
      .toBe('xfrom the system');
    await setDoc(page, lines('one', 'two'));
    await writeClipboard(page, 'a whole line\n');
    await press(page, '"+p');
    await expect
      .poll(async () => (await snapshot(page)).doc)
      .toBe(lines('oa whole line', 'ne', 'two'));
  });

  test('+ after a linewise "+yy pastes charwise clipboard text as a line minus its last character — gap (engine keeps the register\'s linewise flag)', async ({
    page,
  }) => {
    await setDoc(page, lines('one', 'two'));
    await press(page, 'j"+yy');
    await expect.poll(() => readClipboard(page)).toBe('two\n');
    await writeClipboard(page, 'pasted');
    await press(page, '"+p');
    await expect
      .poll(async () => (await snapshot(page)).doc)
      .toBe(lines('one', 'two', 'paste'));
  });

  test('+ with clipboardPaste derives linewise from the clipboard text — workaround', async ({
    page,
  }) => {
    await apply(page, 'clipboardPaste');
    await setDoc(page, lines('one', 'two'));
    await press(page, 'j"+yy');
    await expect.poll(() => readClipboard(page)).toBe('two\n');
    await writeClipboard(page, 'pasted');
    await press(page, '"+p');
    await expect
      .poll(async () => (await snapshot(page)).doc)
      .toBe(lines('one', 'tpastedwo'));
    await writeClipboard(page, 'full line\n');
    await press(page, '"+p');
    await expect
      .poll(async () => (await snapshot(page)).doc)
      .toBe(lines('one', 'tpastedwo', 'full line'));
    await setDoc(page, lines('one', 'two'));
    await press(page, 'yyjp');
    expect((await snapshot(page)).doc).toBe(lines('one', 'two', 'one'));
    await press(page, '"ayw$"ap');
    expect((await snapshot(page)).doc).toBe(lines('one', 'two', 'oneone'));
  });

  test('* as shipped is ignored: "*yy is a plain yy and the clipboard is untouched — gap', async ({
    page,
  }) => {
    await setDoc(page, lines('one', 'two'));
    await writeClipboard(page, 'untouched');
    await press(page, 'yyj"*yyp');
    expect((await snapshot(page)).doc).toBe(lines('one', 'two', 'two'));
    expect(await readClipboard(page)).toBe('untouched');
  });

  test('* with starRegister is the clipboard register in normal and visual mode — workaround', async ({
    page,
  }) => {
    await apply(page, 'starRegister');
    await setDoc(page, 'x');
    await writeClipboard(page, 'star');
    await press(page, '"*p');
    await expect.poll(async () => (await snapshot(page)).doc).toBe('xstar');
    await setDoc(page, lines('one', 'two'));
    await press(page, 'j"*yy');
    await expect.poll(() => readClipboard(page)).toBe('two\n');
    await setDoc(page, 'gamma delta');
    await press(page, 'v$"*y');
    await expect.poll(() => readClipboard(page)).toBe('gamma delta');
    expect((await snapshot(page)).mode).toBe('normal');
  });
});

test.describe('Search (P)', () => {
  test('/ n N — pass', async ({ page }) => {
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

  test('? searches backwards — pass (from inside a match it skips that match; Vim would stop at its start)', async ({
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

  test('* and # search the word under the cursor — pass', async ({ page }) => {
    await setDoc(page, SEARCH_DOC, { line: 1, col: 10 });
    await press(page, '*');
    expect(await cursor(page)).toEqual([3, 8]);
    await press(page, '#');
    expect(await cursor(page)).toEqual([1, 9]);
  });

  test('incremental: matches highlight while typing the pattern — pass', async ({
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

  test('highlight stays after Enter and :noh clears it — pass', async ({
    page,
  }) => {
    await setDoc(page, SEARCH_DOC);
    await press(page, '/target<CR>');
    await expect.poll(async () => (await snapshot(page)).matches).toBe(3);
    await press(page, 'j');
    expect((await snapshot(page)).matches).toBe(3);
    await ex(page, 'noh');
    await expect.poll(async () => (await snapshot(page)).matches).toBe(0);
  });
});

test.describe('Insert mode (W)', () => {
  test('Ctrl-u deletes to the start of the line — pass', async ({ page }) => {
    await setDoc(page, 'hello world');
    await press(page, 'A<C-u>');
    expect((await snapshot(page)).doc).toBe('');
    expect((await snapshot(page)).mode).toBe('insert');
  });

  test('Ctrl-o runs one normal-mode command — pass', async ({ page }) => {
    await setDoc(page, 'abc');
    await press(page, 'i<C-o>$');
    await type(page, 'X');
    await press(page, '<Esc>');
    expect((await snapshot(page)).doc).toBe('abcX');
  });

  test('Ctrl-r <reg> inserts a register — pass', async ({ page }) => {
    await setDoc(page, 'alpha beta');
    await press(page, '"ayw');
    await press(page, 'o<C-r>a<Esc>');
    expect((await snapshot(page)).doc).toBe(lines('alpha beta', 'alpha '));
  });

  test('Ctrl-h as shipped does nothing in insert mode — gap', async ({
    page,
  }) => {
    await setDoc(page, 'abc');
    await press(page, 'A<C-h>');
    expect((await snapshot(page)).doc).toBe('abc');
    await press(page, '<Esc>');
  });

  test('Ctrl-h with the insertCtrlH keymap is backspace in insert mode only — workaround', async ({
    page,
  }) => {
    await apply(page, 'insertCtrlH');
    await setDoc(page, 'abc');
    await press(page, 'A<C-h>');
    expect((await snapshot(page)).doc).toBe('ab');
    await press(page, '<Esc>');
    await press(page, '<C-h>');
    expect((await snapshot(page)).doc).toBe('ab');
    await press(page, 'v<C-h>');
    expect((await snapshot(page)).doc).toBe('ab');
    await press(page, '<Esc>');
  });

  test('Ctrl-h through a Vim insert mapping to <BS> (imap <C-h> <BS>) is backspace too — workaround', async ({
    page,
  }) => {
    await apply(page, 'insertCtrlHViaVimMap');
    await setDoc(page, 'abc');
    await press(page, 'A<C-h>');
    expect((await snapshot(page)).doc).toBe('ab');
    expect((await snapshot(page)).mode).toBe('insert');
    await press(page, '<Esc>');
  });

  test('Ctrl-w deletes a word in the engine (the browser keeps the real key: Kim checks) — pass under synthetic keys', async ({
    page,
  }) => {
    await setDoc(page, 'alpha beta');
    await press(page, 'A<C-w>');
    expect((await snapshot(page)).doc).toBe('alpha ');
  });

  test('Ctrl-Backspace deletes a word through CodeMirror — pass', async ({
    page,
  }) => {
    await setDoc(page, 'alpha beta');
    await press(page, 'A<C-BS>');
    expect((await snapshot(page)).doc).toBe('alpha ');
  });
});

test.describe('Not expected (gap, documented)', () => {
  test(':normal works, beyond what the spec expects — pass', async ({
    page,
  }) => {
    await setDoc(page, lines('a', 'b'));
    await ex(page, '%normal A;');
    expect((await snapshot(page)).doc).toBe(lines('a;', 'b;'));
  });

  test('gq hard-wraps at textwidth, beyond what the spec expects — pass', async ({
    page,
  }) => {
    await setDoc(page, 'one two three four five six seven eight nine ten');
    await ex(page, 'set tw=20');
    await press(page, 'gqq');
    expect((await snapshot(page)).doc).toBe(
      lines('one two three four', 'five six seven eight', 'nine ten'),
    );
  });

  test('Ctrl-v insert edge case: $A appends on ragged lines — pass; other edge cases untested, documented', async ({
    page,
  }) => {
    await setDoc(page, lines('short', 'longer line', 'mid'));
    await press(page, '<C-v>jj$A!<Esc>');
    expect((await snapshot(page)).doc).toBe(
      lines('short!', 'longer line!', 'mid!'),
    );
  });

  test('other g and z commands: gv gJ zt zz exist — pass; the rest are gaps, documented', async ({
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

test.describe('API (what the vimrc parser and F3 need)', () => {
  test('Vim.map jk <Esc> in insert mode — pass', async ({ page }) => {
    await page.evaluate(() => window.__spike.Vim.map('jk', '<Esc>', 'insert'));
    await setDoc(page, 'abc');
    await press(page, 'A');
    await type(page, 'xjk');
    expect((await snapshot(page)).mode).toBe('normal');
    expect((await snapshot(page)).doc).toBe('abcx');
  });

  test('a single-key mapping overrides the default for that key (X → dd); Vim.map and :nmap are the same path — pass', async ({
    page,
  }) => {
    await page.evaluate(() => window.__spike.Vim.map('X', 'dd', 'normal'));
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, 'X');
    expect((await snapshot(page)).doc).toBe(lines('two', 'three'));
    await ex(page, 'nmap X j');
    await press(page, 'X');
    expect((await snapshot(page)).doc).toBe(lines('two', 'three'));
    expect(await cursor(page)).toEqual([2, 0]);
  });

  test('a mapping to :w<CR> runs the command; a mapping to :w opens the command line pre-filled, as in Vim — pass', async ({
    page,
  }) => {
    await apply(page, 'writeEx');
    await page.evaluate(() => window.__spike.Vim.map('X', ':w', 'normal'));
    await setDoc(page, 'abc');
    await press(page, 'X');
    await expect(page.locator('.cm-vim-panel input')).toHaveValue('w');
    expect((await snapshot(page)).writes).toBe(0);
    await press(page, '<CR>');
    await expect.poll(async () => (await snapshot(page)).writes).toBe(1);
    await page.evaluate(() => window.__spike.Vim.map('Z', ':w<CR>', 'normal'));
    await press(page, 'Z');
    await expect.poll(async () => (await snapshot(page)).writes).toBe(2);
    await ex(page, 'nmap Y :w<CR>');
    await press(page, 'Y');
    await expect.poll(async () => (await snapshot(page)).writes).toBe(3);
  });

  test('re-mapping a key: the newest definition wins, unmap removes only the newest, mapclear(ctx) empties the user layer — pass, documented (re-applying the vimrc must mapclear first)', async ({
    page,
  }) => {
    await page.evaluate(() => window.__spike.Vim.map('X', 'dd', 'normal'));
    await page.evaluate(() => window.__spike.Vim.map('X', 'j', 'normal'));
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, 'X');
    expect((await snapshot(page)).doc).toBe(lines('one', 'two', 'three'));
    expect(await cursor(page)).toEqual([2, 0]);
    await page.evaluate(() => window.__spike.Vim.unmap('X', 'normal'));
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, 'X');
    expect((await snapshot(page)).doc).toBe(lines('two', 'three'));
    await page.evaluate(() => window.__spike.Vim.mapclear('normal'));
    await setDoc(page, lines('one', 'two', 'three'), { line: 1, col: 1 });
    await press(page, 'X');
    expect((await snapshot(page)).doc).toBe(lines('ne', 'two', 'three'));
  });

  test('the shipped vimrc keys that are free or prefixes fire as multi-key mappings: gd gt gT ]d [d K <C-h> <C-j> <C-k> <C-l> — pass', async ({
    page,
  }) => {
    await apply(page, 'writeEx');
    await page.evaluate(() => {
      const { Vim } = window.__spike;
      for (const key of [
        'gd',
        'gt',
        'gT',
        ']d',
        '[d',
        'K',
        '<C-h>',
        '<C-j>',
        '<C-k>',
        '<C-l>',
      ])
        Vim.map(key, ':w<CR>', 'normal');
    });
    await setDoc(page, lines('one', 'two'));
    let expected = 0;
    for (const keys of [
      'gd',
      'gt',
      'gT',
      ']d',
      '[d',
      'K',
      '<C-h>',
      '<C-j>',
      '<C-k>',
      '<C-l>',
    ]) {
      await press(page, keys);
      expected += 1;
      await expect
        .poll(async () => (await snapshot(page)).writes, { message: keys })
        .toBe(expected);
    }
    expect((await snapshot(page)).doc).toBe(lines('one', 'two'));
  });

  test('a multi-key mapping whose first key is a full command by itself never fires: <Space>d and ,d run Space and , instead — gap', async ({
    page,
  }) => {
    await page.evaluate(() => {
      const { Vim } = window.__spike;
      Vim.map('<Space>d', 'dd', 'normal');
      Vim.map(',d', 'dd', 'normal');
    });
    await setDoc(page, lines('one', 'two'));
    await press(page, '<Space>d');
    expect(await cursor(page)).toEqual([1, 1]);
    expect((await snapshot(page)).doc).toBe(lines('one', 'two'));
    await press(page, '<Esc>');
    await setDoc(page, lines('one', 'two'));
    await press(page, ',d');
    expect((await snapshot(page)).doc).toBe(lines('one', 'two'));
    await press(page, '<Esc>');
    await page.evaluate(() => window.__spike.Vim.unmap('<Space>', 'normal'));
    await setDoc(page, lines('one', 'two'));
    await press(page, '<Space>d');
    expect(await cursor(page)).toEqual([1, 1]);
    expect((await snapshot(page)).doc).toBe(lines('one', 'two'));
  });

  test('<leader> means nothing to the engine; the vimrc parser must expand it — gap', async ({
    page,
  }) => {
    await apply(page, 'writeEx');
    await ex(page, 'nmap <leader>r :w<CR>');
    await setDoc(page, 'abc');
    await press(page, '\\r');
    await press(page, '<Space>r');
    await page.waitForTimeout(100);
    expect((await snapshot(page)).writes).toBe(0);
  });

  test('leaderKey: Space → <Leader>, then <Leader>r and <Leader>x fire in normal mode, <Leader>d in visual mode, counts apply, unmapped sequences are swallowed, d<Space> keeps its motion — workaround', async ({
    page,
  }) => {
    await apply(page, 'writeEx');
    await apply(page, 'leaderKey');
    await page.evaluate(() => {
      const { Vim } = window.__spike;
      Vim.map('<Leader>r', ':w<CR>', 'normal');
      Vim.map('<Leader>x', 'dd', 'normal');
      Vim.map('<Leader>d', 'd', 'visual');
    });
    await setDoc(page, lines('one', 'two', 'three'));
    await press(page, '<Space>r');
    await expect.poll(async () => (await snapshot(page)).writes).toBe(1);
    expect((await snapshot(page)).doc).toBe(lines('one', 'two', 'three'));
    await press(page, '<Space>x');
    expect((await snapshot(page)).doc).toBe(lines('two', 'three'));
    await press(page, '2<Space>x');
    expect((await snapshot(page)).doc).toBe('');
    await setDoc(page, 'alpha beta');
    await press(page, 've<Space>d');
    expect((await snapshot(page)).doc).toBe(' beta');
    await setDoc(page, 'alpha beta');
    await press(page, '<Space>l');
    expect(await cursor(page)).toEqual([1, 0]);
    expect((await snapshot(page)).doc).toBe('alpha beta');
    await press(page, 'l');
    expect(await cursor(page)).toEqual([1, 1]);
    await press(page, '0d<Space>');
    expect((await snapshot(page)).doc).toBe('lpha beta');
  });

  test('Vim.noremap and Vim.unmap — pass', async ({ page }) => {
    await page.evaluate(() => window.__spike.Vim.noremap('Q', 'dd', 'normal'));
    await setDoc(page, lines('one', 'two'));
    await press(page, 'Q');
    expect((await snapshot(page)).doc).toBe('two');
    await page.evaluate(() => window.__spike.Vim.unmap('Q', 'normal'));
    await press(page, 'Q');
    expect((await snapshot(page)).doc).toBe('two');
  });

  test('Vim.handleKey and Vim.handleEx drive the editor without key events — pass', async ({
    page,
  }) => {
    await setDoc(page, lines('one', 'two', 'three'));
    await page.evaluate(() => {
      const { cm, Vim } = window.__spike;
      Vim.handleKey(cm, 'd', 'user');
      Vim.handleKey(cm, 'd', 'user');
    });
    expect((await snapshot(page)).doc).toBe(lines('two', 'three'));
    await page.evaluate(() => {
      const { cm, Vim } = window.__spike;
      Vim.handleEx(cm as Parameters<typeof Vim.handleEx>[0], '2');
    });
    expect(await cursor(page)).toEqual([2, 0]);
  });

  test('vim({ status: true }) renders the mode in a panel; a notification replaces it until the next one — pass', async ({
    page,
  }) => {
    await setDoc(page, 'abc');
    expect((await snapshot(page)).status).toBe('--NORMAL--');
    await press(page, 'i');
    await expect
      .poll(async () => (await snapshot(page)).status)
      .toBe('--INSERT--');
    await press(page, '<Esc>v');
    await expect
      .poll(async () => (await snapshot(page)).status)
      .toBe('--VISUAL--');
    await press(page, '<Esc>R');
    await expect
      .poll(async () => (await snapshot(page)).status)
      .toBe('--REPLACE--');
    await press(page, '<Esc>');
    await ex(page, 'set rnu');
    await expect
      .poll(async () => (await snapshot(page)).status)
      .toBe('Unknown option: rnu');
  });
});

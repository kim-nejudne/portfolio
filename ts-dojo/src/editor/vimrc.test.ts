// The vimrc parser and apply step (§4 Mappings and the vimrc; §12 F3: the shipped vimrc
// applies, a bad line is reported with its number and skipped, the good lines still apply).
// The engine is a recording fake that knows the three §4 `:set` options.
import { describe, expect, it } from 'vitest';
import {
  applyVimrc,
  expandLeader,
  formatVimrcError,
  parseVimrc,
  SHIPPED_VIMRC,
  type VimApi,
} from './vimrc.ts';

function fakeVim(options: string[] = ['rnu', 'nu', 'wrap', 'bg']) {
  const calls: string[] = [];
  const mappings = new Set<string>();
  const vim: VimApi = {
    map: (lhs, rhs, ctx) => {
      calls.push(`map ${ctx} ${lhs} ${rhs}`);
      mappings.add(`${ctx} ${lhs}`);
    },
    noremap: (lhs, rhs, ctx) => {
      calls.push(`noremap ${ctx} ${lhs} ${rhs}`);
      mappings.add(`${ctx} ${lhs}`);
    },
    unmap: (lhs, ctx) => {
      calls.push(`unmap ${ctx} ${lhs}`);
      return mappings.delete(`${ctx} ${lhs}`);
    },
    mapclear: (ctx) => {
      calls.push(`mapclear ${ctx ?? ''}`);
      for (const key of [...mappings]) {
        if (ctx === undefined || key.startsWith(`${ctx} `))
          mappings.delete(key);
      }
    },
    setOption: (name, value) => {
      if (!options.includes(name)) return new Error(`Unknown option: ${name}`);
      calls.push(`set ${name} ${String(value)}`);
      return undefined;
    },
  };
  return { vim, calls };
}

describe('parseVimrc (§4 supported lines)', () => {
  it('parses the shipped vimrc with no errors, a Space leader, and <leader> expanded', () => {
    const parsed = parseVimrc(SHIPPED_VIMRC);
    expect(parsed.errors).toEqual([]);
    expect(parsed.leader).toBe('<Space>');
    expect(parsed.commands).toHaveLength(15);
    expect(parsed.commands[0]).toEqual({
      line: 2,
      kind: 'map',
      contexts: ['insert'],
      lhs: 'jk',
      rhs: '<Esc>',
      noremap: false,
    });
    expect(parsed.commands[1]).toEqual({
      line: 3,
      kind: 'map',
      contexts: ['normal'],
      lhs: '<Leader>r',
      rhs: ':run<CR>',
      noremap: false,
    });
    expect(parsed.commands[10]).toEqual({
      line: 12,
      kind: 'map',
      contexts: ['normal'],
      lhs: '<C-h>',
      rhs: ':focus left<CR>',
      noremap: false,
    });
    expect(parsed.commands[14]).toEqual({
      line: 16,
      kind: 'set',
      name: 'rnu',
      value: true,
    });
  });

  it('knows the map family, their contexts and noremap', () => {
    const text = [
      'map a b',
      'noremap c d',
      'nmap e f',
      'nnoremap g h',
      'imap i j',
      'inoremap k l',
      'vmap m n',
      'vnoremap o p',
    ].join('\n');
    const { commands, errors } = parseVimrc(text);
    expect(errors).toEqual([]);
    expect(
      commands.map((c) =>
        c.kind === 'map'
          ? [c.contexts.join(','), c.lhs, c.rhs, c.noremap]
          : c.kind,
      ),
    ).toEqual([
      ['normal,visual', 'a', 'b', false],
      ['normal,visual', 'c', 'd', true],
      ['normal', 'e', 'f', false],
      ['normal', 'g', 'h', true],
      ['insert', 'i', 'j', false],
      ['insert', 'k', 'l', true],
      ['visual', 'm', 'n', false],
      ['visual', 'o', 'p', true],
    ]);
  });

  it('keeps spaces inside the right-hand side and expands <leader> in either side', () => {
    const { commands } = parseVimrc(
      'nmap <C-h>   :focus left<CR>\nnmap <leader>x i<LEADER><Esc>',
    );
    expect(commands).toMatchObject([
      { lhs: '<C-h>', rhs: ':focus left<CR>' },
      { lhs: '<Leader>x', rhs: 'i<Leader><Esc>' },
    ]);
    expect(expandLeader('<leader><Leader><LEADER>')).toBe(
      '<Leader><Leader><Leader>',
    );
  });

  it('parses unmap, set, noset, set=value, let mapleader, comments and blank lines', () => {
    const text = [
      '" a comment',
      '',
      '   ',
      'unmap jk',
      'iunmap jj',
      'set nu',
      'set nowrap',
      'set bg=dark',
      "let mapleader = ','",
    ].join('\n');
    const parsed = parseVimrc(text);
    expect(parsed.errors).toEqual([]);
    expect(parsed.leader).toBe(',');
    expect(parsed.commands).toEqual([
      { line: 4, kind: 'unmap', contexts: ['normal', 'visual'], lhs: 'jk' },
      { line: 5, kind: 'unmap', contexts: ['insert'], lhs: 'jj' },
      { line: 6, kind: 'set', name: 'nu', value: true },
      { line: 7, kind: 'set', name: 'wrap', value: false },
      { line: 8, kind: 'set', name: 'bg', value: 'dark' },
    ]);
    expect(parseVimrc('').leader).toBe('\\');
  });

  it('reports each bad line with its number and keeps the good lines', () => {
    const text = [
      'imap jk <Esc>',
      'foo bar',
      'nmap onlyone',
      'set',
      'set rnu nu',
      'let g:x = 1',
      'let mapleader = ',
      'unmap',
      'set rnu!',
      'nmap gd :def<CR>',
    ].join('\n');
    const { commands, errors } = parseVimrc(text);
    expect(errors).toEqual([
      { line: 2, text: 'foo bar', message: 'unknown command "foo"' },
      {
        line: 3,
        text: 'nmap onlyone',
        message: 'nmap needs a key and what it maps to',
      },
      { line: 4, text: 'set', message: 'set needs exactly one option' },
      { line: 5, text: 'set rnu nu', message: 'set needs exactly one option' },
      {
        line: 6,
        text: 'let g:x = 1',
        message: 'let supports only mapleader = "<key>"',
      },
      {
        line: 7,
        text: 'let mapleader =',
        message: 'let supports only mapleader = "<key>"',
      },
      { line: 8, text: 'unmap', message: 'unmap needs exactly one key' },
      { line: 9, text: 'set rnu!', message: 'set does not understand "rnu!"' },
    ]);
    expect(commands.map((c) => c.line)).toEqual([1, 10]);
    expect(formatVimrcError(errors[0] as (typeof errors)[number])).toBe(
      'vimrc line 2: unknown command "foo"',
    );
  });
});

describe('applyVimrc (§4: parsed into Vim.map, Vim.unmap and option calls)', () => {
  it('clears every context, re-applies the defaults with the leader, then the lines in order', () => {
    const { vim, calls } = fakeVim();
    const defaults: string[] = [];
    const errors = applyVimrc(parseVimrc(SHIPPED_VIMRC), vim, (leader) => {
      defaults.push(leader);
      calls.push('defaults');
    });
    expect(errors).toEqual([]);
    expect(defaults).toEqual(['<Space>']);
    expect(calls.slice(0, 5)).toEqual([
      'mapclear normal',
      'mapclear visual',
      'mapclear insert',
      'defaults',
      'map insert jk <Esc>',
    ]);
    expect(calls).toContain('map normal <Leader>r :run<CR>');
    expect(calls).toContain('map normal <C-l> :focus right<CR>');
    expect(calls.at(-1)).toBe('set rnu true');
  });

  it('maps in every context the command names, uses noremap for the noremap family, unmaps, and sets values', () => {
    const { vim, calls } = fakeVim();
    const parsed = parseVimrc(
      'map a b\nnnoremap c d\nunmap a\nset nonu\nset bg=light',
    );
    expect(applyVimrc(parsed, vim, () => undefined)).toEqual([]);
    expect(calls.slice(3)).toEqual([
      'map normal a b',
      'map visual a b',
      'noremap normal c d',
      'unmap normal a',
      'unmap visual a',
      'set nu false',
      'set bg light',
    ]);
  });

  it('reports what the engine refuses with the line number, and still applies the rest', () => {
    const { vim, calls } = fakeVim();
    const parsed = parseVimrc(
      'imap jk <Esc>\nset foo\nunmap zz\nbogus\nnmap gd :def<CR>',
    );
    const errors = applyVimrc(parsed, vim, () => undefined);
    expect(errors).toEqual([
      { line: 2, text: 'set foo', message: 'Unknown option: foo' },
      { line: 3, text: 'unmap zz', message: 'no such mapping: zz' },
      { line: 4, text: 'bogus', message: 'unknown command "bogus"' },
    ]);
    expect(calls).toContain('map insert jk <Esc>');
    expect(calls).toContain('map normal gd :def<CR>');
  });
});

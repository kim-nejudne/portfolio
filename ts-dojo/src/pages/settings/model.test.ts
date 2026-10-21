// The Settings page's pure parts (§7 settings, §12 F10): what the relative-numbers box shows
// when nothing is stored, the number fields' parsing, and the compiler-defaults text before the
// worker's check.
import { describe, expect, it } from 'vitest';
import { SHIPPED_VIMRC } from '@/editor/vimrc';
import {
  compilerDefaultsText,
  effectiveRelativeNumbers,
  parseCompilerDefaultsText,
  parseFontSize,
  parseTimeout,
  vimrcToStore,
} from './model';

describe('effectiveRelativeNumbers', () => {
  it('is the stored value when there is one', () => {
    expect(effectiveRelativeNumbers({ relativeNumbers: false })).toBe(false);
    expect(
      effectiveRelativeNumbers({ relativeNumbers: true, vimrc: 'set nornu' }),
    ).toBe(true);
  });

  it('otherwise follows the last rnu or relativenumber line of the vimrc in force, the shipped one by default', () => {
    expect(SHIPPED_VIMRC).toContain('set rnu');
    expect(effectiveRelativeNumbers({})).toBe(true);
    expect(effectiveRelativeNumbers({ vimrc: 'set rnu\nset nornu' })).toBe(
      false,
    );
    expect(
      effectiveRelativeNumbers({ vimrc: 'set norelativenumber\nset rnu' }),
    ).toBe(true);
    expect(effectiveRelativeNumbers({ vimrc: 'imap jk <Esc>' })).toBe(false);
  });
});

describe('parseFontSize and parseTimeout', () => {
  it('accept a whole number in range, written with or without spaces', () => {
    expect(parseFontSize('18')).toEqual({ ok: true, value: 18 });
    expect(parseFontSize(' 10 ')).toEqual({ ok: true, value: 10 });
    expect(parseTimeout('1500')).toEqual({ ok: true, value: 1500 });
    expect(parseTimeout('60000')).toEqual({ ok: true, value: 60_000 });
  });

  it('refuse anything else with the range in the message', () => {
    for (const text of ['', '9', '25', '14.5', 'big', '1e1']) {
      expect(parseFontSize(text)).toEqual({
        ok: false,
        error: 'a whole number of px from 10 to 24',
      });
    }
    for (const text of ['', '499', '60001', '1000.5', '5 s']) {
      expect(parseTimeout(text)).toEqual({
        ok: false,
        error: 'a whole number of ms from 500 to 60000',
      });
    }
  });
});

describe('parseCompilerDefaultsText', () => {
  it('reads an object, and blank text as no defaults', () => {
    expect(
      parseCompilerDefaultsText('{ "noUncheckedIndexedAccess": true }'),
    ).toEqual({ ok: true, value: { noUncheckedIndexedAccess: true } });
    expect(parseCompilerDefaultsText('  \n')).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('lists why it cannot be the defaults: not JSON, not an object, a bad value, a key ts-dojo owns', () => {
    const bad = parseCompilerDefaultsText('{ strict: true }');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatch(/^not valid JSON: /);
    expect(parseCompilerDefaultsText('[]')).toEqual({
      ok: false,
      errors: [
        'compiler defaults must be a JSON object, like the compilerOptions of a tsconfig.json',
      ],
    });
    expect(
      parseCompilerDefaultsText('{ "module": "commonjs", "strict": null }'),
    ).toEqual({
      ok: false,
      errors: [
        'module is fixed by ts-dojo: code runs in the sandbox as ES modules, without tslib',
        'strict must be true or false, a number, a string or a list of strings',
      ],
    });
  });

  it('round-trips the stored value through the text the page shows', () => {
    const value = { noUncheckedIndexedAccess: true, lib: ['es2025', 'dom'] };
    expect(parseCompilerDefaultsText(compilerDefaultsText(value))).toEqual({
      ok: true,
      value,
    });
    expect(compilerDefaultsText(undefined)).toBe('');
  });
});

describe('vimrcToStore', () => {
  it('stores nothing for the shipped text, so a later shipped change still applies', () => {
    expect(vimrcToStore(SHIPPED_VIMRC)).toBeUndefined();
    expect(vimrcToStore('imap kj <Esc>\n')).toBe('imap kj <Esc>\n');
  });
});

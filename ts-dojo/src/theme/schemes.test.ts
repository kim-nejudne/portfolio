// The scheme registry (src/theme/schemes/): nine families, each with a light and a dark palette
// of six-digit hex values, unique ids fit for a data attribute, and a default that exists; the
// generated stylesheet carries every token for every scheme and mode.
import { describe, expect, it } from 'vitest';
import { ANSI_NAMES, ansiPropertyName } from './palette';
import { paletteDeclarations, schemesCss, schemeSelector } from './css';
import {
  DEFAULT_SCHEME,
  SCHEME_IDS,
  SCHEMES,
  isSchemeId,
  schemeFor,
} from './schemes';

const HEX = /^#[0-9a-f]{6}$/;

describe('the scheme registry', () => {
  it('has the nine families, in picker order, with unique hyphenated ids', () => {
    expect(SCHEME_IDS).toEqual([
      'catppuccin',
      'gruvbox',
      'solarized',
      'tokyo-night',
      'one',
      'rose-pine',
      'github',
      'everforest',
      'dracula',
    ]);
    expect(new Set(SCHEME_IDS).size).toBe(SCHEMES.length);
    for (const id of SCHEME_IDS) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it('gives every palette lowercase six-digit hex values and a variant name', () => {
    for (const scheme of SCHEMES) {
      for (const palette of [scheme.light, scheme.dark]) {
        const label = `${scheme.id} ${palette.name}`;
        expect(palette.name.length, label).toBeGreaterThan(0);
        for (const [key, value] of Object.entries(palette)) {
          if (key === 'name' || key === 'ansi') continue;
          expect(value, `${label} ${key}`).toMatch(HEX);
        }
        for (const name of ANSI_NAMES) {
          expect(palette.ansi[name], `${label} ${name}`).toMatch(HEX);
        }
      }
    }
  });

  it('knows its ids and falls back to the default', () => {
    expect(isSchemeId('gruvbox')).toBe(true);
    expect(isSchemeId('Gruvbox')).toBe(false);
    expect(isSchemeId('sepia')).toBe(false);
    expect(isSchemeId(3)).toBe(false);
    expect(SCHEME_IDS).toContain(DEFAULT_SCHEME);
    expect(schemeFor('dracula').id).toBe('dracula');
    expect(schemeFor('nope').id).toBe(DEFAULT_SCHEME);
    expect(schemeFor(undefined).id).toBe(DEFAULT_SCHEME);
  });

  it('public/theme-init.js names the same default scheme', async () => {
    const { readFileSync } = await import('node:fs');
    const script = readFileSync(
      new URL('../../public/theme-init.js', import.meta.url),
      'utf8',
    );
    expect(script).toContain(`'${DEFAULT_SCHEME}'`);
  });
});

describe('the generated stylesheet', () => {
  const css = schemesCss();

  it('declares the eight terminal tokens and the sixteen ANSI colours per palette', () => {
    const lines = paletteDeclarations(SCHEMES[0]!.light);
    expect(lines).toHaveLength(8 + 16);
    expect(lines[0]).toBe(`--bg: ${SCHEMES[0]!.light.bg};`);
    expect(lines).toContain(
      `--${ansiPropertyName('brightBlack')}: ${SCHEMES[0]!.light.ansi.brightBlack};`,
    );
    expect(ansiPropertyName('brightBlack')).toBe('bright-black');
  });

  it('has one rule per scheme and mode, and the default also fills :root and :root.dark', () => {
    for (const scheme of SCHEMES) {
      expect(css).toContain(`${schemeSelector(scheme.id, 'light')} {`);
      expect(css).toContain(`${schemeSelector(scheme.id, 'dark')} {`);
    }
    expect(css).toContain(`:root,\n${schemeSelector(DEFAULT_SCHEME, 'light')}`);
    expect(css).toContain(
      `:root.dark,\n${schemeSelector(DEFAULT_SCHEME, 'dark')}`,
    );
    expect(css.match(/\{/g)?.length).toBe(SCHEMES.length * 2);
  });
});

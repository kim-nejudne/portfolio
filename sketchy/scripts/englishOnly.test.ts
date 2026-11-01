// F70: Sketchy is English only (DECISIONS 91). No second-language name, pack language value or
// retired copy key may come back anywhere in the code or data. F74 adds README.md, which describes
// the game; client/index.html is scanned with the rest of client/. (CLAUDE.md is gitignored, so a
// clean checkout has none to scan.) The patterns are built from pieces,
// as in `client/src/oldLook.test.ts`, so this file doesn't match itself (or a `grep` for them).
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['client', 'server', 'shared', 'data', 'scripts'];
const TEXT = /\.(tsx?|mjs|js|json|css|html|md|svg|sh|txt)$/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === 'node_modules' || e.name === 'dist'
        ? []
        : walk(join(dir, e.name))
      : [join(dir, e.name)],
  );
}

const DOCS = ['README.md'];

const files = [
  ...DIRS.flatMap((d) => walk(join(ROOT, d))).filter((f) => TEXT.test(f)),
  ...DOCS.map((f) => join(ROOT, f)),
];
const read = (f: string) => readFileSync(f, 'utf8');
const rel = (f: string) => relative(ROOT, f);

const NAMES = new RegExp(
  ['tag' + 'lish', 'taga' + 'log', 'fili' + 'pino', 'bar' + 'kada', 'pi' + 'noy'].join('|'),
  'i',
);

const TL = `['"]${'t' + 'l'}['"]`;
const TL_LANGUAGE = new RegExp(
  [
    `\\b(lang|language)['"]?\\s*(:|===?|!==?)\\s*${TL}`, // a language field set to it, in code or JSON
    `['"]en['"]\\s*,\\s*${TL}`, // an enum of both
    `['"]en['"]\\s*\\|\\s*${TL}`, // a union type of both
    `\\bdata/packs/${'t' + 'l'}-`, // a path to one of the removed packs
  ].join('|'),
);

const RETIRED_KEYS = new RegExp(
  `\\b(${[
    'award' + 'Bilis',
    'award' + 'MalapitNa',
    'preset' + 'Bar' + 'kadaNight',
    'setting' + 'Copy',
    'setting' + 'Words',
    'opt' + 'English',
    'opt' + 'Tag' + 'lish',
    'words' + 'En',
    'words' + 'Mixed',
    'words' + 'Tag' + 'lish',
    'COPY' + '_LANGUAGES',
    'WORDS' + '_CHOICES',
  ].join('|')})(Why|Note)?\\b`,
);

describe('English only (F70)', () => {
  it('scans the code and data of every part of the app', () => {
    for (const dir of DIRS)
      expect(
        files.some((f) => rel(f).startsWith(`${dir}/`)),
        dir,
      ).toBe(true);
    expect(files.length).toBeGreaterThan(200);
    expect(files.map(rel)).toContain('scripts/englishOnly.test.ts');
  });

  it('scans the README and the HTML page every phone loads first (F74)', () => {
    for (const f of [...DOCS, 'client/index.html']) expect(files.map(rel)).toContain(f);
    expect(read(join(ROOT, 'README.md'))).toMatch(/party drawing game for game nights/);
  });

  it('names no second language, group or demonym anywhere', () => {
    for (const f of files) expect(read(f), rel(f)).not.toMatch(NAMES);
  });

  it("has no 'tl' language value, type or pack path", () => {
    for (const f of files) expect(read(f), rel(f)).not.toMatch(TL_LANGUAGE);
  });

  it('uses none of the removed copy keys or setting lists', () => {
    for (const f of files) expect(read(f), rel(f)).not.toMatch(RETIRED_KEYS);
  });

  it('catches each pattern it is meant to catch', () => {
    // A guard that never fires proves nothing: each sample, built from pieces, must match.
    const t = 't' + 'l';
    for (const sample of [
      'Tag' + 'lish',
      'TAGA' + 'LOG',
      'Fili' + 'pino',
      'bar' + 'kada',
      'Pi' + 'noy',
    ])
      expect(sample).toMatch(NAMES);
    for (const sample of [
      `language: '${t}'`,
      `"language": "${t}"`,
      `lang === '${t}'`,
      `z.enum(['en', '${t}'])`,
      `lang: 'en' | '${t}' | 'custom'`,
      `data/packs/${t}-kitchen.json`,
    ])
      expect(sample).toMatch(TL_LANGUAGE);
    for (const sample of [
      'award' + 'BilisWhy',
      "t('opt" + 'Tag' + "lish')",
      'settings.' + 'setting' + 'Words',
    ])
      expect(sample).toMatch(RETIRED_KEYS);
    // …and the top-left tape (`place="tl"`), "wordsReshuffled" and "settingsSummary" stay legal.
    for (const legal of [
      `<Tape place="${t}" />`,
      `'${t}' | 'tr'`,
      'wordsReshuffled',
      'settingsSummary',
    ])
      expect(legal).not.toMatch(
        new RegExp([NAMES, TL_LANGUAGE, RETIRED_KEYS].map((r) => r.source).join('|')),
      );
  });
});

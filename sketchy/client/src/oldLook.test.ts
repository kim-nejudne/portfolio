// F67: the old dark look is gone from the whole client, not just the restyled files. The
// patterns are built from pieces so this file doesn't match itself (or a `grep` for them).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));
const CLIENT = dirname(SRC);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const files = walk(SRC);
const text = files.filter((f) => /\.(tsx?|css|html)$/.test(f));
const read = (f: string) => readFileSync(f, 'utf8');
const rel = (f: string) => relative(CLIENT, f);

const OLD_LOOK = new RegExp(
  ['#1D1B' + '22', '#FF6B' + '35', '#FFD1' + '66', 'Fred' + 'oka', 'white' + '/[0-9]'].join('|'),
);

describe('the old look (F67)', () => {
  it('leaves no old background, orange, gold, display face or white/NN anywhere in client/src', () => {
    expect(text.length).toBeGreaterThan(50);
    for (const f of text) expect(read(f), rel(f)).not.toMatch(OLD_LOOK);
  });

  it('ships two faces: no old font file, licence, preload or @font-face', () => {
    const fonts = files.filter((f) => f.includes(`${join('src', 'fonts')}`)).map(rel);
    expect(fonts.sort()).toEqual([
      'src/fonts/OFL-Nunito.txt',
      'src/fonts/OFL-PatrickHand.txt',
      'src/fonts/nunito-latin-900.woff2',
      'src/fonts/patrick-hand-latin-400.woff2',
    ]);
    const html = read(join(CLIENT, 'index.html'));
    expect(html.match(/rel="preload"/g)).toHaveLength(2);
    expect(html).not.toMatch(OLD_LOOK);
    const css = read(join(SRC, 'index.css'));
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).not.toMatch(/--font-display|legacy-/);
  });

  it('keeps every component to the sketchbook tokens: no hex or rgb, no white, black or greys, no old weights', () => {
    const components = files.filter((f) => f.endsWith('.tsx') && !f.includes('.test.'));
    expect(components.length).toBeGreaterThan(30);
    for (const f of components) {
      expect(read(f), rel(f)).not.toMatch(
        /#[0-9A-Fa-f]{3,8}\b|\b(text|bg|border|ring|shadow|fill|stroke|outline)-(white|black|slate|gray|zinc|neutral|stone)\b|\brgba?\(|font-display|font-bold|font-semibold|legacy-/,
      );
    }
  });
});

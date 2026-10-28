import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import svgSource from '../public/favicon.svg?raw';
import css from './index.css?raw';

/** The value of a `@theme` colour token in index.css. */
function token(css: string, name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(css);
  if (!match) throw new Error(`no --color-${name} in index.css`);
  return match[1]!.toLowerCase();
}

describe('Favicon', () => {
  const svg = svgSource.toLowerCase();

  it('index.html links the SVG icon, so browsers do not ask for /favicon.ico', () => {
    const link = /<link\b[^>]*\brel="icon"[^>]*>/.exec(html)?.[0];
    expect(link).toContain('href="/favicon.svg"');
    expect(link).toContain('type="image/svg+xml"');
  });

  it('is a round buzz-red button on the dark base, in the theme colours', () => {
    expect(svg).toContain('<circle');
    expect(svg).toContain(`fill="${token(css, 'buzz')}"`);
    expect(svg).toContain(`stroke="${token(css, 'buzz-edge')}"`);
    expect(svg).toContain(`<rect width="64" height="64" rx="14" fill="${token(css, 'bg')}"`);
  });
});

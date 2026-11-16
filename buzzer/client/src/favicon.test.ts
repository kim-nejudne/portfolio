import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import svgSource from '../public/favicon.svg?raw';
import { tokenHex } from './test/oklch.js';

describe('Favicon', () => {
  const svg = svgSource.toLowerCase();

  it('index.html links the SVG icon, so browsers do not ask for /favicon.ico', () => {
    const link = /<link\b[^>]*\brel="icon"[^>]*>/.exec(html)?.[0];
    expect(link).toContain('href="/favicon.svg"');
    expect(link).toContain('type="image/svg+xml"');
  });

  it('is the red buzzer in its round ink base on square newsprint, in the theme colours', () => {
    expect(svg).toContain(`<rect width="64" height="64" fill="${tokenHex('paper')}"`);
    expect(svg).toContain(`<circle cx="32" cy="34" r="22" fill="${tokenHex('ink')}"`);
    expect(svg).toContain(`fill="${tokenHex('buzz')}"`);
  });

  it('colours the browser chrome with the newsprint', () => {
    expect(html).toContain(`<meta name="theme-color" content="${tokenHex('paper')}" />`);
  });
});

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

  it('is a round peach buzzer with a deeper peach rim on the green paper, in the theme colours', () => {
    expect(svg).toContain('<circle');
    expect(svg).toContain(`fill="${tokenHex('accent')}"`);
    expect(svg).toContain(`stroke="${tokenHex('accent-2')}"`);
    expect(svg).toContain(`<rect width="64" height="64" rx="14" fill="${tokenHex('paper')}"`);
  });

  it('colours the browser chrome with the paper green', () => {
    expect(html).toContain(`<meta name="theme-color" content="${tokenHex('paper')}" />`);
  });
});

// The Sketchbook landing (F57): markup only. The look and the fit at 360×560 are checked by the
// F57 playtest against the mockup; the join and start behaviour is the same code as before.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InkReplay } from '../components/sketch/InkReplay.js';
import { MemoryRouter } from '../lib/router.js';
import { cleanCode, CodeCells, Landing } from './Landing.js';

const landing = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );

describe('the landing page (F57)', () => {
  it('has the logo, the tag line with "Laugh." on the highlighter, and both cards', () => {
    const html = landing();
    expect(html).toMatch(/<h1[^>]*>Sketchy<span aria-hidden="true"/);
    expect(html).toContain('Draw it. Guess it. <span class="highlight">Laugh.</span>');
    expect(html).toContain('>Join a game</label>');
    expect(html).toContain('Start a game on this screen</h2>');
    expect(html).toContain('a laptop on the TV, a tablet, or a spare phone');
    expect(html.match(/data-tape="top"/g)).toHaveLength(2);
    expect(html).toContain('data-rings="row"');
  });

  it('keeps one real code input, labelled and uppercase, over 4 hidden cells', () => {
    const html = landing();
    expect(html.match(/<input /g)).toHaveLength(1);
    expect(html).toContain('id="code"');
    expect(html).toContain('autoCapitalize="characters"');
    expect(html).toContain('aria-describedby="join-error"');
    expect(html.match(/<span aria-hidden="true" data-code-cell="true"/g)).toHaveLength(4);
  });

  it('Join is a primary sketch button that waits for 4 letters; Start is a ghost one', () => {
    const html = landing();
    expect(html).toMatch(
      /<button type="submit" data-variant="primary" [^>]*disabled=""[^>]*>Join</,
    );
    expect(html).toMatch(/<button type="button" data-variant="ghost" [^>]*>Start</);
  });

  it('draws the ink replay for the laptop columns only', () => {
    const html = landing();
    expect(html).toMatch(/<div class="hidden lg:block"><svg aria-hidden="true" data-ink-replay/);
  });
});

describe('the code field', () => {
  it('auto-uppercases and keeps only code letters, 4 at most', () => {
    expect(cleanCode('kp')).toBe('KP');
    expect(cleanCode('kp1rw')).toBe('KPRW');
    expect(cleanCode(' k-p r w x')).toBe('KPRW');
    // No I, L or O in a room code.
    expect(cleanCode('ilok')).toBe('K');
  });
});

describe('the code cells', () => {
  const cells = (code: string) =>
    renderToStaticMarkup(
      <CodeCells code={code}>
        <input />
      </CodeCells>,
    );

  it('show the letters typed so far, one per cell, and a caret in the next one', () => {
    const html = cells('KP');
    const letters = [...html.matchAll(/data-code-cell="true" class="[^"]*">([A-Z]?)/g)].map(
      (m) => m[1],
    );
    expect(letters).toEqual(['K', 'P', '', '']);
    expect(html.match(/animate-blink/g)).toHaveLength(1);
  });

  it('show no caret once all 4 are in', () => {
    expect(cells('KPRW')).not.toContain('animate-blink');
  });
});

describe('InkReplay', () => {
  it('is hidden decoration that draws on only when motion is allowed', () => {
    const html = renderToStaticMarkup(<InkReplay />);
    expect(html).toContain('aria-hidden="true"');
    const paths = [...html.matchAll(/<path [^>]*>/g)].map((m) => m[0]);
    expect(paths).toHaveLength(6);
    for (const path of paths) {
      expect(path).toContain('pathLength="1"');
      // Every animation class sits behind motion-safe, so reduced motion gets the whole drawing.
      expect(path).toMatch(
        /class="motion-safe:animate-ink-draw motion-safe:\[stroke-dasharray:1_2\]"/,
      );
    }
  });
});

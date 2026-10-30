import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { ScreenView, TurnEndReason, TurnView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import { NO_FX, type ScreenFxState } from '../../lib/screenFx.js';
import { createScreenInk } from '../../lib/ink.js';
import { Blanks, RevealPanel, ScreenTurn } from './ScreenTurn.js';

const t = translator('en');

function reveal(endReason: TurnEndReason): { view: ScreenView; turn: TurnView } {
  const turn: TurnView = {
    id: 3,
    number: 1,
    cycle: 1,
    drawerPid: 'mika',
    drawerName: 'Mika',
    timer: null,
    mask: null,
    word: 'banana',
    correct: [{ pid: 'jun', points: 270, order: 1 }],
    guessed: { guessed: 1, of: 1 },
    endReason,
  };
  const chip = (pid: string, name: string) => ({
    pid,
    name,
    color: '#FF6B35',
    connected: true,
    crown: false,
    isDrawer: pid === 'mika',
    hasDoodle: false,
    guessed: pid === 'jun',
    turnPoints: pid === 'jun' ? 270 : 135,
    score: null,
    rank: null,
  });
  const view: ScreenView = {
    role: 'screen',
    code: 'KPRW',
    phase: 'REVEAL',
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS },
    players: [chip('mika', 'Mika'), chip('jun', 'Jun')],
    turn,
    host: null,
    feed: [],
    closeGuesses: [],
    awards: [],
    gallery: [],
    tonight: null,
  };
  return { view, turn };
}

describe('Screen reveal (F19)', () => {
  it('says "Everyone got it!" after an early end, with the 🎉 hidden from screen readers', () => {
    const html = renderToStaticMarkup(<RevealPanel {...reveal('allGuessed')} t={t} />);
    expect(html).toContain('Everyone got it!');
    expect(html).toContain('<span aria-hidden="true">🎉</span>');
  });

  it('says nothing of the kind when time ran out', () => {
    const html = renderToStaticMarkup(<RevealPanel {...reveal('time')} t={t} />);
    expect(html).not.toContain('Everyone got it!');
  });
});

describe('Screen blanks', () => {
  it('shows hint letters in place and names them in the label', () => {
    const html = renderToStaticMarkup(<Blanks mask={[...'_a___s__']} />);
    expect(html).toContain('aria-label="8 letters. Hints: a, s"');
    expect(html).toMatch(/<span class="[^"]*">a<\/span>/);
  });

  it('pops a hint letter in (F34), and only letters', () => {
    const html = renderToStaticMarkup(<Blanks mask={[...'_a__-_']} />);
    expect(html).toContain('<span class="inline-block motion-safe:animate-pop">a</span>');
    expect(html).toContain('<span>_</span>');
    expect(html).toContain('<span>-</span>');
  });

  it('puts the letter counts after the blanks', () => {
    const html = renderToStaticMarkup(<Blanks mask={[...'_____ ____']} />);
    expect(html).toMatch(/_<\/span><\/span><span[^>]*>\(5, 4\)<\/span><\/p>$/);
  });

  it('labels plain blanks with the letter counts only', () => {
    const html = renderToStaticMarkup(<Blanks mask={[...'_____ ____']} />);
    expect(html).toContain('aria-label="5, 4 letters"');
  });
});

describe('first-turn captions (F26)', () => {
  const FIRST = 'Mika is drawing. Everyone else: type your guess on your phone 🤫';
  const SECOND = 'Type your guess. Don’t say it! 🤫';
  const render = (phase: ScreenView['phase'], number: number) => {
    const { view, turn } = reveal('time');
    const live: TurnView = { ...turn, number, word: null, mask: [...'______'], endReason: null };
    return renderToStaticMarkup(
      <ScreenTurn
        view={{ ...view, phase, turn: live }}
        receivedAt={0}
        ink={createScreenInk()}
        layout="landscape"
        t={t}
      />,
    );
  };

  it('shows the rule under the drawing on the first turn and the reminder on the second', () => {
    const first = render('DRAWING', 1);
    expect(first).toContain(FIRST);
    // Under the square (after the canvas), not over it, and before the sidebar.
    expect(first.indexOf(FIRST)).toBeGreaterThan(first.indexOf('<canvas'));
    expect(first.indexOf(FIRST)).toBeLessThan(first.indexOf('<aside'));
    expect(render('DRAWING', 2)).toContain(SECOND);
  });

  it('has no caption from the third turn on', () => {
    const html = render('DRAWING', 3);
    expect(html).not.toContain('🤫');
  });

  it('keeps the row but no text while choosing and at the reveal', () => {
    for (const phase of ['CHOOSING', 'REVEAL'] as const) {
      const html = render(phase, 1);
      expect(html).not.toContain('🤫');
      expect(html).toContain('line-clamp-2');
    }
    expect(render('REVEAL', 3)).not.toContain('line-clamp-2');
  });
});

describe('portrait Screen layout (F33)', () => {
  const drawing = (number = 3): ScreenView => {
    const { view, turn } = reveal('time');
    return {
      ...view,
      phase: 'DRAWING',
      turn: { ...turn, number, word: null, mask: [...'______'], endReason: null },
      feed: [
        { pid: 'jun', text: 'payong' },
        { pid: 'jun', text: 'sapatos' },
        { pid: 'jun', text: 'tsinelas' },
      ],
    };
  };
  const render = (view: ScreenView, layout: 'landscape' | 'portrait') =>
    renderToStaticMarkup(
      <ScreenTurn view={view} receivedAt={0} ink={createScreenInk()} layout={layout} t={t} />,
    );

  it('puts the timer and blanks above the drawing, and the players and guesses under it', () => {
    const html = render(drawing(), 'portrait');
    const canvas = html.indexOf('<canvas');
    expect(html).not.toContain('<aside');
    expect(html.indexOf('role="timer"')).toBeLessThan(canvas);
    expect(html.indexOf('aria-label="6 letters"')).toBeLessThan(canvas);
    expect(html.indexOf('>Mika<')).toBeGreaterThan(canvas);
    expect(html.indexOf('>Jun<')).toBeGreaterThan(canvas);
  });

  it('marks the drawer with ✏️ and a correct guesser with ✓ and this turn’s points', () => {
    const html = render(drawing(), 'portrait');
    expect(html).toMatch(/✏️<\/span>.*>Mika</);
    expect(html).toMatch(/✓<\/span>.*>Jun<\/span><span class="tabular-nums">\+270</);
  });

  it('keeps only the two latest guesses', () => {
    const html = render(drawing(), 'portrait');
    expect(html).not.toContain('payong');
    expect(html).toContain('sapatos');
    expect(html).toContain('tsinelas');
  });

  it('shows a masked guess as ••• in the portrait feed', () => {
    const view = drawing();
    const html = render({ ...view, feed: [...view.feed, { pid: 'jun', text: null }] }, 'portrait');
    expect(html).toContain('•••');
    expect(html).not.toContain('sapatos');
  });

  it('drops the round and turn numbers in portrait only', () => {
    expect(render(drawing(), 'portrait')).not.toContain('Round 1/');
    expect(render(drawing(), 'landscape')).toContain('Round 1/');
  });

  it('keeps the caption under the drawing in portrait', () => {
    const html = render(drawing(1), 'portrait');
    const caption = html.indexOf('Mika is drawing. Everyone else');
    expect(caption).toBeGreaterThan(html.indexOf('<canvas'));
  });

  it('says "It was…" above the drawing and shows the word under it at the reveal', () => {
    const { view } = reveal('time');
    const html = render(view, 'portrait');
    const canvas = html.indexOf('<canvas');
    expect(html.indexOf('It was…')).toBeLessThan(canvas);
    expect(html.indexOf('>banana<')).toBeGreaterThan(canvas);
    expect(html).toContain('Got it');
  });
});

describe('announcements, chips and feed (F34)', () => {
  const drawing = (feed: ScreenView['feed'] = []): ScreenView => {
    const { view, turn } = reveal('time');
    return {
      ...view,
      phase: 'DRAWING',
      turn: { ...turn, number: 3, word: null, mask: [...'______'], endReason: null },
      feed,
    };
  };
  const render = (view: ScreenView, layout: 'landscape' | 'portrait', fx: ScreenFxState = NO_FX) =>
    renderToStaticMarkup(
      <ScreenTurn
        view={view}
        receivedAt={0}
        ink={createScreenInk()}
        layout={layout}
        fx={fx}
        t={t}
      />,
    );
  const junGotIt: ScreenFxState = { ...NO_FX, gotIt: [{ id: 1, pid: 'jun' }] };

  it('says "Jun got it!" in Jun’s colour in the sidebar, in place of "Mika is drawing"', () => {
    const html = render(drawing(), 'landscape', junGotIt);
    expect(html).toMatch(
      /role="status"[^>]*><p[^>]*><span style="color:#FF6B35">Jun<\/span> got it!<\/p>/,
    );
    expect(html.indexOf('got it!')).toBeGreaterThan(html.indexOf('<aside'));
    expect(html).not.toContain('Mika is drawing');
    expect(render(drawing(), 'landscape')).toContain('Mika is drawing');
  });

  it('says it in the portrait top bar, above the drawing, in place of the blanks', () => {
    const html = render(drawing(), 'portrait', junGotIt);
    expect(html.indexOf('got it!')).toBeLessThan(html.indexOf('<canvas'));
    expect(html).not.toContain('aria-label="6 letters"');
  });

  it('names everyone who got it within the 2 s', () => {
    const fx = {
      ...NO_FX,
      gotIt: [
        { id: 1, pid: 'jun' },
        { id: 2, pid: 'mika' },
      ],
    };
    expect(render(drawing(), 'landscape', fx)).toMatch(
      />Jun<\/span>, <span[^>]*>Mika<\/span> got it!/,
    );
  });

  it('keeps a correct guesser’s chip lit and marks every chip for bubbles and reactions', () => {
    for (const layout of ['landscape', 'portrait'] as const) {
      const html = render(drawing(), layout);
      expect(html).toMatch(/<li data-chip="jun" class="[^"]*bg-\[#2DC653\]\/20/);
      expect(html).toMatch(/<li data-chip="mika" class="(?![^"]*bg-\[#2DC653\])/);
    }
  });

  it('shows the last 8 wrong guesses in the sidebar, newest last, and 2 in portrait', () => {
    const feed = Array.from({ length: 8 }, (_, i) => ({ pid: 'jun', text: `guess${i + 2}` }));
    const landscape = render(drawing(feed), 'landscape');
    for (let i = 2; i < 10; i++) expect(landscape).toContain(`guess${i}<`);
    expect(landscape.indexOf('guess2<')).toBeLessThan(landscape.indexOf('guess9<'));
    const portrait = render(drawing(feed), 'portrait');
    expect(portrait).not.toContain('guess7<');
    expect(portrait).toContain('guess8<');
    expect(portrait).toContain('guess9<');
  });

  it('draws no bubbles or reactions over the drawing: the layer sits in the sidebar or the room', () => {
    for (const layout of ['landscape', 'portrait'] as const) {
      const html = render(drawing(), layout);
      const layer = html.indexOf('pointer-events-none absolute inset-0');
      expect(layer).toBeGreaterThan(html.indexOf('<canvas'));
      expect(html.slice(0, layer)).toMatch(
        /<(aside|section) class="[^"]*relative[^"]*overflow-hidden/,
      );
    }
  });
});

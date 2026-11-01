import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { ScreenView, TurnEndReason, TurnView } from '../../../../shared/types.js';
import { t } from '../../lib/copy.js';
import { NO_FX, type ScreenFxState } from '../../lib/screenFx.js';
import { createScreenInk } from '../../lib/ink.js';
import { Blanks } from '../sketch/Blanks.js';
import { blanksLabel, RevealPanel, ScreenTurn } from './ScreenTurn.js';

// The turn sits in the notebook (F64), whose code strip reads the address from `window`.
beforeAll(() => {
  vi.stubGlobal('window', {
    location: { host: 'sketchy.kimnejudne.dev', origin: 'https://sketchy.kimnejudne.dev' },
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

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
    drawerReconnecting: false,
  };
  const chip = (pid: string, name: string) => ({
    pid,
    name,
    color: '#C2410C',
    connected: true,
    crown: false,
    isDrawer: pid === 'mika',
    avatar: '🦊' as const,
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
    almost: [],
    awards: [],
    gallery: [],
    tonight: null,
    nextDrawer: null,
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

describe('the reveal (F35)', () => {
  const html = (view: ScreenView, layout: 'landscape' | 'portrait' = 'landscape') =>
    renderToStaticMarkup(
      <ScreenTurn view={view} receivedAt={0} ink={createScreenInk()} layout={layout} t={t} />,
    );
  const text = (markup: string) => markup.replace(/<[^>]+>/g, '');

  it('grows the word in, motion permitting', () => {
    const markup = renderToStaticMarkup(<RevealPanel {...reveal('time')} t={t} />);
    expect(markup).toMatch(/<p class="[^"]*motion-safe:animate-reveal[^"]*"[^>]*>banana<\/p>/);
  });

  it('ends the turn’s speech bubbles, since "Almost:" lists the guesses', () => {
    const { view } = reveal('time');
    const fx: ScreenFxState = { ...NO_FX, bubbles: [{ id: 1, pid: 'jun', text: 'kahapon' }] };
    for (const layout of ['landscape', 'portrait'] as const) {
      const markup = renderToStaticMarkup(
        <ScreenTurn
          view={view}
          receivedAt={0}
          ink={createScreenInk()}
          layout={layout}
          fx={fx}
          t={t}
        />,
      );
      expect(markup, layout).not.toContain('kahapon');
    }
  });

  it('lists who got it in corrected order, with their points', () => {
    const { view, turn } = reveal('time');
    const correct = [
      { pid: 'ana', points: 225, order: 2 },
      { pid: 'jun', points: 270, order: 1 },
    ];
    const ana = { ...view.players[1]!, pid: 'ana', name: 'Ana', turnPoints: 225 };
    const out = text(
      renderToStaticMarkup(
        <RevealPanel
          view={{ ...view, players: [...view.players, ana] }}
          turn={{ ...turn, correct }}
          t={t}
        />,
      ),
    );
    expect(out).toContain('Got it🦊Jun+270🦊Ana+225'); // each name after its avatar (F53)
  });

  it('says "Almost:" with up to three guesses, masked ones as •••', () => {
    const { view } = reveal('time');
    const almost = [
      { pid: 'jun', text: 'bananas pls' },
      { pid: 'jun', text: null },
      { pid: 'jun', text: 'mango' },
    ];
    expect(text(html({ ...view, almost }))).toContain('Almost: bananas pls · ••• · mango');
    expect(text(html({ ...view, almost }, 'portrait'))).toContain('Almost: bananas pls');
    expect(html(view)).not.toContain('Almost:');
  });

  describe('when nobody got it', () => {
    const nobody = (): ScreenView => {
      const { view, turn } = reveal('time');
      return {
        ...view,
        turn: { ...turn, correct: [], guessed: { guessed: 0, of: 1 } },
        players: view.players.map((p) => ({ ...p, guessed: false, turnPoints: 0 })),
        almost: [{ pid: 'jun', text: 'mango' }],
      };
    };

    it('heads the reveal with "Nobody got it! 😱", above "It was…" and the word', () => {
      for (const layout of ['landscape', 'portrait'] as const) {
        const out = text(html(nobody(), layout));
        expect(out, layout).toMatch(/Nobody got it! 😱It was…/);
        expect(out.indexOf('banana'), layout).toBeGreaterThan(out.indexOf('It was…'));
      }
    });

    it('shows no points rows, but still what people tried', () => {
      for (const layout of ['landscape', 'portrait'] as const) {
        const out = text(html(nobody(), layout));
        expect(out, layout).not.toContain('Got it');
        expect(out, layout).not.toMatch(/\+\d/);
        expect(out, layout).toContain('Almost: mango');
      }
    });
  });

  it('shows the drawer line only above 0, and never a "+0"', () => {
    const { view, turn } = reveal('time');
    expect(text(html(view))).toContain('+135 for Mika’s drawing');
    const zero: ScreenView = {
      ...view,
      turn: { ...turn, correct: [{ pid: 'jun', points: 0, order: 1 }] },
      players: view.players.map((p) => ({ ...p, turnPoints: 0 })),
    };
    const out = text(html(zero));
    expect(out).toContain('Jun');
    expect(out).not.toContain('+0');
    expect(out).not.toContain('drawing');
  });
});

describe('Screen blanks', () => {
  // The Screen's blanks are the sketch primitive with `pop` and this label (F64).
  const blanks = (mask: string[]) =>
    renderToStaticMarkup(<Blanks mask={mask} label={blanksLabel(mask, t)} pop />);

  it('shows hint letters in place and names them in the label', () => {
    const html = blanks([...'_a___s__']);
    expect(html).toContain('aria-label="8 letters. Hints: a, s"');
    expect(html).toMatch(/<span class="[^"]*">a<\/span>/);
  });

  it('pops a hint letter in (F34), and only letters', () => {
    const html = blanks([...'_a__-_']);
    expect(html).toContain('<span class="inline-block motion-safe:animate-pop">a</span>');
    expect(html.match(/animate-pop/g)).toHaveLength(1);
    expect(html).toMatch(/data-blank="mark"[^>]*>-<\/span>/);
  });

  it('puts the letter counts after the blanks', () => {
    const html = blanks([...'_____ ____']);
    expect(html).toMatch(/<span[^>]*>\(5, 4\)<\/span><\/p><\/div>$/);
  });

  it('labels plain blanks with the letter counts only', () => {
    expect(blanks([...'_____ ____'])).toContain('aria-label="5, 4 letters"');
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
        { pid: 'jun', text: 'pillow' },
        { pid: 'jun', text: 'sandals' },
        { pid: 'jun', text: 'slippers' },
      ],
    };
  };
  const render = (view: ScreenView, layout: 'landscape' | 'portrait') =>
    renderToStaticMarkup(
      <ScreenTurn view={view} receivedAt={0} ink={createScreenInk()} layout={layout} t={t} />,
    );

  // F65: the top bar holds the timer, blanks, drawer line and latest guess; the players are the
  // index tabs along the bottom (was a strip and two guesses under the drawing).
  it('puts the timer, blanks, drawer line and latest guess above the drawing, the players under it', () => {
    const html = render(drawing(), 'portrait');
    const canvas = html.indexOf('<canvas');
    expect(html).not.toContain('<aside');
    expect(html.indexOf('role="timer"')).toBeLessThan(canvas);
    expect(html.indexOf('aria-label="6 letters"')).toBeLessThan(canvas);
    expect(html.indexOf('Mika is drawing')).toBeLessThan(canvas);
    expect(html.indexOf('slippers')).toBeLessThan(canvas);
    expect(html.indexOf('data-tab="mika"')).toBeGreaterThan(canvas);
    expect(html.indexOf('data-tab="jun"')).toBeGreaterThan(canvas);
  });

  it('marks the drawer with ✏️ and a correct guesser with ✓ and this turn’s points', () => {
    const html = render(drawing(), 'portrait');
    expect(html).toMatch(/<li data-tab="mika"[^]*?data-status="true" class="[^"]*">✏️</);
    expect(html).toMatch(/<li data-tab="jun"[^]*?data-status="true" class="[^"]*">✓ \+270</);
  });

  it('keeps only the latest guess', () => {
    const html = render(drawing(), 'portrait');
    expect(html).not.toContain('pillow');
    expect(html).not.toContain('sandals');
    expect(html).toContain('slippers');
  });

  it('shows a masked guess as ••• in the portrait feed', () => {
    const view = drawing();
    const html = render({ ...view, feed: [...view.feed, { pid: 'jun', text: null }] }, 'portrait');
    expect(html).toContain('•••');
    expect(html).not.toContain('sandals');
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

  // F65: the word joins "It was…" in the top bar (the mockup's portrait reveal); who got it goes
  // in the lane under the drawing (was the word under the drawing, DECISIONS 55).
  it('says "It was…" and the word above the drawing at the reveal, and who got it under it', () => {
    const { view } = reveal('time');
    const html = render(view, 'portrait');
    const canvas = html.indexOf('<canvas');
    expect(html.indexOf('It was…')).toBeLessThan(html.indexOf('>banana<'));
    expect(html.indexOf('>banana<')).toBeLessThan(canvas);
    expect(html.indexOf('Got it')).toBeGreaterThan(canvas);
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
      /role="status"[^>]*><p[^>]*><span style="color:#C2410C">Jun<\/span> got it!<\/p>/,
    );
    expect(html.indexOf('got it!')).toBeGreaterThan(html.indexOf('<aside'));
    expect(html).not.toContain('Mika is drawing');
    expect(render(drawing(), 'landscape')).toContain('Mika is drawing');
  });

  it('says it in the portrait top bar, above the drawing, in place of "Mika is drawing" (F65)', () => {
    const html = render(drawing(), 'portrait', junGotIt);
    expect(html.indexOf('got it!')).toBeLessThan(html.indexOf('<canvas'));
    expect(html).toContain('aria-label="6 letters"');
    expect(html).not.toContain('Mika is drawing');
    expect(render(drawing(), 'portrait')).toContain('Mika is drawing');
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

  it('marks the drawer’s tab with ✏️ and a correct guesser’s with ✓ and points, for the turn', () => {
    const html = render(drawing(), 'landscape');
    expect(html).toMatch(
      /<li data-tab="jun"[^]*?data-status="true" class="[^"]*text-success[^"]*">✓ \+270</,
    );
    expect(html).toMatch(/<li data-tab="mika"[^]*?data-status="true" class="[^"]*">✏️</);
    // Portrait (F65): the same tabs, along the bottom.
    const portrait = render(drawing(), 'portrait');
    expect(portrait).toContain('data-tabs="portrait"');
    expect(portrait).toMatch(
      /<li data-tab="jun"[^]*?data-status="true" class="[^"]*text-success[^"]*">✓ \+270</,
    );
  });

  it('shows the last 8 wrong guesses in the sidebar, newest last, and the latest in portrait', () => {
    const feed = Array.from({ length: 8 }, (_, i) => ({ pid: 'jun', text: `guess${i + 2}` }));
    const landscape = render(drawing(feed), 'landscape');
    for (let i = 2; i < 10; i++) expect(landscape).toContain(`guess${i}<`);
    expect(landscape.indexOf('guess2<')).toBeLessThan(landscape.indexOf('guess9<'));
    const portrait = render(drawing(feed), 'portrait');
    expect(portrait).not.toContain('guess8<');
    expect(portrait).toContain('guess9<');
  });

  it('draws no bubbles or reactions over the drawing', () => {
    // Landscape: the layer lies over the desk, after the book, and measures the tabs and the
    // right page (placeTabBubble keeps every bubble on that page: TurnFx.test).
    const land = render(drawing(), 'landscape');
    expect(land.indexOf('data-fx="tabs"')).toBeGreaterThan(land.indexOf('data-page="right"'));
    expect(land.indexOf('data-fx="tabs"')).toBeGreaterThan(land.indexOf('<canvas'));
    // Portrait (F65): the layer lies over the desk too and puts bubbles in the lane between the
    // drawing and the tabs (placeLaneBubble keeps every bubble in it: TurnFx.test).
    const html = render(drawing(), 'portrait');
    const lane = html.indexOf('data-bubble-lane');
    expect(lane).toBeGreaterThan(html.indexOf('<canvas'));
    expect(html.indexOf('data-fx="tabs"')).toBeGreaterThan(lane);
  });
});

describe('drawer reconnecting (F40)', () => {
  const BADGE = 'Mika’s phone reconnecting…';
  const render = (
    phase: 'CHOOSING' | 'DRAWING',
    drawerReconnecting: boolean,
    layout: 'landscape' | 'portrait',
  ) => {
    const { view, turn } = reveal('time');
    const live: TurnView = {
      ...turn,
      number: 3,
      word: null,
      mask: [...'______'],
      endReason: null,
      drawerReconnecting,
    };
    return renderToStaticMarkup(
      <ScreenTurn
        view={{ ...view, phase, turn: live }}
        receivedAt={0}
        ink={createScreenInk()}
        layout={layout}
        t={t}
      />,
    );
  };

  it('shows a small status badge over the drawing in both layouts and phases', () => {
    for (const layout of ['landscape', 'portrait'] as const)
      for (const phase of ['CHOOSING', 'DRAWING'] as const) {
        const html = render(phase, true, layout);
        expect(html, `${layout} ${phase}`).toContain(BADGE);
        expect(html).toMatch(/role="status"[^>]*><p[^>]*>Mika’s phone reconnecting…/);
      }
  });

  it('shows nothing while the drawer is here, with the status region already in place', () => {
    const html = render('DRAWING', false, 'landscape');
    expect(html).not.toContain('reconnecting');
    expect(html).toMatch(/<div role="status" aria-live="polite"[^>]*><\/div>/);
  });
});

// The Screen's landscape turn in the sketchbook (F64): the spread with the drawing taped onto the
// left page as the largest square, the right page's clock, round, blanks, drawer line, banner and
// feed, the tabs' ✏️ and "✓ +points", bubbles kept on the right page, and the mockup's motion.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { PlayerChipView, ScreenView, TurnView } from '../../../../shared/types.js';
import { t } from '../../lib/copy.js';
import { createScreenInk } from '../../lib/ink.js';
import { NO_FX, type ScreenFxState } from '../../lib/screenFx.js';
import { ScreenTurn } from './ScreenTurn.js';
import { PausedOverlay } from '../PausedOverlay.js';
import { blanksFontSize } from '../sketch/Blanks.js';
import { placeTabBubble } from './TurnFx.js';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

beforeAll(() => {
  vi.stubGlobal('window', {
    location: { host: 'sketchy.kimnejudne.dev', origin: 'https://sketchy.kimnejudne.dev' },
  });
});
afterAll(() => vi.unstubAllGlobals());

const chip = (pid: string, name: string, color: string, extra: Partial<PlayerChipView> = {}) =>
  ({
    pid,
    name,
    color,
    avatar: '🦊',
    connected: true,
    crown: false,
    isDrawer: false,
    guessed: false,
    turnPoints: 0,
    score: null,
    rank: null,
    ...extra,
  }) as PlayerChipView;

function view(
  phase: ScreenView['phase'] = 'DRAWING',
  turnExtra: Partial<TurnView> = {},
  extra: Partial<ScreenView> = {},
): ScreenView {
  const turn: TurnView = {
    id: 3,
    number: 3,
    cycle: 2,
    drawerPid: 'mika',
    drawerName: 'Mika',
    timer: { remainingMs: 47_000, totalMs: 60_000, running: false },
    mask: [...'______'],
    word: null,
    correct: [],
    guessed: { guessed: 1, of: 3 },
    endReason: null,
    drawerReconnecting: false,
    ...turnExtra,
  };
  return {
    role: 'screen',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS },
    players: [
      chip('mika', 'Mika', '#C2410C', { isDrawer: true }),
      chip('jun', 'Jun', '#1A7A4A', { guessed: true, turnPoints: 270 }),
      chip('bea', 'Bea', '#B0307F'),
    ],
    turn,
    host: null,
    feed: [],
    almost: [],
    awards: [],
    gallery: [],
    tonight: null,
    nextDrawer: null,
    ...extra,
  };
}

const render = (v: ScreenView, fx: ScreenFxState = NO_FX) =>
  renderToStaticMarkup(
    <ScreenTurn view={v} receivedAt={0} ink={createScreenInk()} layout="landscape" fx={fx} t={t} />,
  );
/** The markup between `data-page="<page>"` and the next page (or the end of the book). */
const page = (html: string, which: 'left' | 'right') => {
  const start = html.indexOf(`data-page="${which}"`);
  const end = which === 'left' ? html.indexOf('data-rings') : html.indexOf('data-tabs');
  return html.slice(start, end);
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, '');

describe('the landscape spread', () => {
  it('puts the drawing on the left page as the largest square: the book’s height, or less where the right page keeps 31 vmin', () => {
    const html = render(view());
    expect(html).toContain('data-desk="landscape"');
    expect(html).toContain(
      'grid-template-columns:min(calc(100cqh - 2 * max(2px, 0.28vmin)), calc(100cqw - 2 * max(2px, 0.28vmin) - 4.7vmin - 31vmin)) 4.7vmin minmax(0, 1fr)',
    );
    const left = page(html, 'left');
    expect(left).toContain('<canvas');
    // The square is the smaller of the page's width and height.
    expect(left).toMatch(/aspect-square w-\[min\(100cqw,100cqh\)\]/);
    expect(page(html, 'right')).not.toContain('<canvas');
  });

  it('tapes the white drawing on by two corners, with an ink border', () => {
    const left = page(render(view()), 'left');
    const frame = left.slice(left.indexOf('data-drawing'));
    expect(frame).toMatch(/^data-drawing="true" class="[^"]*border-ink bg-canvas/);
    expect(frame.match(/data-tape="(tl|tr)"/g)).toEqual(['data-tape="tl"', 'data-tape="tr"']);
  });

  it('keeps the drawing, taped, on the left page at the reveal', () => {
    const html = render(view('REVEAL', { word: 'banana', mask: null, endReason: 'time' }));
    expect(page(html, 'left')).toContain('<canvas');
    expect(page(html, 'left').match(/data-tape=/g)).toHaveLength(2);
    expect(text(page(html, 'right'))).toContain('It was…');
  });

  it('stands the players as index tabs in turn order, ✏️ on the drawer and ✓ with this turn’s points', () => {
    const html = render(view());
    const tabs = html.slice(html.indexOf('data-tabs'));
    expect([...tabs.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1])).toEqual([
      'mika',
      'jun',
      'bea',
    ]);
    expect(tabs).toMatch(/data-tab="mika"[^]*?data-status="true"[^>]*>✏️</);
    expect(tabs).toMatch(
      /data-tab="jun"[^]*?data-status="true" class="[^"]*text-success[^"]*">✓ \+270</,
    );
    expect(tabs.slice(tabs.indexOf('data-tab="bea"'))).not.toContain('data-status');
  });

  it('never shows "+0" on a tab: a right guess for no points is a bare ✓', () => {
    const v = view();
    v.players[1] = { ...v.players[1]!, turnPoints: 0 };
    const html = render(v);
    expect(html).toMatch(/data-tab="jun"[^]*?data-status="true"[^>]*>✓</);
    expect(html).not.toContain('+0');
  });
});

describe('choosing', () => {
  const choosing = () =>
    render(
      view('CHOOSING', {
        mask: null,
        timer: { remainingMs: 9000, totalMs: 12_000, running: false },
      }),
    );

  it('shows the drawer’s avatar large, "Mika is choosing a word…" with the name in colour, and the ring on the left page', () => {
    const left = page(choosing(), 'left');
    const panel = left.slice(left.indexOf('data-choosing'));
    expect(panel).toMatch(/data-avatar="true"[^>]*style="[^"]*width:max\(18vmin, 64px\)/);
    expect(panel).toContain('<span style="color:#C2410C">Mika</span> is choosing a word…');
    expect(panel).toMatch(/role="timer" aria-label="9s"/);
    // The ring counts the 12 s choice and stays blue (DECISIONS F56).
    expect(panel).toContain('data-low="false"');
  });

  it('hides the drawing under it, still mounted', () => {
    expect(page(choosing(), 'left')).toMatch(/data-drawing="true" class="[^"]*invisible/);
    expect(page(choosing(), 'left')).toContain('<canvas');
  });

  it('says "Next up: ✏️ Mika" with the round on the right page, and no clock there', () => {
    const right = page(choosing(), 'right');
    expect(text(right)).toContain('Next up: ✏️ Mika');
    expect(text(right)).toContain('Round 2/2 · Turn 3');
    expect(right).not.toContain('role="timer"');
  });
});

describe('the right page while drawing', () => {
  it('shows the Nunito clock in ink, red in the last 10 s', () => {
    const calm = page(render(view()), 'right');
    expect(calm).toMatch(/<p class="font-num[^"]*font-black[^"]*" role="timer">0:47<\/p>/);
    expect(calm).not.toMatch(/role="timer"[^>]*text-red|text-red[^"]*" role="timer"/);
    const low = page(
      render(view('DRAWING', { timer: { remainingMs: 10_000, totalMs: 60_000, running: false } })),
      'right',
    );
    expect(low).toMatch(/<p class="[^"]*text-red[^"]*" role="timer">0:10<\/p>/);
  });

  it('puts the clock first, then the round in soft, the blanks with counts, and "✏️ Mika is drawing" with the name in colour', () => {
    const right = page(render(view()), 'right');
    const at = (s: string) => right.indexOf(s);
    expect(at('role="timer"')).toBeLessThan(at('Round 2/2 · Turn 3'));
    expect(right).toMatch(/<p class="[^"]*text-soft">Round 2\/2 · Turn 3<\/p>/);
    expect(at('Round 2/2')).toBeLessThan(at('aria-label="6 letters"'));
    expect(right.match(/data-blank="letter"/g)).toHaveLength(6);
    expect(right).toContain('(6)');
    expect(at('(6)')).toBeLessThan(at('is drawing'));
    expect(right).toContain('<span style="color:#C2410C">Mika</span> is drawing');
  });

  it('writes the feed on dashed rules at the foot, newest last and popping in, masked ones as •••', () => {
    const feed = [
      { pid: 'bea', text: 'payong' },
      { pid: 'jun', text: null },
      { pid: 'bea', text: 'sapatos' },
    ];
    const right = page(render(view('DRAWING', {}, { feed })), 'right');
    const list = right.slice(right.indexOf('data-feed'));
    expect(list).toMatch(/^data-feed="true" class="[^"]*mt-auto/);
    const items = [...list.matchAll(/<li class="([^"]*)">(.*?)<\/li>/g)];
    expect(items.map((m) => text(m[2]!))).toEqual(['Bea: payong', 'Jun: •••', 'Bea: sapatos']);
    for (const m of items) expect(m[1]).toContain('border-dashed border-dot');
    expect(items.map((m) => m[1]!.includes('animate-pop'))).toEqual([false, false, true]);
  });

  it('says "Jun got it!" on the highlighter, the name in colour, in the drawer line’s place', () => {
    const right = page(render(view(), { ...NO_FX, gotIt: [{ id: 1, pid: 'jun' }] }), 'right');
    expect(right).toMatch(
      /role="status" aria-live="polite"[^>]*><p class="highlight [^"]*motion-safe:animate-pop[^"]*"><span style="color:#1A7A4A">Jun<\/span> got it!<\/p>/,
    );
    expect(right).not.toContain('is drawing');
  });

  it('shows the drawer-reconnecting note as a sticky note over the drawing’s top edge', () => {
    const left = page(render(view('DRAWING', { drawerReconnecting: true })), 'left');
    expect(left).toMatch(
      /<p class="[^"]*sketch-border bg-sticky[^"]*text-ink[^"]*">Mika’s phone reconnecting…<\/p>/,
    );
  });

  it('never has the word, even when the guesser has it right', () => {
    const v = view();
    expect(JSON.stringify(v)).not.toContain('banana');
    expect(render(v, { ...NO_FX, gotIt: [{ id: 1, pid: 'jun' }] })).not.toContain('banana');
  });
});

describe('the blanks’ letter counts', () => {
  it('never shrink below 2.6 vmin (14 px) on the Screen: the cells give up the room instead', () => {
    const right = page(render(view()), 'right');
    expect(right).toMatch(/style="font-size:max\(0\.55em, max\(2\.6vmin, 14px\)\)">\(6\)</);
    // "(8, 4)" is 6 characters at 0.62 em of the floor; the 12 cells, the space and 13 gaps
    // (plus the 0.1 em margin) share what is left.
    expect(blanksFontSize([...'________ ____'], '40px', '14px')).toBe(
      'min(40px, calc(100cqw / 17.25), calc((100cqw - 3.72 * 14px) / 15.3))',
    );
    // Without a floor (the phones), the row only fits its width, as before.
    expect(blanksFontSize([...'______'], '40px')).toBe('min(40px, calc(100cqw / 8.22))');
  });
});

describe('the first two turns', () => {
  it('write the caption under the drawing on the left page, in ink, never on the right page', () => {
    const html = render(view('DRAWING', { number: 1 }));
    const caption = 'Mika is drawing. Everyone else: type your guess on your phone 🤫';
    expect(page(html, 'left')).toMatch(
      new RegExp(`<canvas[^]*<p class="line-clamp-2[^"]*text-ink[^"]*">${caption}</p>`),
    );
    expect(page(html, 'right')).not.toContain(caption);
  });
});

describe('the paused veil', () => {
  it('is paper over the drawing, which stays visible under it', () => {
    const v = view('DRAWING', {}, { paused: { reasons: ['host'], resumeInMs: null } });
    const html = renderToStaticMarkup(
      <PausedOverlay view={v} receivedAt={0} variant="screen" t={t} />,
    );
    expect(html).toMatch(/class="[^"]*bg-paper\/80/);
    expect(html).not.toMatch(/bg-black|#1d1b22/i);
  });
});

describe('wrong-guess bubbles from the tabs', () => {
  const page = { left: 700, top: 20, right: 1080, bottom: 660 };
  const tab = { left: 1056, top: 200, right: 1258, bottom: 252 };

  it('sit just left of the tab, on its row, and never left of the right page', () => {
    const at = placeTabBubble(tab, page, 47, 18, 720)!;
    expect(at.left).toBe(718);
    expect(at.left + at.width).toBe(1038);
    expect(at.top).toBeCloseTo(202.5);
  });

  it('stay inside the layer at the top and bottom', () => {
    expect(placeTabBubble({ ...tab, top: -10, bottom: 10 }, page, 47, 18, 720)!.top).toBe(0);
    expect(placeTabBubble({ ...tab, top: 700, bottom: 740 }, page, 47, 18, 720)!.top).toBe(673);
  });

  it('are left out when the page has no room for one', () => {
    expect(placeTabBubble({ ...tab, left: 760 }, page, 47, 18, 720)).toBeNull();
  });

  it('are paper with a border in the guesser’s colour, in Patrick Hand at ≥ 5 vh, popping and fading (or only fading)', () => {
    const src = read('./TurnFx.tsx');
    expect(src).toMatch(
      /BUBBLE =\s*'[^']*bg-paper[^']*font-hand[^']*text-ink[^']*motion-safe:animate-bubble motion-reduce:animate-fade'/,
    );
    expect(src).toContain('borderColor: color');
    expect(src).toContain("fontSize: 'max(5vh, 20px)'");
    expect(src).toContain('motion-safe:animate-float-up motion-reduce:animate-fade');
  });
});

describe('motion', () => {
  const css = read('../../index.css');

  it('uses the mockup’s sk-pop, sk-bubble and sk-float on the spec’s 2 s', () => {
    expect(css).toContain('--animate-pop: sk-pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;');
    expect(css).toContain('--animate-bubble: sk-bubble 2s ease-out both;');
    expect(css).toContain('--animate-float-up: sk-float 2s ease-out both;');
    expect(css).toMatch(
      /@keyframes sk-pop \{\s*0% \{\s*transform: scale\(0\.5\);\s*opacity: 0;\s*\}\s*70% \{\s*transform: scale\(1\.06\);/,
    );
    expect(css).toMatch(
      /@keyframes sk-bubble \{\s*0% \{\s*transform: scale\(0\.6\);\s*opacity: 0;\s*\}\s*10%,\s*80% \{\s*transform: scale\(1\);\s*opacity: 1;\s*\}\s*100% \{\s*opacity: 0;/,
    );
    expect(css).toMatch(/@keyframes sk-float \{[^}]*translateY\(0\) scale\(0\.6\)/);
    expect(css).toContain('--rise, 12.5vmin');
  });
});

describe('the restyled turn files', () => {
  it('use only the sketchbook tokens: no hex, no white/NN, no display face, no dark page', () => {
    for (const file of [
      './ScreenTurn.tsx',
      './TurnFx.tsx',
      './PlayerChip.tsx',
      './ScreenDesk.tsx',
    ]) {
      const src = read(file);
      expect(src, file).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
      expect(src, file).not.toMatch(/white\/\d|text-white|bg-black|font-display|font-bold|legacy-/);
    }
    // No phase sits on the dark page any more: the standings left it in F66.
    const screen = read('../../pages/Screen.tsx');
    expect(screen).not.toContain('legacy-night');
  });

  it('puts the portrait turn in the spread’s portrait form: top bar, rings across, drawing (F65)', () => {
    const html = renderToStaticMarkup(
      <ScreenTurn view={view()} receivedAt={0} ink={createScreenInk()} layout="portrait" t={t} />,
    );
    expect(html).toContain('data-desk="portrait"');
    const top = html.indexOf('data-page="left"');
    const rings = html.indexOf('data-rings="row"');
    const page = html.indexOf('data-page="right"');
    expect(top).toBeGreaterThan(-1);
    expect(html.indexOf('data-top-bar')).toBeGreaterThan(top);
    expect(html.indexOf('data-top-bar')).toBeLessThan(rings);
    expect(rings).toBeLessThan(page);
    expect(html.indexOf('<canvas')).toBeGreaterThan(page);
    expect(html).not.toContain('legacy');
  });
});

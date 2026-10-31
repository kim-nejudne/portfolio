// The Screen's portrait turn and the reveal in the sketchbook (F65): the top bar over the square
// (timer, blanks, drawer line, latest guess; no round or turn), the same height all turn long, the
// lane between the drawing and the tabs, and the reveal: "It was…", the word on the highlighter
// with the pop, the got-it rows, "Almost:" struck in red, the drawer's points and "Next: Jun draws".
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { PlayerChipView, ScreenView, TurnView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import { createScreenInk } from '../../lib/ink.js';
import type { ScreenLayout } from '../../lib/screen.js';
import { ScreenTurn, wordSize } from './ScreenTurn.js';
import { placeLaneBubble } from './TurnFx.js';

const t = translator('en');
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const text = (markup: string) => markup.replace(/<[^>]+>/g, '');

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
    connected: true,
    crown: false,
    isDrawer: false,
    avatar: '🐸',
    guessed: false,
    turnPoints: 0,
    score: null,
    rank: null,
    ...extra,
  }) as PlayerChipView;

const MIKA = '#B8361C';
const JUN = '#1A7A4A';

function view(phase: ScreenView['phase'], over: Partial<ScreenView> = {}): ScreenView {
  const reveal = phase === 'REVEAL';
  const turn: TurnView = {
    id: 3,
    number: 3,
    cycle: 1,
    drawerPid: 'mika',
    drawerName: 'Mika',
    timer: reveal ? null : { remainingMs: 47_000, totalMs: 60_000, running: true },
    mask: phase === 'DRAWING' ? [...'_______'] : null,
    word: reveal ? 'payong' : null,
    correct: reveal
      ? [
          { pid: 'ana', points: 225, order: 2 },
          { pid: 'jun', points: 270, order: 1 },
        ]
      : [],
    guessed: { guessed: reveal ? 2 : 0, of: 3 },
    endReason: reveal ? 'time' : null,
    drawerReconnecting: false,
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
      chip('mika', 'Mika', MIKA, { isDrawer: true, turnPoints: reveal ? 320 : 0 }),
      chip('jun', 'Jun', JUN, { guessed: reveal, turnPoints: reveal ? 270 : 0 }),
      chip('ana', 'Ana', '#2B4FB8', { guessed: reveal, turnPoints: reveal ? 225 : 0 }),
      chip('bea', 'Bea', '#A8327E'),
    ],
    turn,
    host: null,
    feed:
      phase === 'DRAWING'
        ? [
            { pid: 'bea', text: 'kabute' },
            { pid: 'bea', text: 'sapatos' },
          ]
        : [],
    almost: reveal
      ? [
          { pid: 'bea', text: 'payung' },
          { pid: 'bea', text: 'kabute' },
        ]
      : [],
    awards: [],
    gallery: [],
    tonight: null,
    nextDrawer: reveal ? { pid: 'jun', name: 'Jun', color: JUN } : null,
    ...over,
  };
}

const render = (v: ScreenView, layout: ScreenLayout) =>
  renderToStaticMarkup(
    <ScreenTurn view={v} receivedAt={0} ink={createScreenInk()} layout={layout} t={t} />,
  );

describe('the portrait turn (F65)', () => {
  it('puts the timer, blanks, drawer line and latest guess in the top bar, in that order', () => {
    const html = render(view('DRAWING'), 'portrait');
    const bar = html.slice(html.indexOf('data-top-bar'), html.indexOf('data-rings="row"'));
    const order = ['role="timer"', 'aria-label="7 letters"', 'Mika is drawing', 'sapatos'].map(
      (s) => bar.indexOf(s),
    );
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(bar).not.toContain('kabute');
    expect(bar).not.toContain('Round');
    expect(bar).toMatch(/font-num text-\[max\(8vmin,36px\)\]/);
  });

  it('writes the drawer’s name in their colour', () => {
    expect(render(view('DRAWING'), 'portrait')).toContain(
      `<span style="color:${MIKA}">Mika</span>`,
    );
  });

  it('keeps the top bar one height through choosing, drawing and the reveal', () => {
    const height = (v: ScreenView) =>
      /data-top-bar="true"[^>]*style="height:([^"]+)"/.exec(render(v, 'portrait'))?.[1];
    const choosing = height(view('CHOOSING'));
    expect(choosing).toMatch(/12vh/);
    expect(height(view('DRAWING'))).toBe(choosing);
    expect(height(view('REVEAL'))).toBe(choosing);
  });

  it('says "Next up: ✏️ Mika" in the top bar while choosing, with the ring on the drawing', () => {
    const html = render(view('CHOOSING'), 'portrait');
    const canvas = html.indexOf('<canvas');
    expect(text(html).indexOf('Next up: ✏️ Mika')).toBeGreaterThan(-1);
    expect(html.indexOf('Next up')).toBeLessThan(canvas);
    expect(html.indexOf('data-choosing')).toBeGreaterThan(canvas);
  });

  it('runs the rings across, then the drawing and its lane, then the tabs with ✏️ and ✓', () => {
    const html = render(view('REVEAL'), 'portrait');
    const rings = html.indexOf('data-rings="row"');
    const canvas = html.indexOf('<canvas');
    const lane = html.indexOf('data-bubble-lane');
    const tabs = html.indexOf('data-tabs="portrait"');
    expect(rings).toBeLessThan(canvas);
    expect(canvas).toBeLessThan(lane);
    expect(lane).toBeLessThan(tabs);
    expect(html).toMatch(/<li data-tab="jun"[^]*?data-status="true"[^>]*>✓ \+270</);
    expect(html).toMatch(/<li data-tab="mika"[^]*?data-status="true"[^>]*>✏️</);
  });

  it('puts the first turns’ caption in the lane under the drawing', () => {
    const v = view('DRAWING');
    const html = render({ ...v, turn: { ...v.turn!, number: 1 } }, 'portrait');
    const lane = html.indexOf('data-bubble-lane');
    expect(html.indexOf('Everyone else: type your guess')).toBeGreaterThan(lane);
    expect(html.indexOf('data-tabs')).toBeGreaterThan(html.indexOf('Everyone else'));
  });
});

describe('the reveal (F65)', () => {
  for (const layout of ['landscape', 'portrait'] as const) {
    describe(layout, () => {
      let html = '';
      let out = '';
      beforeAll(() => {
        html = render(view('REVEAL'), layout);
        out = text(html);
      });

      it('says "It was…", then the word in Nunito 900 on the highlighter, popping in', () => {
        expect(out.indexOf('It was…')).toBeLessThan(out.indexOf('payong'));
        expect(html).toMatch(
          /<p class="highlight [^"]*font-num[^"]*font-black[^"]*motion-safe:animate-reveal[^"]*"[^>]*>payong<\/p>/,
        );
        // Set as `--word`, which caps the page's other text too.
        expect(html).toContain(`--word:${wordSize(6)}`);
        expect(html).toMatch(/style="font-size:var\(--word\)"><p class="highlight/);
      });

      it('keeps the rest of the reveal text under the word’s size', () => {
        expect(html).toMatch(/calc\(var\(--word(,100vh)?\)\*0\.75\)|var\(--word\) \* 0\.75/);
        const headline = /<p class="([^"]*)"[^>]*>(Everyone|Nobody)/.exec(
          render({ ...view('REVEAL'), turn: { ...view('REVEAL').turn!, correct: [] } }, layout),
        );
        if (layout === 'landscape') expect(headline?.[1]).toContain('*0.75');
      });

      it('announces "It was… payong" in a live region mounted all turn', () => {
        expect(html).toContain(
          '<p role="status" aria-live="polite" class="sr-only">It was… payong</p>',
        );
        expect(render(view('DRAWING'), layout)).toContain(
          '<p role="status" aria-live="polite" class="sr-only"></p>',
        );
      });

      it('lists who got it in corrected order with their points', () => {
        expect(out).toMatch(/Got it🐸Jun\+270🐸Ana\+225/);
      });

      it('strikes the "Almost:" guesses through in red, in the server’s order', () => {
        expect(out).toContain('Almost: payung · kabute');
        expect(html).toMatch(/<s class="[^"]*text-red[^"]*after:bg-red[^"]*">payung<\/s>/);
      });

      it('gives the drawer’s points and who draws next, names in colour', () => {
        expect(out).toContain('+320 for Mika’s drawing');
        expect(out).toContain('Next: Jun draws');
        expect(html).toContain(`<span style="color:${JUN}">Jun</span> draws`);
        expect(out.indexOf('Next: Jun draws')).toBeGreaterThan(out.indexOf('Almost:'));
      });

      it('leaves out "Next" with no turn left, and the drawer line at 0', () => {
        const v = view('REVEAL', { nextDrawer: null });
        const zero = {
          ...v,
          players: v.players.map((p) => (p.pid === 'mika' ? { ...p, turnPoints: 0 } : p)),
        };
        const o = text(render(zero, layout));
        expect(o).not.toContain('Next:');
        expect(o).not.toContain('drawing');
        expect(o).not.toContain('+0');
      });

      it('shows no points rows when nobody got it, but still "Almost:" and "Next"', () => {
        const v = view('REVEAL');
        const nobody: ScreenView = {
          ...v,
          turn: { ...v.turn!, correct: [] },
          players: v.players.map((p) => ({ ...p, guessed: false, turnPoints: 0 })),
        };
        const o = text(render(nobody, layout));
        expect(o).toMatch(/Nobody got it! 😱It was…/);
        expect(o).not.toContain('Got it');
        expect(o).not.toMatch(/\+\d/);
        expect(o).toContain('Almost: payung');
        expect(o).toContain('Next: Jun draws');
      });
    });
  }

  it('puts the word above the drawing and the rows in the lane under it, in portrait', () => {
    const html = render(view('REVEAL'), 'portrait');
    const canvas = html.indexOf('<canvas');
    expect(html.indexOf('>payong<')).toBeLessThan(canvas);
    expect(html.indexOf('data-reveal-details')).toBeGreaterThan(html.indexOf('data-bubble-lane'));
    expect(html.indexOf('Next: Jun draws')).toBeGreaterThan(canvas);
  });

  it('keeps the drawing taped where it was', () => {
    for (const layout of ['landscape', 'portrait'] as const) {
      const html = render(view('REVEAL'), layout);
      expect(html, layout).toMatch(/data-drawing="true" class="[^"]*border-ink bg-canvas/);
      expect(html, layout).not.toMatch(/data-drawing="true" class="[^"]*invisible/);
    }
  });

  it('sizes the word at 12 vh unless its letters need less, with room for the pop', () => {
    expect(wordSize(3)).toBe('min(12vh, calc(100cqw / 3.01))');
    expect(wordSize(8)).toBe('min(12vh, calc(100cqw / 7.35))');
  });

  it('pops the word in with the mockup’s overshoot, under motion-safe only', () => {
    const css = read('../../index.css');
    expect(css).toMatch(/--animate-reveal: sk-pop 0\.5s cubic-bezier\(0\.2, 0\.9, 0\.3, 1\.25\)/);
    expect(read('./ScreenTurn.tsx')).not.toMatch(/(?<!motion-safe:)animate-reveal/);
  });

  it('never shows the next drawer’s word, only their name', () => {
    expect(JSON.stringify(view('REVEAL').nextDrawer)).toBe(
      JSON.stringify({ pid: 'jun', name: 'Jun', color: JUN }),
    );
  });
});

describe('placeLaneBubble (F65)', () => {
  const lane = { left: 30, top: 700, right: 740, bottom: 770 };
  it('puts a bubble at the lane’s foot, starting at a left-hand tab and running right', () => {
    const at = placeLaneBubble({ left: 30, top: 790, right: 150, bottom: 880 }, lane, 60)!;
    expect(at).toEqual({ left: 30, width: 710, top: 710, align: 'start' });
  });

  it('ends a right-hand tab’s bubble at the tab’s right edge, running left', () => {
    const at = placeLaneBubble({ left: 620, top: 790, right: 740, bottom: 880 }, lane, 60)!;
    expect(at).toEqual({ left: 30, width: 710, top: 710, align: 'end' });
    const mid = placeLaneBubble({ left: 500, top: 790, right: 610, bottom: 880 }, lane, 60)!;
    expect(mid.left + mid.width).toBe(610);
  });

  it('keeps every bubble inside the lane, never over the drawing above it', () => {
    for (const left of [0, 100, 300, 500, 700]) {
      const at = placeLaneBubble({ left, top: 790, right: left + 120, bottom: 880 }, lane, 60)!;
      expect(at.top).toBeGreaterThanOrEqual(lane.top);
      expect(at.top + 60).toBeLessThanOrEqual(lane.bottom);
      expect(at.left).toBeGreaterThanOrEqual(lane.left);
      expect(at.left + at.width).toBeLessThanOrEqual(lane.right);
    }
  });

  it('drops the bubble when the lane is too short for one', () => {
    expect(placeLaneBubble({ left: 30, top: 790, right: 150, bottom: 880 }, lane, 80)).toBeNull();
  });
});

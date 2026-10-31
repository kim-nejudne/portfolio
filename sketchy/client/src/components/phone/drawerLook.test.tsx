// The sketchbook drawer phone (F59): markup and source checks. The look itself is checked by the
// F59 playtest against the mockup (`sketchbook.html#sketch-choosing`, `-drawing`, `-close`).
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { PlayerChipView, PlayerView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { drawerPadSize } from '../../lib/phone.js';
import { DEFAULT_TOOL } from '../../lib/tools.js';
import { DrawerTurn, GuessLine, HOST_PILL_ROOM } from './DrawerTurn.js';
import { DrawToolbar } from './DrawToolbar.js';
import { HostDrawer } from './HostDrawer.js';
import { RINGS_ROW_PX, SpiralRings } from '../sketch/SpiralRings.js';
import { WordChoice } from './WordChoice.js';

const t = translator('en');
const noop = () => {};
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const WORD = 'qzsecret';

const chip = (pid: string, name: string, extra: Partial<PlayerChipView> = {}): PlayerChipView => ({
  pid,
  name,
  color: '#B23A1E',
  connected: true,
  crown: false,
  isDrawer: false,
  avatar: '🦊',
  guessed: false,
  turnPoints: 0,
  score: null,
  rank: null,
  ...extra,
});

// Stopped timers, so the countdown shows exactly what the view says (no real clock).
function view(phase: 'CHOOSING' | 'DRAWING', remainingMs: number): PlayerView {
  const choosing = phase === 'CHOOSING';
  return {
    role: 'player',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS },
    players: [chip('mika', 'Mika', { isDrawer: true, crown: true }), chip('bea', 'Bea')],
    turn: {
      id: 3,
      number: 1,
      cycle: 1,
      drawerPid: 'mika',
      drawerName: 'Mika',
      timer: { remainingMs, totalMs: choosing ? 12_000 : 60_000, running: false },
      mask: choosing ? null : [...'________'],
      word: null,
      correct: [],
      guessed: { guessed: 0, of: 4 },
      endReason: null,
      drawerReconnecting: false,
    },
    host: null,
    me: { pid: 'mika', turnPoints: 0, score: null, rank: null, award: null },
    secret: {
      turnId: 3,
      choices: choosing
        ? [
            { word: 'tsinelas', gloss: null, difficulty: 1, custom: false },
            { word: 'salakot', gloss: "wide woven farmer's hat", difficulty: 2, custom: false },
            {
              word: 'harana',
              gloss: "singing under someone's window",
              difficulty: 3,
              custom: false,
            },
          ]
        : null,
      word: choosing ? null : { word: WORD, gloss: null, difficulty: 2, custom: false },
      chooseTimer: null,
    },
    lastGuess: choosing ? null : { pid: 'bea', text: 'sapatos' },
  };
}

const drawing = (remainingMs: number, hostButton = false) =>
  renderToStaticMarkup(
    <DrawerTurn
      view={view('DRAWING', remainingMs)}
      receivedAt={0}
      ink={{ send: noop, bind: () => noop }}
      paused={false}
      closePid={null}
      hostButton={hostButton}
      t={t}
    />,
  );

describe('choosing (sketch-choosing)', () => {
  const html = renderToStaticMarkup(
    <WordChoice view={view('CHOOSING', 10_000)} receivedAt={0} onChoose={async () => null} t={t} />,
  );

  it('heads the page with the heading, the hint in soft and a 58 px countdown ring', () => {
    expect(html).toMatch(/<h2[^>]*>Your turn to draw!<\/h2><p class="[^"]*text-soft[^"]*">/);
    expect(html).toContain('style="width:58px;height:58px"');
    // A 12 s ring: 10 of 12 s left is 83 % of the arc, still pen (never red while choosing).
    expect(html).toContain('stroke-dasharray="83.3 100"');
    expect(html).toContain('data-low="false"');
  });

  it('shows three ruled, taped index cards with a red-pen level tag, the word large and the gloss in soft', () => {
    expect(
      html.match(/<li class="relative[^"]*"><span aria-hidden="true" data-tape="top"/g),
    ).toHaveLength(3);
    const cards = html.match(/<button[^>]*class="index-card [^"]*"/g) ?? [];
    expect(cards).toHaveLength(3);
    for (const card of cards)
      expect(card).toMatch(/border-2 border-ink.*shadow-\[3px_3px_0_var\(--color-ink\)\]/);
    for (const level of ['Easy', 'Medium', 'Hard']) {
      expect(html).toMatch(
        new RegExp(`<span class="absolute [^"]*border-red[^"]*text-red[^"]*">${level}</span>`),
      );
    }
    expect(html).toMatch(
      /<span class="[^"]*text-\[clamp\(1\.625rem,9vw,2\.125rem\)\][^"]*"><span aria-hidden="true" class="float-right h-5 w-\[4\.5rem\]"><\/span>salakot<\/span>/,
    );
    expect(html).toMatch(/<span class="[^"]*text-soft[^"]*">wide woven farmer&#x27;s hat<\/span>/);
  });

  it('gives "You draw next!" the same cards', () => {
    const next = view('CHOOSING', 10_000);
    next.phase = 'DRAWING';
    next.secret!.chooseTimer = { remainingMs: 7_000, totalMs: 12_000, running: false };
    const up = renderToStaticMarkup(
      <WordChoice view={next} receivedAt={0} onChoose={async () => null} next t={t} />,
    );
    expect(up).toContain('You draw next! Pick a word');
    expect(up.match(/class="index-card /g)).toHaveLength(3);
    expect(up.match(/data-tape="top"/g)).toHaveLength(3);
  });
});

describe('drawing (sketch-drawing, -close)', () => {
  it('has a 56 px bar: the word 16 px in soft, the Nunito clock, "N of 4 got it", then the latest guess', () => {
    const html = drawing(47_000);
    expect(html).toContain('style="height:56px"');
    expect(html).toMatch(
      new RegExp(
        `<p class="[^"]*text-base[^"]*"><strong class="[^"]*text-soft[^"]*">${WORD}</strong>`,
      ),
    );
    expect(html).toMatch(
      /<span role="timer" class="[^"]*font-num[^"]*font-black[^"]*text-ink[^"]*">0:47<\/span>/,
    );
    expect(html).toContain('0 of 4 got it');
    expect(html).toContain('Bea: sapatos');
  });

  it('turns the clock red in the last 10 s', () => {
    expect(drawing(10_000)).toMatch(/<span role="timer" class="[^"]*text-red[^"]*">0:10<\/span>/);
    expect(drawing(11_000)).not.toMatch(/<span role="timer" class="[^"]*text-red/);
  });

  it('keeps the end of the bar’s first row free for the Host pill only when the crown holder draws', () => {
    expect(drawing(47_000, true)).toMatch(
      new RegExp(
        `style="height:56px" class="[^"]*"><p class="[^"]*${HOST_PILL_ROOM.replace(/[[\].]/g, '\\$&')}`,
      ),
    );
    expect(drawing(47_000, false)).not.toContain(HOST_PILL_ROOM);
  });

  it('puts "Bea is close!" on an amber swash, level, in place of the guess', () => {
    const html = renderToStaticMarkup(
      <GuessLine close="Bea" last={{ name: 'Bea', text: 'sapatos' }} t={t} />,
    );
    expect(html).toContain('highlight font-normal [--color-hl:var(--color-amber)]');
    expect(html).not.toContain('sapatos');
  });

  it('frames the pad with an ink border and a hard shadow, with no tape', () => {
    expect(read('./DrawPad.tsx')).toContain(
      'bg-canvas shadow-[0_0_0_2px_var(--color-ink),3px_3px_0_2px_var(--color-ink)]',
    );
    expect(drawing(47_000)).not.toContain('data-tape');
  });

  it('keeps the pad size formula: the playtest measured these view boxes under the rings', () => {
    // min(width − 8, height − 56 − 2 × 48 − 16); the boxes are the viewports less the 30 px rings.
    expect(drawerPadSize(360, 530)).toBe(352);
    expect(drawerPadSize(390, 634)).toBe(382);
    expect(drawerPadSize(412, 750)).toBe(404);
    expect(drawerPadSize(360, 400)).toBe(400 - 56 - 96 - 16);
  });

  it('writes the "Start with one big shape" hint in pen', () => {
    const src = read('./DrawerTurn.tsx');
    const hint = src.slice(src.indexOf('{nudge && ('), src.indexOf("{t('startBigShape')}"));
    expect(hint).toContain('text-pen');
    expect(hint).toContain('bg-paper');
  });
});

describe('the toolbar', () => {
  const bar = (eraser: boolean) =>
    renderToStaticMarkup(
      <DrawToolbar
        tool={{ ...DEFAULT_TOOL, eraser }}
        onTool={noop}
        pad={{ ready: true, canUndo: true, canClear: true }}
        onUndo={noop}
        onClear={noop}
        disabled={false}
        t={t}
      />,
    );

  it('keeps two 48 px rows: 8 crayons (40 px in 44 px), the picked one outlined', () => {
    const html = bar(false);
    expect(html.match(/style="height:48px"/g)).toHaveLength(2);
    expect(html.match(/class="group grid size-11 /g)).toHaveLength(8);
    expect(html.match(/wobbly block size-10 border-\[2\.5px\] border-ink/g)).toHaveLength(8);
    expect(html.match(/outline-\[3px\] outline-offset-\[1px\] outline-pen/g)).toHaveLength(1);
  });

  it('has hand-bordered Size (a dot and S/M/L), Eraser, Undo and Clear with pen icons', () => {
    const html = bar(false);
    const row2 = html.slice(html.lastIndexOf('style="height:48px"'));
    expect(row2.match(/<button[^>]*class="sketch-border /g)).toHaveLength(4);
    expect(row2).toMatch(
      /aria-label="Brush size: medium\. Tap to change"[^>]*>.*rounded-full border border-ink.*M<\/span><\/button>/,
    );
    expect(row2.match(/<svg[^>]*class="size-5 shrink-0 text-pen"/g)).toHaveLength(3);
    for (const label of ['Eraser', 'Undo', 'Clear'])
      expect(row2).toContain(`</svg>${label}</button>`);
  });

  it('puts the eraser on the highlighter while it is on', () => {
    expect(bar(true)).toMatch(/aria-pressed="true"[^>]*class="[^"]*\bbg-hl\b/);
    expect(bar(false)).not.toMatch(/aria-pressed="false"[^>]*class="[^"]*\bbg-hl\b[^"]*"><svg/);
  });
});

describe('the Host pill', () => {
  const pill = (placement: 'bar' | 'drawer') =>
    renderToStaticMarkup(
      <HostDrawer
        view={view('DRAWING', 47_000)}
        socket={{} as GameSocket}
        t={t}
        open={false}
        onOpenChange={noop}
        placement={placement}
      />,
    );

  it('sits in the drawer bar’s first row, a hand-bordered pill in a 44 px tap area', () => {
    const html = pill('drawer');
    // Just under the rings (the same constant sizes their row), at the bar's right end.
    expect(html).toMatch(
      /^<div style="top:calc\(env\(safe-area-inset-top\) \+ 30px\)" class="absolute right-/,
    );
    expect(renderToStaticMarkup(<SpiralRings />)).toContain(`style="height:${RINGS_ROW_PX}px"`);
    expect(html).toMatch(/<button[^>]*class="flex min-h-11 min-w-11 [^"]*items-start/);
    expect(html).toMatch(
      /<span class="[^"]*border-2 border-ink bg-paper[^"]*"><span aria-hidden="true">👑<\/span> Host<\/span>/,
    );
    expect(pill('bar')).toMatch(/^<div class="relative z-30 flex shrink-0/);
  });
});

describe('tokens', () => {
  it('uses only sketchbook tokens on the restyled drawer surfaces', () => {
    for (const file of [
      './DrawerTurn.tsx',
      './WordChoice.tsx',
      './DrawToolbar.tsx',
      './DrawPad.tsx',
    ]) {
      const src = read(file);
      expect(src, file).not.toMatch(/#[0-9A-Fa-f]{6}\b|white\/\d|text-white|bg-white/);
    }
  });
});

// F61: the Sketchbook look of the phone's results (reveal, scoreboard, final), the Host sheet and
// the paused / rematch veils. Behaviour stays pinned by phoneViews, hostPhone and the overlay tests.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { PlayerChipView, PlayerView, View } from '../../../../shared/types.js';
import { t } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { PausedOverlay } from '../PausedOverlay.js';
import { RematchOverlay } from '../RematchOverlay.js';
import { sketchButtonClass } from '../sketch/SketchButton.js';
import { DrawerSheet } from './HostDrawer.js';
import { PhoneStandings } from './PhoneStandings.js';

const socket = {} as GameSocket;
const noop = () => {};
const WORD = 'qzsecret';
const NEXT_WORD = 'qznextword';

const chip = (pid: string, name: string, extra: Partial<PlayerChipView> = {}): PlayerChipView => ({
  pid,
  name,
  color: '#1A5FB4',
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

/** Mika drew; Jun (270) then Ana (225) got it. */
function view(
  phase: PlayerView['phase'],
  me: string,
  extra: Partial<PlayerView> & { mePoints?: number } = {},
): PlayerView {
  const scored = phase === 'SCOREBOARD' || phase === 'FINAL';
  const { mePoints = 0, ...rest } = extra;
  const players = [
    chip('mika', 'Mika', { crown: true, score: scored ? 640 : null, rank: scored ? 3 : null }),
    chip('jun', 'Jun', { color: '#A3346B', score: scored ? 980 : null, rank: scored ? 1 : null }),
    chip('ana', 'Ana', { color: '#2F7A3A', score: scored ? 905 : null, rank: scored ? 2 : null }),
  ];
  const mine = players.find((p) => p.pid === me)!;
  return {
    role: 'player',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS },
    players,
    turn: {
      id: 3,
      number: 3,
      cycle: 1,
      drawerPid: 'mika',
      drawerName: 'Mika',
      timer: null,
      mask: null,
      word: WORD,
      correct: [
        { pid: 'ana', points: 225, order: 2 },
        { pid: 'jun', points: 270, order: 1 },
      ],
      guessed: { guessed: 2, of: 2 },
      endReason: 'allGuessed',
      drawerReconnecting: false,
      category: null,
    },
    host: null,
    me: {
      pid: me,
      turnPoints: mePoints,
      score: mine.score,
      rank: mine.rank === null ? null : { rank: mine.rank, of: 3 },
      award: null,
    },
    secret: null,
    lastGuess: null,
    ...rest,
  };
}

const render = (v: PlayerView, withSocket = false) =>
  renderToStaticMarkup(
    <PhoneStandings view={v} onLeave={noop} t={t} {...(withSocket ? { socket } : {})} />,
  );
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('the reveal', () => {
  it('writes "It was…", then the word in Nunito 900 at 52 px on the highlighter', () => {
    const html = render(view('REVEAL', 'jun', { mePoints: 270 }));
    expect(html.indexOf('It was…')).toBeLessThan(html.indexOf(WORD));
    expect(html).toMatch(/data-reveal-word="true" class="[^"]*font-num[^"]*font-black[^"]*"/);
    expect(html).toContain('font-size:min(52px, 14vw)');
    expect(html).toMatch(/class="highlight[^"]*">qzsecret</);
  });

  it('shrinks a long word so it stays on the page', () => {
    const long = view('REVEAL', 'jun', {
      turn: { ...view('REVEAL', 'jun').turn!, word: 'sinampalukang manok' },
    });
    expect(render(long)).toContain('font-size:min(30px, 14vw)');
  });

  it('stamps a guesser’s points in red: "+270" over "this turn"', () => {
    const html = render(view('REVEAL', 'jun', { mePoints: 270 }));
    expect(html).toMatch(
      /data-stamp="true" class="[^"]*border-red[^"]*text-\[44px\][^"]*">\+270<small[^>]*>this turn<\/small>/,
    );
    // Screen readers hear the line whole.
    expect(html).toContain('<span class="sr-only">+270 this turn</span>');
    expect(html).not.toContain('data-got-it-rows');
  });

  it('gives a guesser who missed a plain "+0 this turn", not a red stamp', () => {
    const html = render(view('REVEAL', 'jun', { mePoints: 0 }));
    expect(html).toContain('+0 this turn');
    expect(html).not.toContain('data-stamp');
  });

  it('stamps the drawer’s "+320 for your drawing" only above 0, with the got-it rows', () => {
    const html = render(view('REVEAL', 'mika', { mePoints: 320 }));
    expect(html).toMatch(/>\+320<small[^>]*>for your drawing<\/small>/);
    expect(html).toContain('data-got-it-rows');
    // Fastest first, the name in their colour, the points in Nunito.
    expect(html.indexOf('>Jun<')).toBeLessThan(html.indexOf('>Ana<'));
    expect(html).toContain('style="color:#A3346B">Jun<');
    expect(html).toMatch(/font-num font-black tabular-nums">\+270</);
    const nothing = render(view('REVEAL', 'mika', { mePoints: 0 }));
    expect(nothing).not.toContain('data-stamp');
    expect(nothing).not.toContain('for your drawing');
    expect(nothing).toContain('data-got-it-rows');
  });

  it('never shows the next drawer’s chosen word, only that they draw next', () => {
    const v = view('REVEAL', 'jun', {
      mePoints: 270,
      secret: {
        turnId: 4,
        choices: null,
        word: { word: NEXT_WORD, difficulty: 1, custom: false },
        chooseTimer: null,
      },
    });
    const html = render(v);
    expect(html).toContain('You draw next! Get ready');
    expect(html).not.toContain(NEXT_WORD);
  });
});

describe('the scoreboard', () => {
  it('shows the big pen ordinal with a raised suffix, then the score', () => {
    const html = render(view('SCOREBOARD', 'ana'));
    expect(html).toMatch(
      /data-big-rank="true" class="font-num[^"]*text-pen[^"]*text-\[min\(96px,15dvh\)\]">2<sup[^>]*>nd<\/sup>/,
    );
    expect(html).toMatch(/font-num text-\[30px\] font-black tabular-nums">905</);
    expect(html).toContain('<p class="sr-only">#2 of 3</p>');
    expect(html).toContain('<p class="sr-only">905 points</p>');
  });

  it('lists everyone by rank, your row on the highlighter', () => {
    const html = render(view('SCOREBOARD', 'ana'));
    const list = html.slice(html.indexOf('data-standings'));
    const at = ['>Jun<', '>Ana<', '>Mika<'].map((s) => list.indexOf(s));
    expect(at.every((i) => i > 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(list.match(/data-me/g)).toHaveLength(1);
    // Every row carries its (shared) rank.
    expect(list).toMatch(/tabular-nums">1<\/span><span aria-hidden="true" data-avatar/);
    expect(list).toMatch(/<li data-me="" class="[^"]*bg-hl\/30[^"]*">(?:(?!<\/li>).)*>Ana</);
    expect(html).not.toContain(WORD);
  });
});

describe('the final', () => {
  const final = (me: string, award = true) =>
    view(
      'FINAL',
      me,
      award ? { me: { ...view('FINAL', me).me, award: { kind: 'speedDemon', pid: me } } } : {},
    );

  it('puts the award on a taped sticky note first, then the rank, score and gallery line', () => {
    const html = render(final('jun'));
    expect(html).toMatch(
      /data-award-note="true" class="[^"]*bg-sticky[^"]*shadow-\[3px_4px_0_var\(--color-ink\)\]/,
    );
    expect(html).toMatch(/data-award-note[^>]*><span[^>]*data-tape="top"/);
    const at = ['⚡ Speed Demon', 'data-big-rank', 'See the gallery on the Screen'].map((s) =>
      html.indexOf(s),
    );
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(html).toMatch(/>1<sup[^>]*>st<\/sup>/);
    expect(html).toContain('text-[min(96px,15dvh)]');
  });

  it('gives the host Rematch as a full sketch button and Back to lobby underlined', () => {
    const v = {
      ...final('mika', false),
      host: { code: 'KPRW', customWordCount: 0, categories: [] },
    };
    const html = render(v, true);
    expect(html).toMatch(
      /class="sketch-border[^"]*bg-hl[^"]*min-h-\[60px\] w-full[^"]*"><span[^>]*>Rematch</,
    );
    expect(html).toMatch(/class="[^"]*underline[^"]*">Back to lobby</);
    expect(html.indexOf('See the gallery')).toBeLessThan(html.indexOf('>Rematch<'));
    // A smaller rank, so the host's page fits 360×560.
    expect(html).toContain('text-[min(96px,11dvh)]');
  });

  it('gives everyone else neither', () => {
    const html = render(final('jun'), true);
    expect(html).not.toContain('Rematch');
    expect(html).not.toContain('Back to lobby');
  });
});

describe('the Host sheet', () => {
  const sheet = (phase: PlayerView['phase']) =>
    renderToStaticMarkup(
      <DrawerSheet
        view={{
          ...view(phase, 'mika'),
          host: { code: 'KPRW', customWordCount: 0, categories: [] },
        }}
        socket={socket}
        t={t}
        onClose={noop}
      />,
    );

  it('is a dot-grid paper sheet with an ink edge over a paper veil, never dark', () => {
    const html = sheet('DRAWING');
    expect(html).toMatch(/^<div class="[^"]*bg-paper\/70/);
    expect(html).toMatch(
      /role="dialog"[^>]*class="paper-dots[^"]*border-ink bg-paper[^"]*text-ink/,
    );
    // Player colours come inline; no class paints it dark.
    expect(html).not.toMatch(/class="[^"]*(bg-black|#[0-9A-Fa-f]{6}|white\/\d)/);
  });

  it('draws its controls as sketch buttons: the primary one highlighter, the rest paper', () => {
    const html = sheet('FINAL');
    expect(html).toMatch(
      /sketch-border[^"]*bg-hl text-ink min-h-16 w-full text-\[28px\][^"]*">Rematch</,
    );
    expect(html).toMatch(/sketch-border[^"]*bg-paper text-ink[^"]*">Back to lobby</);
  });

  it('arms in red pen, unlike either resting look', () => {
    const armed = sketchButtonClass('armed');
    expect(armed).toContain('bg-red text-paper');
    expect(armed).not.toMatch(/bg-hl|bg-paper/);
    expect(sketchButtonClass('primary')).toContain('bg-hl text-ink');
    expect(sketchButtonClass('ghost')).toContain('bg-paper text-ink');
  });
});

describe('the paused and rematch veils', () => {
  const paused = (resumeInMs: number | null, variant: 'screen' | 'phone') =>
    renderToStaticMarkup(
      <PausedOverlay
        view={
          {
            paused: { reasons: resumeInMs === null ? ['host'] : [], resumeInMs },
            turn: null,
          } as unknown as View
        }
        receivedAt={performance.now()}
        variant={variant}
        t={t}
      />,
    );
  const rematch = (variant: 'screen' | 'phone') =>
    renderToStaticMarkup(
      <RematchOverlay
        view={
          {
            rematchInMs: 3000,
            gameNumber: 1,
            rematchFirst: { pid: 'jun', name: 'Jun', color: '#A3346B' },
          } as unknown as View
        }
        receivedAt={performance.now()}
        variant={variant}
        t={t}
      />,
    );

  it('are paper veils with ink text on the phone and the Screen', () => {
    for (const variant of ['screen', 'phone'] as const) {
      for (const html of [paused(null, variant), paused(3000, variant), rematch(variant)]) {
        expect(html).toMatch(
          /^<div role="status"[^>]*class="[^"]*font-hand text-ink[^"]*bg-paper\/(80|95)/,
        );
        expect(html).not.toMatch(/#1d1b22|text-shadow|white\//i);
      }
    }
  });

  it('count down in Nunito 900, in pen', () => {
    for (const html of [
      paused(3000, 'phone'),
      paused(3000, 'screen'),
      rematch('phone'),
      rematch('screen'),
    ])
      expect(html).toMatch(
        /aria-hidden="true" class="font-num leading-none font-black text-pen[^"]*">3</,
      );
  });

  it('write the first drawer’s name in their colour', () => {
    expect(rematch('phone')).toContain('style="color:#A3346B">Jun</span> draws first');
  });
});

describe('the phone page around them', () => {
  it('keeps the Host sheet and both veils outside the inert view, so Resume and Cancel work', () => {
    const play = read('../../pages/Play.tsx');
    const view = play.indexOf('inert={');
    const paused = play.indexOf('<PausedOverlay');
    const rematch = play.indexOf('<RematchOverlay');
    const host = play.indexOf('<HostDrawer');
    // The view's div closes before the veils open: count the divs opened and closed in between.
    const between = play.slice(view, Math.min(paused, rematch));
    const opened = between.match(/<div\b/g)?.length ?? 0;
    const closed = between.match(/<\/div>/g)?.length ?? 0;
    expect(closed).toBeGreaterThan(opened);
    expect(host).toBeGreaterThan(0);
    expect(host).toBeLessThan(view);
  });
});

describe('the files F61 restyled', () => {
  it('use only the sketchbook tokens', () => {
    for (const file of [
      './PhoneStandings.tsx',
      './HostDrawer.tsx',
      '../HostPlayerList.tsx',
      '../PausedOverlay.tsx',
      '../RematchOverlay.tsx',
    ]) {
      const src = read(file);
      expect(src, file).not.toMatch(
        /#[0-9A-Fa-f]{6}\b|white\/\d|text-white|bg-white|bg-black|legacy-/,
      );
    }
  });
});

describe('the category chip at the reveal (F79)', () => {
  it('shows the word’s category under "It was…"', () => {
    const v = view('REVEAL', 'jun', { mePoints: 270 });
    const html = render({ ...v, turn: { ...v.turn!, category: { kind: 'custom' } } });
    const itWas = html.indexOf('It was…');
    expect(html.indexOf('data-category-chip')).toBeGreaterThan(itWas);
    expect(html).toContain('>Custom</span>');
  });
});

// The Screen's sketchbook frame and lobby (F62): the notebook on the desk, the rings in the gutter,
// the code strip, the players as index tabs, the lobby's two pages, and the restyled Tap to start
// and "Jun is back" notes.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, PLAYER_COLORS } from '../../../../shared/constants.js';
import type { PlayerChipView, ScreenView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { PlayerTabs } from './PlayerChip.js';
import { RejoinedToast } from './RejoinedToast.js';
import { ScreenDesk } from './ScreenDesk.js';
import { ScreenLobby } from './ScreenLobby.js';
import { StartOverlay } from './StartOverlay.js';

const pointer = vi.hoisted(() => ({ coarse: false }));
vi.mock('../../lib/usePointerCoarse.js', () => ({ usePointerCoarse: () => pointer.coarse }));

const t = translator('en');
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

const NAMES = [
  'Mika',
  'Jun',
  'Ana',
  'Bea',
  'Carlo',
  'Lou',
  'Pia',
  'Rey',
  'Sol',
  'Tin',
  'Uma',
  'Vic',
];
const chip = (i: number, extra: Partial<PlayerChipView> = {}): PlayerChipView => ({
  pid: `p${i}`,
  name: NAMES[i]!,
  color: PLAYER_COLORS[i]!,
  avatar: '🦊',
  connected: true,
  crown: i === 0,
  isDrawer: false,
  guessed: false,
  turnPoints: 0,
  score: null,
  rank: null,
  ...extra,
});
const players = (n: number) => Array.from({ length: n }, (_, i) => chip(i));

const lobby = (host: boolean, n = 3): ScreenView => ({
  role: 'screen',
  code: 'KPRW',
  phase: 'LOBBY',
  paused: null,
  rematchInMs: null,
  rematchFirst: null,
  gameNumber: 1,
  settings: DEFAULT_SETTINGS,
  players: players(n),
  turn: null,
  host: host ? { code: 'KPRW', customWordCount: 0 } : null,
  feed: [],
  almost: [],
  awards: [],
  gallery: [],
  tonight: null,
});

beforeEach(() => {
  pointer.coarse = false;
  vi.stubGlobal('window', {
    location: { host: 'sketchy.kimnejudne.dev', origin: 'https://sketchy.kimnejudne.dev' },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('the notebook on the desk', () => {
  const desk = (layout: 'landscape' | 'portrait', code: string | null = 'KPRW') =>
    renderToStaticMarkup(
      <ScreenDesk layout={layout} code={code} left={<p>left</p>} right={<p>right</p>} />,
    );

  it('is a paper book with an ink border and a hard ink shadow', () => {
    const html = desk('landscape');
    expect(html).toMatch(/data-book="true" class="[^"]*border-ink bg-paper text-ink/);
    expect(html).toContain('shadow-[0.8vmin_1vmin_0_var(--color-ink)]');
  });

  it('is a spread in landscape: left page, a gutter of vertical rings, right page', () => {
    const html = desk('landscape');
    expect(html).toContain('grid-cols-[minmax(0,1.1fr)_4.7vmin_minmax(0,1fr)]');
    expect(html.indexOf('>left<')).toBeLessThan(html.indexOf('data-rings="column"'));
    expect(html.indexOf('data-rings="column"')).toBeLessThan(html.indexOf('>right<'));
    expect(html.match(/h-\[1.7vmin\] w-\[6.4vmin\]/g)).toHaveLength(11);
  });

  it('stacks in portrait with horizontal rings between the pages', () => {
    const html = desk('portrait');
    expect(html).toContain('grid-rows-[auto_4.2vmin_minmax(0,1fr)]');
    expect(html).toContain('data-rings="row"');
    expect(html.match(/h-\[6.1vmin\] w-\[1.7vmin\]/g)).toHaveLength(14);
  });

  it('puts the code on a strip of tape under the book, the code first in portrait', () => {
    const land = desk('landscape');
    expect(land).toContain('data-code-strip');
    expect(land).toContain('data-tape="wide"');
    expect(land).toMatch(/sketchy\.kimnejudne\.dev · <strong[^>]*>KPRW<\/strong>/);
    expect(land).toMatch(/font-num/);
    expect(desk('portrait')).toMatch(/<strong[^>]*>KPRW<\/strong> · sketchy\.kimnejudne\.dev/);
  });

  it('hides the strip when asked (FINAL’s gallery)', () => {
    expect(desk('landscape', null)).not.toContain('data-code-strip');
  });

  it('is one page with no rings for `single`', () => {
    const html = renderToStaticMarkup(
      <ScreenDesk layout="landscape" code="KPRW" single={<p>one</p>} />,
    );
    expect(html).toContain('>one<');
    expect(html).not.toContain('data-rings');
  });

  it('sizes the book in vmin, leaving room for the tabs only when there are players', () => {
    const none = desk('landscape');
    const tabs = renderToStaticMarkup(
      <ScreenDesk layout="landscape" code="KPRW" players={players(3)} left="l" right="r" />,
    );
    expect(none).toContain('padding:3vmin 3vmin max(8vmin, 2.5rem) 3vmin');
    expect(tabs).toContain('padding:3vmin 28vmin max(8vmin, 2.5rem) 3vmin');
  });
});

describe('the index tabs', () => {
  it('follow the view’s turn order, each with the avatar and the name', () => {
    const html = renderToStaticMarkup(<PlayerTabs players={players(5)} layout="landscape" />);
    const at = NAMES.slice(0, 5).map((n) => html.indexOf(`>${n}<`));
    expect(at.every((x) => x > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html.match(/data-avatar/g)).toHaveLength(5);
  });

  it('stand in a landscape column, paper with an ink border, the crayon on the left edge', () => {
    const html = renderToStaticMarkup(<PlayerTabs players={players(2)} layout="landscape" />);
    expect(html).toContain('data-tabs="landscape"');
    expect(html).toContain('border-l-[1.4vmin]');
    expect(html).toContain(`border-left-color:${PLAYER_COLORS[1]}`);
    expect(html).toContain('border-ink bg-paper');
    expect(html).toContain('shadow-[0.42vmin_0.42vmin_0_var(--color-ink)]');
  });

  it('write names at 3.6 vmin or more in landscape (≥ 3.5 vh on a TV)', () => {
    const html = renderToStaticMarkup(<PlayerTabs players={players(2)} layout="landscape" />);
    expect(html).toContain('text-[max(3.6vmin,14px)]');
  });

  it('wrap a long name to two lines while the column has room, then truncate', () => {
    const eight = renderToStaticMarkup(<PlayerTabs players={players(8)} layout="landscape" />);
    expect(eight.match(/data-name="true" class="[^"]*line-clamp-2/g)).toHaveLength(8);
    const nine = renderToStaticMarkup(<PlayerTabs players={players(9)} layout="landscape" />);
    expect(nine).not.toContain('line-clamp-2');
    expect(nine.match(/data-name="true" class="[^"]*truncate/g)).toHaveLength(9);
  });

  it('share the column’s height, so twelve fit', () => {
    const html = renderToStaticMarkup(<PlayerTabs players={players(12)} layout="landscape" />);
    expect(html).toContain('grid-template-rows:repeat(12, minmax(0, 8.6vmin))');
    expect(html.match(/data-tab="/g)).toHaveLength(12);
  });

  it('run along the bottom in portrait, crayon on top, two rows above six players', () => {
    const six = renderToStaticMarkup(<PlayerTabs players={players(6)} layout="portrait" />);
    expect(six).toContain('data-tabs="portrait"');
    expect(six).toContain('border-t-[1.4vmin]');
    expect(six).toContain(`border-top-color:${PLAYER_COLORS[0]}`);
    expect(six).toContain('grid-template-rows:minmax(0, 1fr)');
    const twelve = renderToStaticMarkup(<PlayerTabs players={players(12)} layout="portrait" />);
    expect(twelve).toContain('grid-template-columns:repeat(6, minmax(0, 1fr))');
    expect(twelve).toContain('grid-template-rows:repeat(2, minmax(0, 1fr))');
    expect(twelve.match(/data-tab="/g)).toHaveLength(12);
  });

  it('keep at least four columns in portrait, so two players get tabs, not banners', () => {
    const html = renderToStaticMarkup(<PlayerTabs players={players(2)} layout="portrait" />);
    expect(html).toContain('grid-template-columns:repeat(4, minmax(0, 1fr))');
  });

  it('crown the host on the avatar, fade an offline player, and are buttons only with onSelect', () => {
    const list = [chip(0), chip(1, { connected: false })];
    const html = renderToStaticMarkup(<PlayerTabs players={list} layout="landscape" />);
    expect(html).toContain('👑');
    expect(html).toContain('opacity-60');
    expect(html).not.toContain('<button');
    const host = renderToStaticMarkup(
      <PlayerTabs players={list} layout="landscape" onSelect={() => {}} />,
    );
    expect(host.match(/<button type="button" aria-haspopup="dialog"/g)).toHaveLength(2);
  });
});

describe('the lobby spread', () => {
  const render = (host: boolean, layout: 'landscape' | 'portrait' = 'landscape', n = 3) =>
    renderToStaticMarkup(
      <ScreenLobby view={lobby(host, n)} socket={{} as GameSocket} t={t} layout={layout} />,
    );

  it('writes the logo, "Join at …", the code as 4 Nunito cells on pen underlines and the taped QR', () => {
    const html = render(false);
    const logo = html.indexOf('Sketchy');
    const join = html.indexOf('Join at sketchy.kimnejudne.dev');
    const cells = html.match(/border-pen text-center font-num[^"]*">([A-Z])</g);
    expect(cells).toHaveLength(4);
    expect(html).toContain('<p class="sr-only">Code: KPRW</p>');
    const tape = html.indexOf('data-tape="tl"');
    const qr = html.indexOf('Scan to join');
    expect(logo).toBeGreaterThan(-1);
    expect(join).toBeGreaterThan(logo);
    expect(tape).toBeGreaterThan(join);
    expect(qr).toBeGreaterThan(tape);
    expect(html).toContain('bg-canvas text-ink');
  });

  it('numbers How to play in pen circles, the copy whole for screen readers', () => {
    const html = render(false);
    for (const [i, step] of [
      'One person draws on their phone',
      'Everyone else types guesses 🤫',
      'Faster = more points',
    ].entries()) {
      expect(html).toContain(`<span class="sr-only">${i + 1} · ${step}</span>`);
      expect(html).toContain(`<span aria-hidden="true">${step}</span>`);
    }
    expect(
      html.match(/rounded-full border-\[length:max\(2px,0\.35vmin\)\] border-pen/g),
    ).toHaveLength(3);
  });

  it('has on the right page "Who’s here", the hosting line, the settings line and Start', () => {
    const html = render(true);
    const right = html.indexOf('data-rings');
    const order = [
      'Who’s here',
      '👑 Mika is hosting · tap a name to change',
      'Classic',
      'Settings',
      'Add your own words',
      'Start game',
    ].map((s) => html.indexOf(s, right));
    expect(order.every((x) => x > right)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toMatch(/sketch-border[^"]*bg-hl text-ink[^"]*">Start game/);
  });

  it('shows the waiting line without the token, and no buttons at all', () => {
    const html = render(false);
    expect(html).toContain('Waiting for 👑 Mika to start');
    expect(html).not.toContain('Start game');
    expect(html).not.toContain('<button');
  });

  it('stands the players as tabs beside the book, buttons on the token Screen', () => {
    expect(render(false)).toContain('data-tabs="landscape"');
    expect(render(true, 'portrait')).toContain('data-tabs="portrait"');
    expect(render(true).match(/data-tab="/g)).toHaveLength(3);
  });

  it('keeps Start and the small buttons on one row in portrait, Start full width in landscape', () => {
    expect(render(true, 'portrait')).toMatch(/min-w-\[16rem\] flex-1[^"]*">Start game/);
    expect(render(true, 'landscape')).toMatch(/w-full[^"]*">Start game/);
  });

  it('writes "Keep this device plugged in" on a sticky note', () => {
    pointer.coarse = true;
    expect(render(false)).toMatch(/bg-sticky[^"]*">🔌 Keep this device plugged in/);
  });
});

describe('the Tap to start veil and "Jun is back"', () => {
  it('is a paper veil with the label on the highlighter and the hint in soft', () => {
    const html = renderToStaticMarkup(<StartOverlay coarse onStart={() => {}} t={t} />);
    expect(html).toContain('bg-paper/95');
    expect(html).toContain('font-hand text-ink');
    expect(html).toMatch(/class="highlight[^"]*">Tap to start</);
    expect(html).toMatch(/text-soft">Turns on sound/);
  });

  it('writes "Jun is back (new phone)" on a hand-bordered sticky note', () => {
    const html = renderToStaticMarkup(<RejoinedToast name="Jun" t={t} />);
    expect(html).toMatch(/sketch-border bg-sticky[^"]*text-ink/);
  });
});

describe('the restyled files', () => {
  it('use only the sketchbook tokens: no hex, no white/NN, no Fredoka', () => {
    for (const file of [
      './ScreenDesk.tsx',
      './PlayerChip.tsx',
      './ScreenLobby.tsx',
      './StartOverlay.tsx',
      './RejoinedToast.tsx',
      '../../pages/Screen.tsx',
    ]) {
      const src = read(file);
      expect(src, file).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
      expect(src, file).not.toMatch(/white\/\d|text-white|bg-white|font-display/);
    }
  });

  it('puts the desk behind every Screen page', () => {
    expect(read('../../pages/Screen.tsx')).toMatch(
      /<main className="[^"]*bg-desk[^"]*font-hand text-ink/,
    );
  });
});

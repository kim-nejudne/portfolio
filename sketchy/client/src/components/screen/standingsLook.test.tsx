// The Screen's scoreboard and final in the sketchbook (F66): one dot-grid page with crayon bars,
// ↑n/↓n and rows sliding from their place before the round's last turn; the final's drawn podium
// (2-1-3, rising 3rd, 2nd, 1st), 4th and later on a line, award sticky notes, the gallery's taped
// sheets and the token Screen's Rematch / Back to lobby sketch buttons.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { PlayerChipView, ScreenView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { ScreenGallery as GalleryStore } from '../../lib/gallery.js';
import type { GameSocket } from '../../lib/socket.js';
import { sheetWidth } from './ScreenGallery.js';
import { ScreenStandings, previousPlaces } from './ScreenStandings.js';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

beforeAll(() => {
  vi.stubGlobal('window', {
    location: { host: 'sketchy.kimnejudne.dev', origin: 'https://sketchy.kimnejudne.dev' },
  });
});
afterAll(() => vi.unstubAllGlobals());

const chip = (
  pid: string,
  color: string,
  score: number,
  rank: number,
  prevRank?: number,
): PlayerChipView => ({
  pid,
  name: pid,
  color,
  connected: true,
  crown: false,
  isDrawer: false,
  avatar: '🦊',
  guessed: false,
  turnPoints: 0,
  score,
  rank,
  ...(prevRank === undefined ? {} : { prevRank }),
});

// Join order: Mika, Jun, Ana, Bea, Carlo. Before the last turn: Ana, Mika, Jun, Bea, Carlo.
const PLAYERS = [
  chip('Mika', '#B5321A', 640, 3, 2),
  chip('Jun', '#1A7A4A', 980, 1, 3),
  chip('Ana', '#2B55B8', 905, 2, 1),
  chip('Bea', '#A0327A', 520, 4, 4),
  chip('Carlo', '#7A5A0A', 310, 5, 5),
];

function view(phase: 'SCOREBOARD' | 'FINAL', extra: Partial<ScreenView> = {}): ScreenView {
  return {
    role: 'screen',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS, cycles: 2 },
    players: PLAYERS,
    turn: { cycle: 1 } as ScreenView['turn'],
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

const store: GalleryStore = {
  want: () => {},
  retry: () => {},
  get: () => undefined,
  version: () => 0,
  subscribe: () => () => {},
  clear: () => {},
};
const socket = { connected: true } as unknown as GameSocket;

const render = (
  v: ScreenView,
  layout: 'landscape' | 'portrait' = 'landscape',
  withSocket = false,
) =>
  renderToStaticMarkup(
    <ScreenStandings
      view={v}
      layout={layout}
      gallery={store}
      {...(withSocket ? { socket } : {})}
      t={translator(v.settings.copy)}
    />,
  );

/** A chip as the final's view carries it: no previous rank. */
function withoutPrev(p: PlayerChipView): PlayerChipView {
  const copy = { ...p };
  delete copy.prevRank;
  return copy;
}

/** The markup of one scoreboard row. */
const row = (html: string, pid: string) => {
  const at = html.indexOf(`data-row="${pid}"`);
  return html.slice(at, html.indexOf('</li>', at));
};

describe('the scoreboard page (F66)', () => {
  it('is one dot-grid page in the book, "Round 1 of 2 done", with no tabs and the code strip', () => {
    const html = render(view('SCOREBOARD'));
    expect(html).toContain('data-book');
    expect(html).not.toContain('data-page=');
    expect(html).toContain('paper-dots');
    expect(html).toContain('Round 1 of 2 done');
    expect(html).not.toContain('data-tab');
    expect(html).toContain('data-code-strip');
    expect(html).not.toContain('legacy-night');
  });

  it('each row: rank, avatar, name in colour, a crayon bar in a hand-bordered track, the score', () => {
    const jun = row(render(view('SCOREBOARD')), 'Jun');
    const at = (s: string) => jun.indexOf(s);
    expect(at('>1<')).toBeGreaterThan(-1);
    expect(at('data-avatar')).toBeGreaterThan(at('>1<'));
    expect(jun).toMatch(/color:#1A7A4A[^>]*>Jun</);
    expect(at('data-bar')).toBeGreaterThan(at('>Jun<'));
    expect(at('>980<')).toBeGreaterThan(at('data-bar'));
    // The track is white paper with an ink border, so a short bar reads against its length.
    expect(jun).toMatch(
      /data-bar[^>]*bg-canvas[^>]*border-ink|data-bar[^>]*border-ink[^>]*bg-canvas/,
    );
    // The leader's bar is full; the others are a share of the leader's score, in their crayon.
    expect(jun).toContain('width:100%;background:#1A7A4A');
    expect(row(render(view('SCOREBOARD')), 'Carlo')).toContain('width:32%;background:#7A5A0A');
    expect(jun).toMatch(/font-num[^"]*font-black[^>]*>980</);
  });

  it('↑n in the success colour, ↓n in red pen, nothing for a row that stayed', () => {
    const html = render(view('SCOREBOARD'));
    expect(row(html, 'Jun')).toMatch(/data-move="up"[^>]*text-success/);
    expect(row(html, 'Jun')).toContain('↑2');
    expect(row(html, 'Jun')).toContain('up 2');
    expect(row(html, 'Ana')).toMatch(/data-move="down"[^>]*text-red/);
    expect(row(html, 'Ana')).toContain('↓1');
    expect(row(html, 'Mika')).toContain('↓1');
    expect(row(html, 'Bea')).not.toContain('data-move');
    // No previous ranks in the view: no arrows at all.
    const none = view('SCOREBOARD', {
      players: PLAYERS.map(withoutPrev),
    });
    expect(render(none)).not.toContain('data-move');
  });

  it('Taglish says the move too', () => {
    const html = render(view('SCOREBOARD', { settings: { ...DEFAULT_SETTINGS, copy: 'taglish' } }));
    expect(row(html, 'Jun')).toContain('umakyat ng 2');
    expect(row(html, 'Ana')).toContain('bumaba ng 1');
  });

  it('rows slide from their place before the last turn and the bars grow, behind motion-safe', () => {
    const html = render(view('SCOREBOARD'));
    // Jun was 3rd (place 2), now 1st: he slides up from two rows down.
    expect(row(html, 'Jun')).toContain('--move-y:calc(2 * (100% + 1.5vmin))');
    expect(row(html, 'Ana')).toContain('--move-y:calc(-1 * (100% + 1.5vmin))');
    expect(row(html, 'Bea')).toContain('--move-y:calc(0 * (100% + 1.5vmin))');
    expect(html).toMatch(/data-row="Jun"[^>]*motion-safe:animate-move/);
    expect(html).toMatch(/motion-safe:animate-grow/);
    const css = read('../../index.css');
    expect(css).toContain('--animate-move: sk-move');
    expect(css).toContain('--animate-grow: sk-grow');
    expect(css).toMatch(/@keyframes sk-move \{\s*from \{\s*transform: translate\(var\(--move-x/);
  });

  it('in two columns a row slides across as well as up', () => {
    // Eight players: four rows a column. P7 was first and is now last (column 2, row 4).
    const eight = Array.from({ length: 8 }, (_, i) =>
      chip(`P${i}`, '#2B55B8', 800 - i * 10, i + 1, i === 7 ? 1 : i + 2),
    );
    const html = render(view('SCOREBOARD', { players: eight }));
    expect(html).toContain('grid-cols-2');
    expect(row(html, 'P7')).toContain('--move-x:calc(-1 * (100% + 5vmin))');
    expect(row(html, 'P7')).toContain('--move-y:calc(-3 * (100% + 1.5vmin))');
  });

  it('previousPlaces orders by the previous rank, ties in the view’s order', () => {
    expect(previousPlaces(PLAYERS)).toEqual(
      new Map([
        ['Ana', 0],
        ['Mika', 1],
        ['Jun', 2],
        ['Bea', 3],
        ['Carlo', 4],
      ]),
    );
    const tied = [
      chip('A', '#000', 0, 1, 2),
      chip('B', '#000', 0, 1, 1),
      chip('C', '#000', 0, 1, 2),
    ];
    expect([...previousPlaces(tied)!.entries()]).toEqual([
      ['B', 0],
      ['A', 1],
      ['C', 2],
    ]);
    expect(previousPlaces([chip('A', '#000', 0, 1)])).toBeNull();
  });
});

describe('the final page (F66)', () => {
  const DRAWINGS: ScreenView['gallery'] = Array.from({ length: 5 }, (_, i) => ({
    turnId: i + 1,
    drawerPid: PLAYERS[i]!.pid,
    word: `word${i}`,
  }));
  const final = (extra: Partial<ScreenView> = {}) =>
    view('FINAL', {
      players: PLAYERS.map(withoutPrev),
      gallery: DRAWINGS,
      awards: [
        { kind: 'picasso', pid: 'Mika' },
        { kind: 'bilis', pid: 'Jun' },
      ],
      ...extra,
    });

  it('is a spread: the podium on the left page; awards, gallery and actions on the right', () => {
    const host = { host: { customWords: 0 } } as unknown as Partial<ScreenView>;
    const html = render(final(host), 'landscape', true);
    const left = html.indexOf('data-page="left"');
    const right = html.indexOf('data-page="right"');
    expect(left).toBeGreaterThan(-1);
    expect(html.indexOf('data-podium')).toBeGreaterThan(left);
    expect(html.indexOf('data-podium')).toBeLessThan(right);
    expect(html.indexOf('data-awards')).toBeGreaterThan(right);
    expect(html.indexOf('data-gallery')).toBeGreaterThan(html.indexOf('data-awards'));
    expect(html.indexOf('data-final-action="rematch"')).toBeGreaterThan(
      html.indexOf('data-gallery'),
    );
    // FINAL's gallery takes the room: no code strip, no tabs.
    expect(html).not.toContain('data-code-strip');
    expect(html).not.toContain('data-tab');
  });

  it('the podium stands 2-1-3, listed 1-2-3, in crayon blocks with ink borders and hard shadows', () => {
    const html = render(final());
    const places = [...html.matchAll(/data-podium-place="(\d)" class="([^"]*)"/g)];
    expect(places.map((m) => m[1])).toEqual(['1', '2', '3']);
    expect(places[0]![2]).toContain('order-2');
    expect(places[1]![2]).toContain('order-1');
    expect(places[2]![2]).toContain('order-3');
    expect(html.match(/data-block/g)).toHaveLength(3);
    // Screen readers hear the place first ("1. Jun 980"); the block still stands last.
    const first = html.slice(html.indexOf('data-podium-place="1"'));
    expect(first.indexOf('data-block')).toBeLessThan(first.indexOf('>Jun<'));
    expect(first).toMatch(/data-block[^>]*order-last/);
    expect(html).toMatch(
      /data-block[^>]*border-ink[^>]*shadow-\[0\.55vmin_0\.55vmin_0_var\(--color-ink\)\]/,
    );
    expect(html).toContain('background:#1A7A4A;height:22vmin');
    // Shorter in portrait, where the podium's page shares the height with the gallery's.
    expect(render(final(), 'portrait')).toContain('background:#1A7A4A;height:13vmin');
    expect(html).toContain('background:#2B55B8;height:15vmin');
    expect(html).toContain('background:#B5321A;height:10vmin');
  });

  it('a tie for first stands as tall as first', () => {
    const tied = final({
      players: [
        chip('Ana', '#2B55B8', 900, 1),
        chip('Bea', '#A0327A', 900, 1),
        chip('Jun', '#1A7A4A', 100, 3),
      ],
    });
    expect(render(tied).match(/height:22vmin/g)).toHaveLength(2);
  });

  it('the blocks rise 3rd, then 2nd, then 1st, behind motion-safe', () => {
    const html = render(final());
    const delay = (place: number) =>
      Number(
        html.match(new RegExp(`data-podium-place="${place}"[^>]*animation-delay:(\\d+)ms`))![1],
      );
    expect(delay(3)).toBeLessThan(delay(2));
    expect(delay(2)).toBeLessThan(delay(1));
    expect(html).toMatch(/data-podium-place="1"[^>]*motion-safe:animate-rise/);
    expect(read('../../index.css')).toContain('--animate-rise: sk-rise');
  });

  it('4th and later sit on one line, after the podium', () => {
    const html = render(final());
    const rest = html.slice(
      html.indexOf('data-rest'),
      html.indexOf('</ol>', html.indexOf('data-rest')),
    );
    expect(rest).toMatch(/>4\.<.*>Bea<.*>520<.*>5\.<.*>Carlo<.*>310</);
    expect(html.indexOf('data-rest')).toBeGreaterThan(html.indexOf('data-podium'));
    // Three players: nobody past the podium, no line.
    expect(render(final({ players: PLAYERS.slice(0, 3) }))).not.toContain('data-rest');
  });

  it('awards are taped sticky notes edged in the winner’s crayon', () => {
    const html = render(final());
    const notes = [...html.matchAll(/<li data-award="[^"]*" class="([^"]*)" style="([^"]*)"/g)];
    expect(notes).toHaveLength(2);
    for (const [, cls] of notes) {
      expect(cls).toContain('bg-sticky');
      expect(cls).toContain('shadow-[0.4vmin_0.4vmin_0_var(--color-ink)]');
    }
    expect(notes[0]![2]).toContain('border-left-color:#B5321A');
    const award = html.slice(html.indexOf('data-award="picasso"'));
    expect(award.slice(0, award.indexOf('</li>'))).toContain('data-tape="top"');
  });

  it('the gallery is taped white sheets, two rows from five drawings, sized from the page', () => {
    const html = render(final());
    expect(html.match(/data-sheet/g)).toHaveLength(5);
    const sheet = html.slice(html.indexOf('data-sheet'));
    expect(sheet).toMatch(/<button[^>]*bg-canvas/);
    expect(sheet.slice(0, sheet.indexOf('</li>'))).toContain('data-tape="top"');
    expect(html).toContain('grid-template-rows:repeat(2, minmax(0, 1fr))');
    expect(html).toContain(`grid-auto-columns:${sheetWidth(2)}`);
    const four = render(final({ gallery: DRAWINGS.slice(0, 4) }));
    expect(four).toContain('grid-template-rows:repeat(1, minmax(0, 1fr))');
    expect(sheetWidth(1)).toBe(
      'max(8vmin, min(33cqw, calc((100cqh - 12px - 0 * 2vmin) / 1 - 2 * 1.15 * max(3.5vmin, 14px) - 2.2vmin)))',
    );
  });

  it('Rematch and Back to lobby are sketch buttons on the token Screen only, gone during the countdown', () => {
    const host = { host: { customWords: 0 } } as unknown as Partial<ScreenView>;
    const html = render(final(host), 'landscape', true);
    expect(html).toMatch(/data-final-action="rematch"[^>]*sketch-border[^>]*bg-hl[^>]*>Rematch</);
    expect(html).toMatch(
      /data-final-action="backToLobby"[^>]*sketch-border[^>]*bg-paper[^>]*>Back to lobby</,
    );
    expect(render(final(), 'landscape', true)).not.toContain('data-final-action');
    expect(render(final({ ...host, rematchInMs: 2000 }), 'landscape', true)).not.toContain(
      'data-final-action',
    );
  });

  it('portrait puts Rematch and Back to lobby beside the title, so the gallery keeps its height', () => {
    const host = { host: { customWords: 0 } } as unknown as Partial<ScreenView>;
    const html = render(final(host), 'portrait', true);
    const rings = html.indexOf('data-rings="row"');
    expect(html.indexOf('data-final-action="rematch"')).toBeGreaterThan(
      html.indexOf('Final scores'),
    );
    expect(html.indexOf('data-final-action="rematch"')).toBeLessThan(html.indexOf('data-podium'));
    expect(html.indexOf('data-final-action="rematch"')).toBeLessThan(rings);
    expect(html.match(/data-final-action="rematch"/g)).toHaveLength(1);
  });

  it('portrait stacks the podium page over the gallery page', () => {
    const html = render(final(), 'portrait');
    expect(html).toContain('data-desk="portrait"');
    expect(html).toContain('data-rings="row"');
    expect(html.indexOf('data-podium')).toBeLessThan(html.indexOf('data-rings="row"'));
    expect(html.indexOf('data-gallery')).toBeGreaterThan(html.indexOf('data-rings="row"'));
  });

  it('Tonight is a ruled paper card, not the old dark panel', () => {
    const tonight = [{ pid: 'Cy', name: 'Cy', color: '#2B55B8', total: 1100, rank: 1 }];
    const html = render(final({ gameNumber: 2, tonight }));
    expect(html).toMatch(/data-tonight[^>]*border-ink[^>]*bg-paper/);
    expect(html).toContain('Tonight · 2 games');
  });
});

describe('the restyled standings files', () => {
  it('use only the sketchbook tokens: no hex, no white/NN, no Fredoka, no dark page', () => {
    for (const file of ['./ScreenStandings.tsx', './ScreenAwards.tsx', './ScreenGallery.tsx']) {
      const src = read(file);
      expect(src, file).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
      expect(src, file).not.toMatch(
        /white\/\d|text-white|bg-black|font-display|font-bold|font-semibold|legacy-/,
      );
    }
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import { createInkStack } from '../../../../shared/ink.js';
import type { Phase, PlayerChipView, ScreenView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { GalleryEntry, ScreenGallery } from '../../lib/gallery.js';
import { longestWord } from './ScreenGallery.js';
import { ScreenStandings } from './ScreenStandings.js';

const t = translator('en');

const chip = (pid: string, color: string, rank: number): PlayerChipView => ({
  pid,
  name: pid,
  color,
  connected: true,
  crown: false,
  isDrawer: false,
  hasDoodle: false,
  guessed: false,
  turnPoints: 0,
  score: 100,
  rank,
});

function view(phase: Phase, gallery: ScreenView['gallery']): ScreenView {
  return {
    role: 'screen',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 2,
    settings: DEFAULT_SETTINGS,
    players: [chip('Mika', '#FF6B35', 1), chip('Jun', '#3A86FF', 2)],
    turn: null,
    host: null,
    feed: [],
    almost: [],
    awards: [],
    gallery,
    // Bea left after drawing; the night's totals still name her.
    tonight: [{ pid: 'Bea', name: 'Bea', color: '#8338EC', total: 50, rank: 3 }],
  };
}

/** A store already holding these answers. */
function store(entries: Record<number, GalleryEntry>): ScreenGallery {
  return {
    want: () => {},
    retry: () => {},
    get: (turnId) => entries[turnId],
    version: () => 0,
    subscribe: () => () => {},
    clear: () => {},
  };
}

const DRAWINGS: ScreenView['gallery'] = [
  { turnId: 1, drawerPid: 'Mika', word: 'tsinelas' },
  { turnId: 2, drawerPid: 'Jun', word: 'kalabaw' },
  { turnId: 3, drawerPid: 'Bea', word: 'karaoke' },
];

const render = (v: ScreenView, entries: Record<number, GalleryEntry>) =>
  renderToStaticMarkup(
    <ScreenStandings view={v} layout="landscape" gallery={store(entries)} t={t} />,
  );

describe('Screen gallery (F49)', () => {
  it('lists every drawing of the game in turn order, word and drawer under each', () => {
    const html = render(view('FINAL', DRAWINGS), {});
    expect(html).toContain('Gallery');
    const at = ['tsinelas', 'kalabaw', 'karaoke'].map((w) => html.indexOf(`>${w}<`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(html).toContain('by Mika');
    expect(html).toContain('by Jun');
    // A drawer who left is named from the night's totals, in their colour.
    expect(html).toContain('color:#8338EC">by Bea');
    expect(html).toContain('aria-label="karaoke by Bea"');
  });

  it('draws a kept drawing, shows "Drawing not kept" for a dropped one, and a blank one loading', () => {
    const html = render(view('FINAL', DRAWINGS), {
      1: { status: 'ready', stack: createInkStack() },
      2: { status: 'notKept' },
    });
    expect(html.match(/<canvas/g)).toHaveLength(1);
    expect(html.match(/Drawing not kept/g)).toHaveLength(1);
    expect(html.match(/animate-pulse/g)).toHaveLength(1);
  });

  it('shows no gallery on the scoreboard, or with no drawings', () => {
    expect(render(view('SCOREBOARD', []), {})).not.toContain('Gallery');
    expect(render(view('FINAL', []), {})).not.toContain('Gallery');
  });

  it('has the gallery copy in Taglish too', () => {
    const html = renderToStaticMarkup(
      <ScreenStandings
        view={view('FINAL', DRAWINGS)}
        layout="portrait"
        gallery={store({ 3: { status: 'notKept' } })}
        t={translator('taglish')}
      />,
    );
    expect(html).toContain('ni Mika');
    expect(html).toContain('Hindi na naitabi ang drawing');
  });

  it('sizes the viewer’s word by its longest part, so "refrigerator" fits its column', () => {
    expect(longestWord('pila')).toBe(5);
    expect(longestWord('refrigerator')).toBe(12);
    expect(longestWord('luksong  baka')).toBe(7);
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { Phase, PlayerChipView, ScreenView } from '../../../../shared/types.js';
import { t } from '../../lib/copy.js';
import type { ScreenGallery } from '../../lib/gallery.js';
import { ScreenStandings } from './ScreenStandings.js';

const chip = (pid: string, color: string, score: number, rank: number): PlayerChipView => ({
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
});

const AWARDS: ScreenView['awards'] = [
  { kind: 'picasso', pid: 'Mika' },
  { kind: 'speedDemon', pid: 'Jun' },
  { kind: 'modernArt', pid: 'Bea', turnId: 3 },
];

function view(phase: Phase, awards = AWARDS): ScreenView {
  return {
    role: 'screen',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 2,
    settings: DEFAULT_SETTINGS,
    players: [chip('Mika', '#C2410C', 900, 1), chip('Jun', '#3A86FF', 500, 2)],
    turn: null,
    host: null,
    feed: [],
    almost: [],
    awards,
    gallery: [
      { turnId: 1, drawerPid: 'Mika', word: 'umbrella' },
      { turnId: 3, drawerPid: 'Bea', word: 'karaoke' },
    ],
    // Bea left after the game; the night's totals still name her.
    tonight: [{ pid: 'Bea', name: 'Bea', color: '#8338EC', total: 50, rank: 3 }],
    nextDrawer: null,
  };
}

const gallery: ScreenGallery = {
  want: () => {},
  retry: () => {},
  get: () => undefined,
  version: () => 0,
  subscribe: () => () => {},
  clear: () => {},
};

const render = (v: ScreenView, layout: 'landscape' | 'portrait' = 'landscape') =>
  renderToStaticMarkup(<ScreenStandings view={v} layout={layout} gallery={gallery} t={t} />);

describe('Tonight’s awards on the Screen', () => {
  it('one card per award, after the scores and before the gallery', () => {
    const html = render(view('FINAL'));
    expect(html).toContain('Tonight’s awards');
    expect(html.match(/<li[^>]*animate-pop/g)).toHaveLength(3);
    const at = (s: string) => html.indexOf(s);
    expect(at('🎨 Picasso')).toBeLessThan(at('⚡ Speed Demon'));
    expect(at('⚡ Speed Demon')).toBeLessThan(at('🖼️ Modern art'));
    // After the podium's last row, before the gallery's title.
    expect(at('500')).toBeLessThan(at('🎨 Picasso'));
    expect(at('🖼️ Modern art')).toBeLessThan(at('Gallery'));
  });

  it('names each winner in their colour, a winner who left too, with the reason', () => {
    const html = render(view('FINAL'));
    expect(html).toMatch(/color:#C2410C[^>]*>Mika</);
    expect(html).toMatch(/color:#8338EC[^>]*>Bea</);
    expect(html).toContain('Most drawer points');
    expect(html).toContain('Fastest guess of the night');
  });

  it('Modern art names the drawing nobody got', () => {
    expect(render(view('FINAL'))).toContain('The drawing nobody got: karaoke');
  });

  it('none on SCOREBOARD, and no section with no awards', () => {
    expect(render(view('SCOREBOARD'))).not.toContain('Tonight’s awards');
    expect(render(view('FINAL', []))).not.toContain('Tonight’s awards');
  });

  it('the same English cards in portrait', () => {
    const html = render(view('FINAL'), 'portrait');
    expect(html).toContain('Tonight’s awards');
    expect(html).toContain('⚡ Speed Demon');
    expect(html).toContain('Most drawer points');
  });

  it('the scores shrink to the height they are given, down to a floor', () => {
    // F66: the final's list became the podium and the line for 4th on, which keeps its names at
    // 3.6 vmin (wrapping in a full room); the scoreboard's rows are the list that shrinks.
    const ten = Array.from({ length: 10 }, (_, i) => chip(`P${i}`, '#C2410C', 1000 - i, i + 1));
    const final = render({ ...view('FINAL'), players: ten });
    const rest = final.slice(final.indexOf('data-rest'));
    expect(rest).toContain('text-[max(3.6vmin,16px)]');
    for (let i = 3; i < 10; i++) expect(rest).toContain(`>P${i}<`);
    // Ten players in two columns: five rows share the box's height (`cqh`).
    const html = render({ ...view('SCOREBOARD'), players: ten });
    expect(html).toContain('container-type:size');
    expect(html).toContain(
      // …and no wider than half the box's width holds (two columns of 20 em).
      'font-size:min(max(max(2vmin, 13px), min(max(4.5vmin, 20px), calc((100cqh - 6vmin) / 10))), calc((100cqw - 5vmin) / 40))',
    );
    // Where container units aren't supported the size class still applies.
    expect(html).toContain('text-[max(4.5vmin,20px)]');
  });

  it('Tonight: a column sized to its height on a wide Screen, one line of two on a narrower one', () => {
    const night = Array.from({ length: 10 }, (_, i) => ({
      pid: `N${i}`,
      name: `N${i}`,
      color: '#C2410C',
      total: 2000 - i,
      rank: i + 1,
    }));
    const html = render({ ...view('FINAL'), tonight: night });
    // 8 rows and "+2 more": 9 lines.
    expect(html).toContain('--tonight-size:min(max(3.2vmin, 16px), calc(100cqh / 18.5))');
    // F66: the strip lists two (three overprinted a 4:3 page beside the podium).
    expect(html).toContain('+8 more');
    expect(html).toContain('+2 more');
    // F66: with the podium above it, portrait has no height for the wrapped panel and the gallery
    // both, so it takes the one line too, of two (it used to list eight).
    const portrait = render({ ...view('FINAL'), tonight: night }, 'portrait');
    expect(portrait).toContain('+8 more');
    expect(portrait).toMatch(/data-tonight[^>]*overflow-hidden py-\[1\.2vmin\]/);
    // Without the gallery there is room for the wrapped panel.
    const bare = render({ ...view('FINAL'), tonight: night, gallery: [] }, 'portrait');
    expect(bare).not.toContain('+8 more');
    expect(bare).toContain('+2 more');
  });
});

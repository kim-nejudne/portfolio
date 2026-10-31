import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { Phase, PlayerChipView, ScreenView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { ScreenGallery } from '../../lib/gallery.js';
import { ScreenStandings } from './ScreenStandings.js';

const chip = (pid: string, color: string, score: number, rank: number): PlayerChipView => ({
  pid,
  name: pid,
  color,
  connected: true,
  crown: false,
  isDrawer: false,
  hasDoodle: false,
  guessed: false,
  turnPoints: 0,
  score,
  rank,
});

const AWARDS: ScreenView['awards'] = [
  { kind: 'picasso', pid: 'Mika' },
  { kind: 'bilis', pid: 'Jun' },
  { kind: 'modernArt', pid: 'Bea', turnId: 3 },
];

function view(phase: Phase, awards = AWARDS, copy: 'en' | 'taglish' = 'en'): ScreenView {
  return {
    role: 'screen',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 2,
    settings: { ...DEFAULT_SETTINGS, copy },
    players: [chip('Mika', '#FF6B35', 900, 1), chip('Jun', '#3A86FF', 500, 2)],
    turn: null,
    host: null,
    feed: [],
    almost: [],
    awards,
    gallery: [
      { turnId: 1, drawerPid: 'Mika', word: 'tsinelas' },
      { turnId: 3, drawerPid: 'Bea', word: 'karaoke' },
    ],
    // Bea left after the game; the night's totals still name her.
    tonight: [{ pid: 'Bea', name: 'Bea', color: '#8338EC', total: 50, rank: 3 }],
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
  renderToStaticMarkup(
    <ScreenStandings view={v} layout={layout} gallery={gallery} t={translator(v.settings.copy)} />,
  );

describe('Tonight’s awards on the Screen', () => {
  it('one card per award, after the scores and before the gallery', () => {
    const html = render(view('FINAL'));
    expect(html).toContain('Tonight’s awards');
    expect(html.match(/<li[^>]*animate-pop/g)).toHaveLength(3);
    const at = (s: string) => html.indexOf(s);
    expect(at('🎨 Picasso')).toBeLessThan(at('⚡ Bilis!'));
    expect(at('⚡ Bilis!')).toBeLessThan(at('🖼️ Modern art'));
    // After the podium's last row, before the gallery's title.
    expect(at('500')).toBeLessThan(at('🎨 Picasso'));
    expect(at('🖼️ Modern art')).toBeLessThan(at('Gallery'));
  });

  it('names each winner in their colour, a winner who left too, with the reason', () => {
    const html = render(view('FINAL'));
    expect(html).toMatch(/color:#FF6B35[^>]*>Mika</);
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

  it('Taglish copy, in portrait too', () => {
    const html = render(view('FINAL', AWARDS, 'taglish'), 'portrait');
    expect(html).toContain('Awards ngayong gabi');
    expect(html).toContain('Pinakamaraming points sa drawing');
  });

  it('the scores shrink to the height the awards and gallery leave, down to a floor', () => {
    // Ten players in two columns: five rows share the box's height (`cqh`).
    const ten = Array.from({ length: 10 }, (_, i) => chip(`P${i}`, '#FF6B35', 1000 - i, i + 1));
    const html = render({ ...view('FINAL'), players: ten });
    expect(html).toContain('container-type:size');
    expect(html).toContain(
      'font-size:max(max(2vmin, 13px), min(max(3.6vmin, 17px), calc((100cqh - 2vmin) / 10)))',
    );
    // Where container units aren't supported the size class still applies.
    expect(html).toContain('text-[max(3.6vmin,17px)]');
  });

  it('Tonight: a column sized to its height on a wide Screen, one line of three on a narrower one', () => {
    const night = Array.from({ length: 10 }, (_, i) => ({
      pid: `N${i}`,
      name: `N${i}`,
      color: '#FF6B35',
      total: 2000 - i,
      rank: i + 1,
    }));
    const html = render({ ...view('FINAL'), tonight: night });
    // 8 rows and "+2 more": 9 lines.
    expect(html).toContain('--tonight-size:min(max(3.2vmin, 16px), calc(100cqh / 18.5))');
    expect(html).toContain('+7 more');
    expect(html).toContain('+2 more');
    const portrait = render({ ...view('FINAL'), tonight: night }, 'portrait');
    expect(portrait).not.toContain('+7 more');
  });
});

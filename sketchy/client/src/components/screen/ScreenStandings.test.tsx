import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { Phase, PlayerChipView, ScreenView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import { ScreenStandings } from './ScreenStandings.js';

const t = translator('en');

const chip = (pid: string, score: number, rank: number): PlayerChipView => ({
  pid,
  name: pid,
  color: '#FF6B35',
  connected: true,
  crown: false,
  isDrawer: false,
  avatar: '🦊',
  guessed: false,
  turnPoints: 0,
  score,
  rank,
});

function view(phase: Phase): ScreenView {
  return {
    role: 'screen',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS, cycles: 2 },
    // Join order; Bea and Ana tie for first.
    players: [chip('Mika', 100, 3), chip('Ana', 300, 1), chip('Bea', 300, 1), chip('Jun', 0, 4)],
    turn: null,
    host: null,
    feed: [],
    almost: [],
    awards: [],
    gallery: [],
    tonight: null,
  };
}

/** The names in the order the markup lists them. */
const order = (html: string) =>
  ['Mika', 'Ana', 'Bea', 'Jun'].sort((a, b) => html.indexOf(`>${a}<`) - html.indexOf(`>${b}<`));

describe('Screen standings (F20)', () => {
  it('lists players in the server’s shared ranks, ties in join order, with two gold medals', () => {
    const html = renderToStaticMarkup(
      <ScreenStandings view={view('FINAL')} layout="landscape" t={t} />,
    );
    expect(order(html)).toEqual(['Ana', 'Bea', 'Mika', 'Jun']);
    expect(html.match(/🥇/g)).toHaveLength(2);
    expect(html).not.toContain('🥈');
    expect(html).toContain('<span aria-hidden="true">🥉</span><span class="sr-only">3.</span>');
    expect(html).toContain('4.');
    expect(html).toContain('Final scores');
  });

  it('titles the scoreboard with the round just done', () => {
    const v = { ...view('SCOREBOARD'), turn: { cycle: 1 } as ScreenView['turn'] };
    const html = renderToStaticMarkup(<ScreenStandings view={v} layout="landscape" t={t} />);
    expect(html).toContain('Round 1 of 2 done');
  });
});

describe('Tonight panel (F29)', () => {
  const tonight: ScreenView['tonight'] = [
    { pid: 'Ana', name: 'Ana', color: '#FF6B35', total: 2400, rank: 1 },
    { pid: 'Cy', name: 'Cy', color: '#3A86FF', total: 1100, rank: 2 },
  ];

  it('shows the night’s totals beside the final scores from game 2', () => {
    const v = { ...view('FINAL'), gameNumber: 2, tonight };
    const html = renderToStaticMarkup(<ScreenStandings view={v} layout="landscape" t={t} />);
    expect(html).toContain('Tonight · 2 games');
    expect(html).toContain('2,400');
    // Cy left after game 1; the panel still lists him.
    expect(html).toContain('>Cy<');
    expect(html.indexOf('Tonight')).toBeGreaterThan(html.indexOf('Final scores'));
  });

  it('lists eight rows and counts the rest; four players go into two columns beside it', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      pid: `p${i}`,
      name: `P${i}`,
      color: '#FF6B35',
      total: 1000 - i,
      rank: i + 1,
    }));
    const html = renderToStaticMarkup(
      <ScreenStandings
        view={{ ...view('FINAL'), gameNumber: 3, tonight: many }}
        layout="landscape"
        t={t}
      />,
    );
    expect(html).toContain('>P7<');
    expect(html).not.toContain('>P8<');
    expect(html).toContain('+3 more');
    expect(html).toContain('grid-cols-2');
    expect(
      renderToStaticMarkup(<ScreenStandings view={view('FINAL')} layout="landscape" t={t} />),
    ).not.toContain('grid-cols-2');
  });

  it('is not shown in game 1, nor on the scoreboard', () => {
    expect(
      renderToStaticMarkup(<ScreenStandings view={view('FINAL')} layout="landscape" t={t} />),
    ).not.toContain('Tonight');
    const scoreboard = { ...view('SCOREBOARD'), gameNumber: 2, tonight };
    expect(
      renderToStaticMarkup(<ScreenStandings view={scoreboard} layout="landscape" t={t} />),
    ).not.toContain('Tonight');
  });
});

describe('portrait standings (F33)', () => {
  const ten = (): ScreenView => ({
    ...view('FINAL'),
    players: Array.from({ length: 10 }, (_, i) => chip(`P${i}`, 100 - i, i + 1)),
  });

  it('lists ten players in two columns on a landscape Screen', () => {
    const html = renderToStaticMarkup(<ScreenStandings view={ten()} layout="landscape" t={t} />);
    expect(html).toContain('grid-cols-2');
  });

  it('keeps one column in portrait, so names aren’t cut short', () => {
    const html = renderToStaticMarkup(<ScreenStandings view={ten()} layout="portrait" t={t} />);
    expect(html).not.toContain('grid-cols-2');
    expect(html).toContain('>P9<');
  });
});

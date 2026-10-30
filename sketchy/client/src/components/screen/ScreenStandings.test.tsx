import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { Phase, PlayerChipView, ScreenView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { NextButton } from './NextButton.js';
import { ScreenStandings } from './ScreenStandings.js';

const t = translator('en');

const chip = (pid: string, score: number, rank: number): PlayerChipView => ({
  pid,
  name: pid,
  color: '#FF6B35',
  connected: true,
  crown: false,
  isDrawer: false,
  hasDoodle: false,
  guessed: false,
  turnPoints: 0,
  score,
  rank,
});

function view(phase: Phase, host = false): ScreenView {
  return {
    role: 'screen',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: null,
    settings: { ...DEFAULT_SETTINGS, cycles: 2 },
    // Join order; Bea and Ana tie for first.
    players: [chip('Mika', 100, 3), chip('Ana', 300, 1), chip('Bea', 300, 1), chip('Jun', 0, 4)],
    turn: null,
    host: host ? { code: 'KPRW', customWordCount: 0 } : null,
    feed: [],
    closeGuesses: [],
    awards: [],
    gallery: [],
  };
}

/** The names in the order the markup lists them. */
const order = (html: string) =>
  ['Mika', 'Ana', 'Bea', 'Jun'].sort((a, b) => html.indexOf(`>${a}<`) - html.indexOf(`>${b}<`));

describe('Screen standings (F20)', () => {
  it('lists players in the server’s shared ranks, ties in join order, with two gold medals', () => {
    const html = renderToStaticMarkup(<ScreenStandings view={view('FINAL')} t={t} />);
    expect(order(html)).toEqual(['Ana', 'Bea', 'Mika', 'Jun']);
    expect(html.match(/🥇/g)).toHaveLength(2);
    expect(html).not.toContain('🥈');
    expect(html).toContain('<span aria-hidden="true">🥉</span><span class="sr-only">3.</span>');
    expect(html).toContain('4.');
    expect(html).toContain('Final scores');
  });

  it('titles the scoreboard with the round just done', () => {
    const v = { ...view('SCOREBOARD'), turn: { cycle: 1 } as ScreenView['turn'] };
    const html = renderToStaticMarkup(<ScreenStandings view={v} t={t} />);
    expect(html).toContain('Round 1 of 2 done');
  });
});

describe('Screen Next button (F20)', () => {
  const socket = {} as GameSocket;

  it('shows on the token Screen in REVEAL and SCOREBOARD', () => {
    for (const phase of ['REVEAL', 'SCOREBOARD'] as const)
      expect(
        renderToStaticMarkup(<NextButton view={view(phase, true)} socket={socket} t={t} />),
      ).toContain('Next <span aria-hidden="true">▶</span>');
  });

  it('hides while paused, when the server would refuse host:next', () => {
    const paused = {
      ...view('REVEAL', true),
      paused: { reasons: ['host' as const], resumeInMs: null },
    };
    expect(renderToStaticMarkup(<NextButton view={paused} socket={socket} t={t} />)).toBe('');
  });

  it('never shows without the token, or in other phases', () => {
    expect(renderToStaticMarkup(<NextButton view={view('REVEAL')} socket={socket} t={t} />)).toBe(
      '',
    );
    for (const phase of ['LOBBY', 'CHOOSING', 'DRAWING', 'FINAL'] as const)
      expect(
        renderToStaticMarkup(<NextButton view={view(phase, true)} socket={socket} t={t} />),
      ).toBe('');
  });
});

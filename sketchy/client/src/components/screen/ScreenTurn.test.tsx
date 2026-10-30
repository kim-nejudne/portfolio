import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { ScreenView, TurnEndReason, TurnView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import { createScreenInk } from '../../lib/ink.js';
import { Blanks, RevealPanel, ScreenTurn } from './ScreenTurn.js';

const t = translator('en');

function reveal(endReason: TurnEndReason): { view: ScreenView; turn: TurnView } {
  const turn: TurnView = {
    id: 3,
    number: 1,
    cycle: 1,
    drawerPid: 'mika',
    drawerName: 'Mika',
    timer: null,
    mask: null,
    word: 'banana',
    correct: [{ pid: 'jun', points: 270, order: 1 }],
    guessed: { guessed: 1, of: 1 },
    endReason,
  };
  const chip = (pid: string, name: string) => ({
    pid,
    name,
    color: '#FF6B35',
    connected: true,
    crown: false,
    isDrawer: pid === 'mika',
    hasDoodle: false,
    guessed: pid === 'jun',
    turnPoints: pid === 'jun' ? 270 : 135,
    score: null,
    rank: null,
  });
  const view: ScreenView = {
    role: 'screen',
    code: 'KPRW',
    phase: 'REVEAL',
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS },
    players: [chip('mika', 'Mika'), chip('jun', 'Jun')],
    turn,
    host: null,
    feed: [],
    closeGuesses: [],
    awards: [],
    gallery: [],
    tonight: null,
  };
  return { view, turn };
}

describe('Screen reveal (F19)', () => {
  it('says "Everyone got it!" after an early end, with the 🎉 hidden from screen readers', () => {
    const html = renderToStaticMarkup(<RevealPanel {...reveal('allGuessed')} t={t} />);
    expect(html).toContain('Everyone got it!');
    expect(html).toContain('<span aria-hidden="true">🎉</span>');
  });

  it('says nothing of the kind when time ran out', () => {
    const html = renderToStaticMarkup(<RevealPanel {...reveal('time')} t={t} />);
    expect(html).not.toContain('Everyone got it!');
  });
});

describe('Screen blanks', () => {
  it('shows hint letters in place and names them in the label', () => {
    const html = renderToStaticMarkup(<Blanks mask={[...'_a___s__']} />);
    expect(html).toContain('aria-label="8 letters. Hints: a, s"');
    expect(html).toContain('<span>a</span>');
  });

  it('labels plain blanks with the letter counts only', () => {
    const html = renderToStaticMarkup(<Blanks mask={[...'_____ ____']} />);
    expect(html).toContain('aria-label="5, 4 letters"');
  });
});

describe('first-turn captions (F26)', () => {
  const FIRST = 'Mika is drawing. Everyone else: type your guess on your phone 🤫';
  const SECOND = 'Type your guess. Don’t say it! 🤫';
  const render = (phase: ScreenView['phase'], number: number) => {
    const { view, turn } = reveal('time');
    const live: TurnView = { ...turn, number, word: null, mask: [...'______'], endReason: null };
    return renderToStaticMarkup(
      <ScreenTurn
        view={{ ...view, phase, turn: live }}
        receivedAt={0}
        ink={createScreenInk()}
        t={t}
      />,
    );
  };

  it('shows the rule under the drawing on the first turn and the reminder on the second', () => {
    const first = render('DRAWING', 1);
    expect(first).toContain(FIRST);
    // Under the square (after the canvas), not over it, and before the sidebar.
    expect(first.indexOf(FIRST)).toBeGreaterThan(first.indexOf('<canvas'));
    expect(first.indexOf(FIRST)).toBeLessThan(first.indexOf('<aside'));
    expect(render('DRAWING', 2)).toContain(SECOND);
  });

  it('has no caption from the third turn on', () => {
    const html = render('DRAWING', 3);
    expect(html).not.toContain('🤫');
  });

  it('keeps the row but no text while choosing and at the reveal', () => {
    for (const phase of ['CHOOSING', 'REVEAL'] as const) {
      const html = render(phase, 1);
      expect(html).not.toContain('🤫');
      expect(html).toContain('line-clamp-2');
    }
    expect(render('REVEAL', 3)).not.toContain('line-clamp-2');
  });
});

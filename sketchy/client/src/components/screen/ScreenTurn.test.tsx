import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { ScreenView, TurnEndReason, TurnView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import { Blanks, RevealPanel } from './ScreenTurn.js';

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
  });
  const view: ScreenView = {
    role: 'screen',
    code: 'KPRW',
    phase: 'REVEAL',
    paused: null,
    rematchInMs: null,
    settings: { ...DEFAULT_SETTINGS },
    players: [chip('mika', 'Mika'), chip('jun', 'Jun')],
    turn,
    host: null,
    feed: [],
    closeGuesses: [],
    awards: [],
    gallery: [],
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

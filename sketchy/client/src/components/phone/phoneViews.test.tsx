import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { PlayerChipView, PlayerView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import { DrawerTurn } from './DrawerTurn.js';
import { GuesserTurn } from './GuesserTurn.js';
import { PhoneStandings } from './PhoneStandings.js';

const t = translator('en');
// Every secret starts with `qz`, so a substring search of the markup finds any of them.
const WORD = 'qzsecret';

const chip = (pid: string, name: string, extra: Partial<PlayerChipView> = {}): PlayerChipView => ({
  pid,
  name,
  color: '#FF6B35',
  connected: true,
  crown: false,
  isDrawer: false,
  hasDoodle: false,
  guessed: false,
  turnPoints: 0,
  score: null,
  ...extra,
});

/** A DRAWING view for `me` (Mika draws, Jun guessed right for 270). */
function drawingView(me: 'mika' | 'jun', overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    role: 'player',
    code: 'KPRW',
    phase: 'DRAWING',
    paused: null,
    rematchInMs: null,
    settings: { ...DEFAULT_SETTINGS },
    players: [
      chip('mika', 'Mika', { isDrawer: true, crown: true }),
      chip('jun', 'Jun', { guessed: true, turnPoints: 270 }),
      chip('ana', 'Ana'),
    ],
    turn: {
      id: 3,
      number: 1,
      cycle: 1,
      drawerPid: 'mika',
      drawerName: 'Mika',
      timer: { remainingMs: 47_000, totalMs: 60_000, running: true },
      mask: [...'________'],
      word: null,
      correct: [{ pid: 'jun', points: 270, order: 1 }],
      guessed: { guessed: 1, of: 2 },
      endReason: null,
    },
    host: null,
    me: {
      pid: me,
      turnPoints: me === 'jun' ? 270 : 0,
      score: null,
      rank: null,
      award: null,
    },
    secret:
      me === 'mika'
        ? { turnId: 3, choices: null, word: { word: WORD, gloss: null, difficulty: 2 } }
        : null,
    lastGuess: me === 'mika' ? { pid: 'ana', text: 'payong' } : null,
    ...overrides,
  };
}

describe('guesser phone', () => {
  it('after a correct guess shows "✓ You got it! +270" and never the word', () => {
    // Even a view that wrongly carried a secret must not put it on a guesser's screen.
    const view = drawingView('jun', {
      secret: { turnId: 3, choices: null, word: { word: WORD, gloss: 'qzgloss', difficulty: 2 } },
    });
    const html = renderToStaticMarkup(
      <GuesserTurn view={view} receivedAt={0} misses={[]} onGuess={() => {}} t={t} />,
    );
    expect(html).toContain('✓ You got it! +270');
    expect(html).toContain('+270 this turn');
    expect(html).not.toContain('qz');
  });

  it('before guessing shows the timer, the blanks and a guess box that never autocorrects', () => {
    const view = drawingView('jun', {
      players: drawingView('jun').players.map((p) =>
        p.pid === 'jun' ? { ...p, guessed: false, turnPoints: 0 } : p,
      ),
      me: { pid: 'jun', turnPoints: 0, score: null, rank: null, award: null },
    });
    const html = renderToStaticMarkup(
      <GuesserTurn view={view} receivedAt={0} misses={['sapatos']} onGuess={() => {}} t={t} />,
    );
    expect(html).toContain('◔ 0:47');
    expect(html).toContain('✏️ Mika drawing');
    expect(html).toContain('________');
    expect(html).toContain('8 letters to guess');
    expect(html).toContain('sapatos ✗');
    for (const attr of [
      'autoComplete="off"',
      'autoCorrect="off"',
      'autoCapitalize="off"',
      'spellCheck="false"',
      'enterKeyHint="send"',
    ])
      expect(html.toLowerCase()).toContain(attr.toLowerCase());
    expect(html).not.toContain('You got it');
    expect(html).not.toContain('<canvas');
  });
});

describe('drawer phone', () => {
  it('shows the word small (16 px) in the top bar, the clock, the got-it count and the latest guess', () => {
    const html = renderToStaticMarkup(
      <DrawerTurn
        view={drawingView('mika')}
        receivedAt={0}
        ink={{ send: () => {}, bind: () => () => {} }}
        paused={false}
        t={t}
      />,
    );
    expect(html).toMatch(
      new RegExp(`<p class="[^"]*text-base[^"]*"><strong[^>]*>${WORD}</strong>`),
    );
    expect(html).toContain('◔ 0:47');
    expect(html).toContain('1 of 2 got it');
    expect(html).toContain('Ana: payong');
  });
});

describe('reveal, scoreboard and final', () => {
  it('REVEAL shows the word to a guesser with this turn’s points, and the drawer their bonus', () => {
    const reveal = (me: 'mika' | 'jun', points: number) =>
      drawingView(me, {
        phase: 'REVEAL',
        turn: { ...drawingView(me).turn!, word: WORD, mask: null, timer: null, endReason: 'time' },
        me: { pid: me, turnPoints: points, score: null, rank: null, award: null },
        secret: null,
        lastGuess: null,
      });
    const guesser = renderToStaticMarkup(
      <PhoneStandings view={reveal('jun', 270)} onLeave={() => {}} t={t} />,
    );
    expect(guesser).toContain(WORD);
    expect(guesser).toContain('+270 this turn');
    expect(guesser).not.toMatch(/#\d/);
    const drawer = renderToStaticMarkup(
      <PhoneStandings view={reveal('mika', 135)} onLeave={() => {}} t={t} />,
    );
    expect(drawer).toContain('+135 for your drawing');
    const nothing = renderToStaticMarkup(
      <PhoneStandings view={reveal('mika', 0)} onLeave={() => {}} t={t} />,
    );
    expect(nothing).not.toContain('for your drawing');
  });

  it('FINAL shows the final rank, the score and the gallery pointer', () => {
    const view = drawingView('jun', {
      phase: 'FINAL',
      me: { pid: 'jun', turnPoints: 0, score: 820, rank: { rank: 1, of: 3 }, award: null },
    });
    const html = renderToStaticMarkup(<PhoneStandings view={view} onLeave={() => {}} t={t} />);
    expect(html).toContain('You finished #1 of 3');
    expect(html).toContain('820 points');
    expect(html).toContain('See the gallery on the Screen');
  });
});

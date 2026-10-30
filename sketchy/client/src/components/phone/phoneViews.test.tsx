import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { PlayerChipView, PlayerView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import { DrawerTurn } from './DrawerTurn.js';
import { GuesserTurn } from './GuesserTurn.js';
import { PhoneStandings } from './PhoneStandings.js';
import { WordChoice } from './WordChoice.js';

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
  rank: null,
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
        ? {
            turnId: 3,
            choices: null,
            word: { word: WORD, gloss: null, difficulty: 2 },
            chooseTimer: null,
          }
        : null,
    lastGuess: me === 'mika' ? { pid: 'ana', text: 'payong' } : null,
    ...overrides,
  };
}

describe('guesser phone', () => {
  it('after a correct guess shows "✓ You got it! +270" and never the word', () => {
    // Even a view that wrongly carried a secret must not put it on a guesser's screen.
    const view = drawingView('jun', {
      secret: {
        turnId: 3,
        choices: null,
        word: { word: WORD, gloss: 'qzgloss', difficulty: 2 },
        chooseTimer: null,
      },
    });
    const html = renderToStaticMarkup(
      <GuesserTurn
        view={view}
        receivedAt={0}
        misses={[]}
        nearMiss={0}
        onGuess={async () => null}
        t={t}
      />,
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
      <GuesserTurn
        view={view}
        receivedAt={0}
        misses={[
          { text: 'sapatos', close: false },
          { text: 'tsinelas ko', close: true },
        ]}
        nearMiss={0}
        onGuess={async () => null}
        t={t}
      />,
    );
    expect(html).toContain('◔ 0:47');
    expect(html).toContain('✏️ Mika drawing');
    expect(html).toContain('________');
    expect(html).toContain('8 letters to guess');
    expect(html).toContain('sapatos <span aria-hidden="true">✗</span>');
    expect(html).toContain('tsinelas ko <span aria-hidden="true">≈</span>');
    expect(html).toContain('(close)');
    // The polite live region for "Slow down", empty until a refusal fills it.
    expect(html).toMatch(/<p role="status"[^>]*><\/p>/);
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
  it('shows hint letters in the blanks, and the hidden-letter count (F19)', () => {
    const view = drawingView('jun', {
      players: drawingView('jun').players.map((p) =>
        p.pid === 'jun' ? { ...p, guessed: false, turnPoints: 0 } : p,
      ),
      me: { pid: 'jun', turnPoints: 0, score: null, rank: null, award: null },
      turn: { ...drawingView('jun').turn!, mask: [...'__b___a_'] },
    });
    const html = renderToStaticMarkup(
      <GuesserTurn
        view={view}
        receivedAt={0}
        misses={[]}
        nearMiss={0}
        onGuess={async () => null}
        t={t}
      />,
    );
    expect(html).toContain('__b___a_');
    expect(html).toContain('aria-label="6 letters to guess. Hints: b, a"');
  });
});

describe('reveal, scoreboard and final', () => {
  it('REVEAL says "Everyone got it!" only after an early end (F19)', () => {
    const reveal = (endReason: 'allGuessed' | 'time') =>
      drawingView('jun', {
        phase: 'REVEAL',
        turn: { ...drawingView('jun').turn!, word: WORD, mask: null, timer: null, endReason },
        me: { pid: 'jun', turnPoints: 270, score: null, rank: null, award: null },
        secret: null,
        lastGuess: null,
      });
    const early = renderToStaticMarkup(
      <PhoneStandings view={reveal('allGuessed')} onLeave={() => {}} t={t} />,
    );
    expect(early).toContain('Everyone got it!');
    const time = renderToStaticMarkup(
      <PhoneStandings view={reveal('time')} onLeave={() => {}} t={t} />,
    );
    expect(time).not.toContain('Everyone got it!');
  });

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

/** CHOOSING with Mika's three choices, 10 s left. */
function choosingView(me: 'mika' | 'jun'): PlayerView {
  const base = drawingView(me);
  return {
    ...base,
    phase: 'CHOOSING',
    turn: {
      ...base.turn!,
      timer: { remainingMs: 10_000, totalMs: 12_000, running: true },
      mask: null,
      correct: [],
      guessed: { guessed: 0, of: 2 },
    },
    secret:
      me === 'mika'
        ? {
            turnId: 3,
            choices: [
              { word: 'tsinelas', gloss: null, difficulty: 1 },
              { word: 'salakot', gloss: "wide woven farmer's hat", difficulty: 2 },
              { word: 'harana', gloss: "singing under someone's window", difficulty: 3 },
            ],
            word: null,
            chooseTimer: null,
          }
        : null,
    lastGuess: null,
  };
}

describe('choosing a word', () => {
  it('shows the drawer three cards, easiest first, with level, gloss and "Hold your phone close 🤫"', () => {
    const html = renderToStaticMarkup(
      <WordChoice view={choosingView('mika')} receivedAt={0} onChoose={async () => null} t={t} />,
    );
    expect(html).toContain('Your turn to draw!');
    expect(html).toContain('<span aria-hidden="true">◔</span> 10s');
    expect(html).toContain('Hold your phone close 🤫');
    expect(html).toContain('Tap one. No letters or numbers in your drawing!');
    const order = [
      'tsinelas',
      'Easy',
      'salakot',
      'Medium',
      'wide woven farmer&#x27;s hat',
      'harana',
      'Hard',
    ];
    const at = order.map((s) => html.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(html.match(/<button/g)).toHaveLength(3);
  });

  it('shows a guesser "Mika is choosing a word…" and no word', () => {
    const view = choosingView('jun');
    const html = renderToStaticMarkup(
      <GuesserTurn
        view={view}
        receivedAt={0}
        misses={[]}
        nearMiss={0}
        onGuess={async () => null}
        t={t}
      />,
    );
    expect(html).toContain('Mika is choosing a word…');
    expect(html).not.toContain('tsinelas');
    expect(html).not.toContain('<input');
  });
});

describe('the next drawer during the reveal (F21)', () => {
  const upNext = (word: boolean): PlayerView =>
    drawingView('jun', {
      phase: 'REVEAL',
      turn: {
        ...drawingView('jun').turn!,
        word: 'kalabaw',
        mask: null,
        timer: null,
        endReason: 'time',
      },
      me: { pid: 'jun', turnPoints: 270, score: null, rank: null, award: null },
      secret: {
        turnId: 4,
        choices: word ? null : choosingView('mika').secret!.choices,
        word: word ? { word: 'qzchosen', gloss: 'qzgloss', difficulty: 2 } : null,
        chooseTimer: word ? null : { remainingMs: 7_000, totalMs: 12_000, running: true },
      },
      lastGuess: null,
    });

  it('shows "You draw next! Pick a word" over the three cards, with the choice countdown', () => {
    const html = renderToStaticMarkup(
      <WordChoice view={upNext(false)} receivedAt={0} onChoose={async () => null} next t={t} />,
    );
    expect(html).toContain('You draw next! Pick a word');
    expect(html).not.toContain('Your turn to draw!');
    expect(html).toContain('<span aria-hidden="true">◔</span> 7s');
    expect(html.match(/<button/g)).toHaveLength(3);
  });

  it('once chosen, shows "You draw next! Get ready" with the reveal, and not the chosen word', () => {
    const html = renderToStaticMarkup(
      <PhoneStandings view={upNext(true)} onLeave={() => {}} t={t} />,
    );
    expect(html).toContain('You draw next! Get ready');
    expect(html).toContain('kalabaw');
    expect(html).not.toContain('qz');
  });

  it('shows no "draw next" line to anyone else', () => {
    const html = renderToStaticMarkup(
      <PhoneStandings view={{ ...upNext(true), secret: null }} onLeave={() => {}} t={t} />,
    );
    expect(html).not.toContain('You draw next');
  });
});

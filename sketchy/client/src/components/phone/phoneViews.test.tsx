import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AVATARS, DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { PlayerChipView, PlayerView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import { welcomeTurn } from '../../lib/phone.js';
import { DrawerTurn, GuessLine, TurnUpright } from './DrawerTurn.js';
import { GuesserTurn } from './GuesserTurn.js';
import { JoinForm, TakeOverPrompt } from './JoinForm.js';
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
  avatar: '🦊',
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
    rematchFirst: null,
    gameNumber: 1,
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
      drawerReconnecting: false,
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
            word: { word: WORD, gloss: null, difficulty: 2, custom: false },
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
        word: { word: WORD, gloss: 'qzgloss', difficulty: 2, custom: false },
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

  it('replaces the guess box with the six reactions after a correct guess (F34)', () => {
    const html = renderToStaticMarkup(
      <GuesserTurn
        view={drawingView('jun')}
        receivedAt={0}
        misses={[]}
        nearMiss={0}
        onGuess={async () => null}
        onReact={() => {}}
        t={t}
      />,
    );
    expect(html).not.toContain('<input');
    expect(html).toContain('role="group" aria-label="React on the Screen"');
    for (const emoji of ['😂', '🔥', '👏', '😱', '🤔', '💀'])
      expect(html).toContain(`aria-label="Send ${emoji}"`);
    // Only after the "You got it" panel, never before it.
    expect(html.indexOf('React on the Screen')).toBeGreaterThan(html.indexOf('You got it'));
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
        onReact={() => {}}
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
    expect(html).not.toContain('React on the Screen');
  });
});

describe('drawer phone', () => {
  const drawer = (remainingMs: number) => {
    const base = drawingView('mika');
    const view = { ...base, turn: { ...base.turn!, timer: { ...base.turn!.timer!, remainingMs } } };
    return renderToStaticMarkup(
      <DrawerTurn
        view={view}
        receivedAt={performance.now()}
        ink={{ send: () => {}, bind: () => () => {} }}
        paused={false}
        closePid={null}
        t={t}
      />,
    );
  };
  it('has the nudge live region in place, empty until the pad has loaded its ink (F36)', () => {
    // 13 s in, but the turn's ink isn't in yet (no `/ink` here): no nudge, so no flash after a
    // reload. `inkNudge` (phone.test.ts) and `.playtest/F36` cover it showing and going.
    const html = drawer(47_000);
    expect(html).toContain('<p role="status" class="sr-only"></p>');
    expect(html).not.toContain('Start with one big shape');
  });
  it('shows "Bea is close!" in amber in place of the latest guess (F36)', () => {
    const html = renderToStaticMarkup(
      <GuessLine close="Bea" last={{ name: 'Ana', text: 'payong' }} t={t} />,
    );
    expect(html).toMatch(/aria-live="polite"/);
    expect(html).toMatch(/<strong class="[^"]*text-\[#FFD166\][^"]*">Bea is close!<\/strong>/);
    expect(html).not.toContain('payong');
  });
  it('shows the latest wrong guess with the feed masking, or nothing yet (F36)', () => {
    const line = (last: { name: string; text: string | null } | null) =>
      renderToStaticMarkup(<GuessLine close={null} last={last} t={t} />);
    expect(line({ name: 'Ana', text: 'payong' })).toContain('Ana: payong');
    expect(line({ name: 'Ana', text: null })).toContain('Ana: •••');
    expect(line(null)).toMatch(/<p[^>]*><\/p>/);
    expect(line({ name: 'Ana', text: 'payong' })).not.toContain('close');
  });
  it('shows the word small (16 px) in the top bar, the clock, the got-it count and the latest guess', () => {
    const html = renderToStaticMarkup(
      <DrawerTurn
        view={drawingView('mika')}
        receivedAt={0}
        ink={{ send: () => {}, bind: () => () => {} }}
        paused={false}
        closePid={null}
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
  it('locks touch gestures on the whole view and starts without the rotate prompt (F32)', () => {
    const html = renderToStaticMarkup(
      <DrawerTurn
        view={drawingView('mika')}
        receivedAt={0}
        ink={{ send: () => {}, bind: () => () => {} }}
        paused={false}
        closePid={null}
        t={t}
      />,
    );
    expect(html).toMatch(/^<div class="[^"]*\btouch-none\b[^"]*\boverflow-hidden\b/);
    expect(html).not.toContain('Turn your phone upright');
  });
  it('the rotate cover asks to turn upright, keeps the clock and never shows the word (F32)', () => {
    const html = renderToStaticMarkup(<TurnUpright clock="0:47" t={t} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Turn your phone upright');
    expect(html).toContain('Your drawing is safe');
    expect(html).toContain('◔ 0:47');
    expect(html).not.toContain(WORD);
  });
  it('has the two toolbar rows: 8 swatches (40 px in 44 px), then size, Eraser, Undo, Clear (F30)', () => {
    const render = (paused: boolean) =>
      renderToStaticMarkup(
        <DrawerTurn
          view={drawingView('mika')}
          receivedAt={0}
          ink={{ send: () => {}, bind: () => () => {} }}
          paused={paused}
          closePid={null}
          t={t}
        />,
      );
    const html = render(false);
    const swatches = [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>/g)];
    const colours = ['Black', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Brown'];
    for (const name of colours) expect(html).toContain(`aria-label="${name}"`);
    // The 8 swatches and the Eraser are toggles; black is on, the eraser off.
    expect(swatches).toHaveLength(9);
    expect(html).toMatch(/aria-label="Black" aria-pressed="true"/);
    expect(html.match(/class="(?:group )?grid size-11 [^"]*"/g)).toHaveLength(8);
    expect(html.match(/class="block size-10 rounded-full[^"]*"/g)).toHaveLength(8);
    expect(html).toContain('aria-label="Brush size: medium. Tap to change"');
    expect(html).toMatch(/aria-pressed="false"[^>]*>Eraser<\/button>/);
    // Nothing drawn yet: Undo and Clear do nothing.
    expect(html).toMatch(/disabled=""[^>]*>↶ Undo<\/button>/);
    expect(html).toMatch(/disabled=""[^>]*>✕ Clear<\/button>/);
    expect(html).not.toContain('coming soon');
    expect(html.match(/style="height:48px"/g)).toHaveLength(2);
    // Paused: every tool waits.
    const paused = render(true);
    const total = paused.match(/<button/g)!.length;
    expect(paused.match(/<button[^>]*disabled=""/g)).toHaveLength(total);
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
    expect(html).not.toContain('Your award');
  });

  it('FINAL leads with the player’s own award, in the room’s language', () => {
    const final = (copy: 'en' | 'taglish') =>
      drawingView('jun', {
        phase: 'FINAL',
        settings: { ...DEFAULT_SETTINGS, copy },
        me: {
          pid: 'jun',
          turnPoints: 0,
          score: 820,
          rank: { rank: 1, of: 3 },
          award: { kind: 'bilis', pid: 'jun' },
        },
      });
    const html = renderToStaticMarkup(
      <PhoneStandings view={final('en')} onLeave={() => {}} t={t} />,
    );
    expect(html).toContain('Your award');
    expect(html).toContain('⚡ Bilis!');
    expect(html).toContain('Fastest guess of the night');
    expect(html.indexOf('⚡ Bilis!')).toBeLessThan(html.indexOf('Final scores'));
    expect(html.indexOf('⚡ Bilis!')).toBeLessThan(html.indexOf('You finished #1 of 3'));
    const tl = renderToStaticMarkup(
      <PhoneStandings view={final('taglish')} onLeave={() => {}} t={translator('taglish')} />,
    );
    expect(tl).toContain('Pinakamabilis na hula ngayong gabi');
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
              { word: 'tsinelas', gloss: null, difficulty: 1, custom: false },
              { word: 'salakot', gloss: "wide woven farmer's hat", difficulty: 2, custom: false },
              {
                word: 'harana',
                gloss: "singing under someone's window",
                difficulty: 3,
                custom: false,
              },
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

  it('tags a custom word "Ours" instead of its level', () => {
    const view = choosingView('mika');
    view.secret!.choices![1] = { word: 'Tita Baby', gloss: null, difficulty: 2, custom: true };
    const html = renderToStaticMarkup(
      <WordChoice view={view} receivedAt={0} onChoose={async () => null} t={t} />,
    );
    const at = ['tsinelas', 'Easy', 'Tita Baby', 'Ours', 'harana', 'Hard'].map((s) =>
      html.indexOf(s),
    );
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(html).not.toContain('Medium');
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
        drawerReconnecting: false,
      },
      me: { pid: 'jun', turnPoints: 270, score: null, rank: null, award: null },
      secret: {
        turnId: 4,
        choices: word ? null : choosingView('mika').secret!.choices,
        word: word ? { word: 'qzchosen', gloss: 'qzgloss', difficulty: 2, custom: false } : null,
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

describe('a mid-game joiner (F23)', () => {
  /** Jun, who hasn't guessed yet, in Mika's DRAWING turn. */
  const fresh = (): PlayerView =>
    drawingView('jun', {
      players: drawingView('jun').players.map((p) =>
        p.pid === 'jun' ? { ...p, guessed: false, turnPoints: 0 } : p,
      ),
      me: { pid: 'jun', turnPoints: 0, score: null, rank: null, award: null },
    });
  const render = (view: PlayerView, welcome: boolean) =>
    renderToStaticMarkup(
      <GuesserTurn
        view={view}
        receivedAt={0}
        misses={[]}
        nearMiss={0}
        onGuess={async () => null}
        welcome={welcome}
        t={t}
      />,
    );

  it('lands on the guess box with "You\'re in! Mika is drawing. Type your guess."', () => {
    const html = render(fresh(), true);
    expect(html).toContain('You&#x27;re in! Mika is drawing. Type your guess.');
    // The line sits under the box, which stays where it always is.
    expect(html.indexOf('placeholder="Hula mo?"')).toBeLessThan(html.indexOf('You&#x27;re in!'));
    // Screen readers hear it with the focused box.
    expect(html).toContain('aria-describedby="joined-mid-game"');
    expect(html).toContain('id="joined-mid-game"');
  });

  it('shows no welcome to a player who was already in, or once they got it', () => {
    expect(render(fresh(), false)).not.toContain('You&#x27;re in!');
    expect(render(drawingView('jun'), true)).not.toContain('You&#x27;re in!');
  });

  it('is welcomed into the turn in play as a guesser, never as its drawer or between turns', () => {
    expect(welcomeTurn(fresh())).toBe(fresh().turn!.id);
    expect(welcomeTurn(choosingView('jun'))).toBe(choosingView('jun').turn!.id);
    expect(welcomeTurn(drawingView('mika'))).toBeNull();
    expect(welcomeTurn({ ...fresh(), phase: 'REVEAL' })).toBeNull();
    expect(welcomeTurn({ ...fresh(), phase: 'LOBBY', turn: null })).toBeNull();
  });
});

describe('the join form’s avatar grid (F53)', () => {
  const form = () =>
    renderToStaticMarkup(
      <JoinForm
        code="KPRW"
        initialName=""
        initialAvatar="🐙"
        busy={false}
        error={null}
        onJoin={() => {}}
        t={t}
      />,
    );

  it('offers all 24 avatars as toggle buttons, with the pre-picked one pressed', () => {
    const html = form();
    const options = [...html.matchAll(/aria-label="Avatar ([^"]+)" aria-pressed="(true|false)"/g)];
    expect(options.map((m) => m[1])).toEqual([...AVATARS]);
    expect(options.filter((m) => m[2] === 'true').map((m) => m[1])).toEqual(['🐙']);
    expect(html).toContain('Your avatar');
  });

  it('keeps the name and Join above the grid, so Join stays on screen', () => {
    const html = form();
    expect(html.indexOf('type="submit"')).toBeLessThan(html.indexOf('aria-pressed'));
  });
});

describe('TakeOverPrompt (F42)', () => {
  const render = (busy: boolean) =>
    renderToStaticMarkup(
      <TakeOverPrompt name="Jun" busy={busy} onRejoin={() => {}} onPickAnother={() => {}} t={t} />,
    );

  it('asks "Are you Jun?" with Rejoin as Jun and Pick another name', () => {
    const html = render(false);
    expect(html).toContain('Are you Jun?');
    expect(html).toContain('>Rejoin as Jun</button>');
    expect(html).toContain('>Pick another name</button>');
    expect(html).not.toContain('disabled=""');
  });

  it('while the rejoin is on its way, both buttons wait', () => {
    const html = render(true);
    expect(html).toContain('Joining…');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});

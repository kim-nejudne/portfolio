// The sketchbook guesser phone (F60): markup and source checks. The look itself, the "So close!"
// toast and the fit are checked by the F60 playtest against the mockup
// (`sketchbook.html#sketch-drawing`, `-close`, `-gotit`, `-choosing`).
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { PlayerChipView, PlayerView } from '../../../../shared/types.js';
import { translator, type Translate } from '../../lib/copy.js';
import type { OwnGuess } from '../../lib/phone.js';
import { Stamp } from '../sketch/Stamp.js';
import { GuesserTurn } from './GuesserTurn.js';
import { NameInColour } from './NameInColour.js';

const t = translator('en');
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const WORD = 'qzsecret';
const MIKA = '#B0307F';

const chip = (pid: string, name: string, extra: Partial<PlayerChipView> = {}): PlayerChipView => ({
  pid,
  name,
  color: '#2457B8',
  connected: true,
  crown: false,
  isDrawer: false,
  avatar: '🐸',
  guessed: false,
  turnPoints: 0,
  score: null,
  rank: null,
  ...extra,
});

/** Jun's view of Mika's turn: stopped timers, so the clock shows exactly `remainingMs`. */
function view(
  phase: 'CHOOSING' | 'DRAWING',
  { remainingMs = 47_000, points = 0 }: { remainingMs?: number; points?: number } = {},
): PlayerView {
  const choosing = phase === 'CHOOSING';
  return {
    role: 'player',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS },
    players: [
      chip('mika', 'Mika', { isDrawer: true, crown: true, color: MIKA, avatar: '🦊' }),
      chip('jun', 'Jun', { guessed: points > 0, turnPoints: points, score: 900, rank: 2 }),
    ],
    turn: {
      id: 3,
      number: 1,
      cycle: 1,
      drawerPid: 'mika',
      drawerName: 'Mika',
      timer: { remainingMs, totalMs: choosing ? 12_000 : 60_000, running: false },
      mask: choosing ? null : [...'________'],
      word: null,
      correct: points > 0 ? [{ pid: 'jun', points, order: 1 }] : [],
      guessed: { guessed: points > 0 ? 1 : 0, of: 1 },
      endReason: null,
      drawerReconnecting: false,
    },
    host: null,
    me: { pid: 'jun', turnPoints: points, score: 900, rank: { rank: 2, of: 2 }, award: null },
    // Even a view that wrongly carried a secret must not put it on a guesser's page.
    secret: {
      turnId: 3,
      choices: null,
      word: { word: WORD, gloss: 'qzgloss', difficulty: 2, custom: false },
      chooseTimer: null,
    },
    lastGuess: null,
  };
}

const render = (v: PlayerView, misses: OwnGuess[] = [], tr: Translate = t) =>
  renderToStaticMarkup(
    <GuesserTurn
      view={v}
      receivedAt={performance.now()}
      misses={misses}
      nearMiss={0}
      onGuess={async () => null}
      onReact={() => {}}
      t={tr}
    />,
  );

describe('the guesser page (F60)', () => {
  it('starts right of the red margin', () => {
    expect(render(view('DRAWING'))).toMatch(/^<div class="[^"]*pl-\[62px\]/);
  });

  it('tops the page with the Nunito clock and "✏️ Mika drawing" in her colour, then the blanks', () => {
    const html = render(view('DRAWING'));
    expect(html).toMatch(/<span role="timer" class="[^"]*font-num text-2xl font-black[^"]*">0:47</);
    expect(html).toContain('<span class="sr-only">✏️ Mika drawing</span>');
    expect(html).toContain(`✏️ <span style="color:${MIKA}">Mika</span> drawing`);
    expect(html.indexOf('role="timer"')).toBeLessThan(html.indexOf('role="img"'));
    expect(html.match(/data-blank="letter"/g)).toHaveLength(8);
  });

  it('writes the clock in red pen in the last 10 s, and only then', () => {
    expect(render(view('DRAWING', { remainingMs: 10_000 }))).toMatch(
      /role="timer" class="[^"]*text-red[^"]*">0:10/,
    );
    expect(render(view('DRAWING', { remainingMs: 11_000 }))).toMatch(
      /role="timer" class="[^"]*text-ink[^"]*">0:11/,
    );
  });

  it('has a pen-underlined guess line with a pen caret and a round pen send button, above the tries', () => {
    const html = render(view('DRAWING'), [{ text: 'payong', close: false }]);
    expect(html).toMatch(/<form class="[^"]*border-b-\[3px\] border-pen/);
    expect(html).toMatch(/<input [^>]*class="[^"]*text-\[26px\][^"]*caret-pen/);
    expect(html).toMatch(/<button type="submit" aria-label="Send" class="wobbly [^"]*bg-pen/);
    expect(html).toMatch(/aria-label="Send"[^>]*><svg [^>]*aria-hidden="true"/);
    for (const attr of [
      'autocomplete="off"',
      'autocorrect="off"',
      'autocapitalize="off"',
      'spellcheck="false"',
      'enterkeyhint="send"',
    ])
      expect(html.toLowerCase()).toContain(attr);
    expect(html.indexOf('<form')).toBeLessThan(html.indexOf('data-try'));
  });

  it('strikes a wrong try through in red pen with ✗ and circles a close one "close!", newest first', () => {
    const html = render(view('DRAWING'), [
      { text: 'payong', close: false },
      { text: 'tsinelas ko', close: true },
    ]);
    const tries = [...html.matchAll(/data-try="(\w+)"/g)].map((m) => m[1]);
    expect(tries).toEqual(['close', 'wrong']);
    expect(html).toMatch(/after:-rotate-\[4deg\] after:bg-red">payong<\/span>/);
    expect(html).toMatch(/<span aria-hidden="true" class="shrink-0 text-red">✗<\/span>/);
    expect(html).toMatch(
      /tsinelas ko<\/span><span aria-hidden="true" class="[^"]*rounded-\[50%\] border-2 border-red[^"]*">close!</,
    );
    // Each try sits on a 34 px ruled line.
    expect(html.match(/<li [^>]*class="[^"]*h-\[34px\]/g)).toHaveLength(2);
  });

  it('ends with "👀 Watch the Screen" in soft', () => {
    expect(render(view('DRAWING'))).toMatch(/class="mt-auto[^"]*text-soft">👀 Watch the Screen</);
  });
});

describe('this turn’s points in the margin (F60)', () => {
  it('writes "+270 this turn" in red Nunito in the margin, and never a rank', () => {
    const html = render(view('DRAWING', { points: 270 }));
    expect(html).toMatch(
      /data-margin-points="true" class="absolute [^"]*left-0 w-\[46px\][^"]*text-red/,
    );
    expect(html).toContain('<span class="sr-only">+270 this turn</span>');
    expect(html).toMatch(/font-num[^"]*">\+270<\/span><span aria-hidden="true"[^>]*>this turn</);
    // Jun is 2nd with 900; neither shows mid-turn.
    expect(html).not.toMatch(/2nd|#2|900/);
  });

  it('is never "+0"', () => {
    for (const v of [view('DRAWING'), view('CHOOSING')]) {
      const html = render(v);
      expect(html).not.toContain('+0');
      expect(html).not.toContain('data-margin-points');
    }
  });

  it('splits the Taglish line the same way', () => {
    const html = render(view('DRAWING', { points: 270 }), [], translator('taglish'));
    expect(html).toMatch(/>\+270<\/span><span aria-hidden="true"[^>]*>ngayong turn</);
  });
});

describe('got it (F60)', () => {
  const html = render(view('DRAWING', { points: 270 }));

  it('shows a big ✓ in the success colour, "Got it!" and a +270 stamp, never the word', () => {
    expect(html).toMatch(/data-gotit="true"/);
    expect(html).toMatch(/text-success">✓</);
    expect(html).toMatch(/text-\[44px\][^"]*">Got it!</);
    expect(html).toMatch(/data-stamp="true" class="[^"]*border-red[^"]*">\+270</);
    expect(html).toContain('<span class="sr-only">✓ You got it! +270</span>');
    expect(html).not.toContain('qz');
  });

  it('drops the blanks and the guess line, then offers the reactions as 56 px wobbly circles', () => {
    expect(html).not.toContain('data-blank');
    expect(html).not.toContain('<input');
    const reactions = html.match(/<button type="button" aria-label="Send [^"]+"[^>]*>/g)!;
    expect(reactions).toHaveLength(6);
    for (const b of reactions) {
      expect(b).toMatch(/class="wobbly /);
      expect(b).toMatch(/\bsize-14\b/);
      expect(b).toMatch(/border-\[2\.5px\] border-ink/);
    }
    expect(html.indexOf('data-gotit')).toBeLessThan(html.indexOf('role="group"'));
  });

  it('says "Nakuha mo!" in Taglish', () => {
    expect(render(view('DRAWING', { points: 270 }), [], translator('taglish'))).toContain(
      '>Nakuha mo!<',
    );
  });
});

describe('the drawer choosing (F60)', () => {
  const html = render(view('CHOOSING', { remainingMs: 10_000 }));

  it('shows Mika’s avatar, "Mika is choosing a word…" in her colour and the ring', () => {
    expect(html).toMatch(/data-avatar="true"[^>]*style="border-color:#B0307F[^"]*width:64px/);
    expect(html).toContain('<span class="sr-only">Mika is choosing a word…</span>');
    expect(html).toContain(`<span style="color:${MIKA}">Mika</span> is choosing a word…`);
    expect(html).toMatch(/<span role="timer" aria-label="10s"><span [^>]*style="width:96px/);
    expect(html).not.toContain('<input');
    expect(html).not.toContain('qz');
  });
});

describe('the helpers (F60)', () => {
  it('NameInColour writes the plain line when there is no player', () => {
    expect(
      renderToStaticMarkup(
        <NameInColour say={(name) => `Waiting for ${name}`} player={undefined} />,
      ),
    ).toBe('Waiting for ');
  });

  it('Stamp is red Nunito in a red oval, with an optional caption', () => {
    const html = renderToStaticMarkup(<Stamp value="+320" caption="for your drawing" big />);
    expect(html).toMatch(/rounded-\[50%\] border-\[3px\] border-red font-num/);
    expect(html).toContain('text-[44px]');
    expect(html).toMatch(/<small class="[^"]*font-hand[^"]*">for your drawing<\/small>/);
  });
});

describe('the restyled files (F60)', () => {
  it('use tokens only: no hex or white classes', () => {
    for (const file of ['./GuesserTurn.tsx', './NameInColour.tsx', '../sketch/Stamp.tsx']) {
      const src = read(file);
      expect(src, file).not.toMatch(/#[0-9A-Fa-f]{6}\b|white\/\d|text-white|bg-white/);
    }
  });

  it('put the guesser’s turn on a ruled page and keep the old dark page only for the results', () => {
    const play = read('../../pages/Play.tsx');
    expect(play).toMatch(/guesserPage\s*\?\s*`paper-ruled \$\{RULED_INSET\}`/);
    expect(play).toContain("className={`min-h-0 flex-1 ${resultsPage ? 'legacy-night' : ''}`}");
  });
});

// The crown holder's phone (F25): the host lobby and the controls drawer (Host controls).
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { Ack, Phase, PlayerChipView, PlayerView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { HostPlayerList } from '../HostPlayerList.js';
import { DrawerSheet, HostDrawer } from './HostDrawer.js';
import { PhoneLobby } from './PhoneLobby.js';

const t = translator('en');
const noop = () => {};
const socket = {} as GameSocket;
const WORD = 'qzsecret';
const HOST = { code: 'KPRW', customWordCount: 0 };

const chip = (pid: string, name: string, extra: Partial<PlayerChipView> = {}): PlayerChipView => ({
  pid,
  name,
  color: '#FF6B35',
  connected: true,
  crown: false,
  isDrawer: false,
  avatar: '🦊',
  hasDoodle: false,
  guessed: false,
  turnPoints: 0,
  score: null,
  rank: null,
  ...extra,
});

/** Mika's view (she holds the crown unless `host` is false), with Jun and Ana. */
function view(
  phase: Phase,
  opts: { host?: boolean; others?: PlayerChipView[]; rematchInMs?: number } = {},
): PlayerView {
  const host = opts.host !== false;
  return {
    role: 'player',
    code: 'KPRW',
    phase,
    paused: null,
    rematchInMs: opts.rematchInMs ?? null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS, guessFeed: 'clean' },
    players: [
      chip('mika', 'Mika', { crown: host, isDrawer: phase === 'DRAWING' }),
      ...(opts.others ?? [chip('jun', 'Jun', { crown: !host }), chip('ana', 'Ana')]),
    ],
    turn:
      phase === 'LOBBY'
        ? null
        : {
            id: 3,
            number: 1,
            cycle: 1,
            drawerPid: 'mika',
            drawerName: 'Mika',
            timer: null,
            mask: null,
            word: null,
            correct: [],
            guessed: { guessed: 0, of: 2 },
            endReason: null,
            drawerReconnecting: false,
          },
    host: host ? HOST : null,
    me: { pid: 'mika', turnPoints: 0, score: null, rank: null, award: null },
    // Mika is the drawer: her own word is in her view, and must stay out of the drawer.
    secret:
      phase === 'DRAWING'
        ? {
            turnId: 3,
            choices: null,
            word: { word: WORD, gloss: 'qzgloss', difficulty: 2, custom: false },
            chooseTimer: null,
          }
        : null,
    lastGuess: null,
  };
}

/** The buttons' text (without `aria-hidden` icons), in order. */
/** Each button's name: its `aria-label`, else its visible text. */
const buttons = (html: string) =>
  [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map(
    (m) =>
      /aria-label="([^"]*)"/.exec(m[1]!)?.[1] ??
      m[2]!
        .replace(/<span aria-hidden="true">.*?<\/span>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim(),
  );
/** The doodle pad's buttons (F30): the size, Undo and the 8 colours. */
const DOODLE = [
  'Brush size: medium. Tap to change',
  '↶ Undo',
  ...['Black', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Brown'],
];

const sendDoodle = () => Promise.resolve<Ack>({ ok: true });
const lobby = (v: PlayerView) =>
  renderToStaticMarkup(
    <PhoneLobby
      view={v}
      socket={socket}
      onLeave={noop}
      onAvatarSaved={noop}
      sendDoodle={sendDoodle}
      t={t}
    />,
  );
const sheet = (v: PlayerView) =>
  renderToStaticMarkup(<DrawerSheet view={v} socket={socket} t={t} onClose={noop} />);

describe('the crown holder’s lobby', () => {
  it('is the host view: "You’re the host 👑", a big Start, the summary and Change', () => {
    const html = lobby(view('LOBBY'));
    expect(html).toContain('You’re the host 👑');
    expect(html).toContain('Classic · 60 s · 2 rounds · Mixed words');
    expect(buttons(html)).toEqual([
      'Change avatar',
      'Start game ▶',
      'Change',
      'Add your own words',
      ...DOODLE,
      'Leave',
    ]);
    expect(html).not.toContain('Waiting for');
    expect(html).toMatch(/<button type="button" aria-disabled="false"[^>]*>Start game/);
  });

  it('shows how many custom words are in on "Add your own words", and never a word', () => {
    const html = lobby({ ...view('LOBBY'), host: { ...HOST, customWordCount: 12 } });
    expect(buttons(html)).toContain('Add your own words  · 12');
    expect(lobby(view('LOBBY', { host: false }))).not.toContain('Add your own words');
  });

  it('disables Start with "Need 2 players" below 2 connected players', () => {
    const alone = lobby(view('LOBBY', { others: [] }));
    expect(alone).toMatch(/<button[^>]*disabled=""[^>]*>Start game/);
    expect(alone).toContain('Need 2 players');
    const offline = lobby(view('LOBBY', { others: [chip('jun', 'Jun', { connected: false })] }));
    expect(offline).toMatch(/<button[^>]*disabled=""[^>]*>Start game/);
    const two = lobby(view('LOBBY', { others: [chip('jun', 'Jun')] }));
    expect(two).not.toMatch(/disabled=""[^>]*>Start game/);
    expect(two).not.toContain('Need 2 players');
  });

  it('is the plain lobby without the crown: who to wait for, no Start or Change', () => {
    const html = lobby(view('LOBBY', { host: false }));
    expect(html).toContain('You’re in, Mika!');
    expect(html).toContain('Waiting for 👑 Jun to start');
    expect(buttons(html)).toEqual(['Change avatar', ...DOODLE, 'Leave']);
  });
});

describe('avatars in the phone lobby (F53)', () => {
  const others = [chip('jun', 'Jun', { avatar: '🚀' }), chip('ana', 'Ana', { avatar: '🐙' })];
  const avatars = (html: string) =>
    [...html.matchAll(/data-avatar[^>]*>([^<]+)</g)].map((m) => m[1]);

  it('shows the player’s own avatar by the heading, then every avatar in "Who’s here"', () => {
    for (const host of [true, false]) {
      // Mika first: the header, then the list (her own chip first).
      expect(avatars(lobby(view('LOBBY', { host, others })))).toEqual(['🦊', '🦊', '🚀', '🐙']);
    }
  });
});

describe('Change avatar in the phone lobby (F54)', () => {
  it('is the avatar by the heading, a button that opens a dialog, in both lobbies', () => {
    for (const host of [true, false]) {
      const html = lobby(view('LOBBY', { host }));
      expect(html).toMatch(
        /<button type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Change avatar"[^>]*><span aria-hidden="true" data-avatar[^>]*>🦊<\/span>/,
      );
      // Closed until tapped.
      expect(html).not.toContain('role="dialog"');
    }
  });

  it('says it in Taglish too', () => {
    const html = renderToStaticMarkup(
      <PhoneLobby
        view={view('LOBBY', { host: false })}
        socket={socket}
        onLeave={noop}
        onAvatarSaved={noop}
        sendDoodle={sendDoodle}
        t={translator('taglish')}
      />,
    );
    expect(html).toContain('aria-label="Palitan ang avatar"');
  });
});

describe('the lobby doodle pad (F27)', () => {
  const PAD = 'Doodle yourself while you wait!';

  it('sits below Start and the summary in the host lobby', () => {
    const html = lobby(view('LOBBY'));
    expect(html).toContain(PAD);
    expect(html.indexOf(PAD)).toBeGreaterThan(html.indexOf('Start game'));
    expect(html.indexOf(PAD)).toBeGreaterThan(html.indexOf('Change'));
    expect(html).toMatch(
      /<canvas role="img" aria-label="Your doodle\. It shows on the Screen\."[^>]*touch-none/,
    );
    // Undo starts disabled: nothing drawn yet.
    expect(html).toMatch(/<button type="button" disabled=""[^>]*>↶ Undo<\/button>/);
  });

  it('sits under the waiting line in the plain lobby, above who’s here', () => {
    const html = lobby(view('LOBBY', { host: false }));
    expect(html.indexOf(PAD)).toBeGreaterThan(html.indexOf('Waiting for 👑 Jun to start'));
    expect(html.indexOf(PAD)).toBeLessThan(html.indexOf('Who’s here'));
    // Optional: only its tools, then Leave (Change avatar sits by the heading).
    expect(buttons(html)).toEqual(['Change avatar', ...DOODLE, 'Leave']);
  });
});

describe('the crown phone’s Host button', () => {
  it('shows the button with the drawer closed by default, even for the drawer', () => {
    const html = renderToStaticMarkup(
      <HostDrawer view={view('DRAWING')} socket={socket} t={t} open={false} onOpenChange={noop} />,
    );
    expect(buttons(html)).toEqual(['Host']);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });
});

describe('the controls drawer', () => {
  it('in DRAWING: Pause, Skip, End, the guess feed and the players list, never the word', () => {
    const html = sheet(view('DRAWING'));
    expect(buttons(html)).toEqual([
      'Close',
      'Pause',
      'Skip turn',
      'End game',
      'All',
      'Clean',
      'Off',
      // Jun holds no crown here (Mika does); Mika's own row has no buttons.
      'Give host crown',
      'Kick',
      'Give host crown',
      'Kick',
    ]);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Clean</);
    expect(html).not.toContain('qz');
  });

  it('in CHOOSING: the same controls', () => {
    expect(buttons(sheet(view('CHOOSING'))).slice(0, 7)).toEqual([
      'Close',
      'Pause',
      'Skip turn',
      'End game',
      'All',
      'Clean',
      'Off',
    ]);
  });

  it.each<Phase>(['REVEAL', 'SCOREBOARD'])('in %s: Next, Pause and End only', (phase) => {
    expect(buttons(sheet(view(phase)))).toEqual(['Close', 'Next', 'Pause', 'End game']);
  });

  it('in FINAL: a big Rematch, Back to lobby, End and the players list', () => {
    const html = sheet(view('FINAL'));
    expect(buttons(html)).toEqual([
      'Close',
      'Rematch',
      'Back to lobby',
      'End game',
      'Give host crown',
      'Kick',
      'Give host crown',
      'Kick',
    ]);
    expect(html).toMatch(/min-h-16[^"]*"[^>]*>Rematch/);
  });

  it('during a rematch countdown: only Cancel', () => {
    expect(buttons(sheet(view('FINAL', { rematchInMs: 2000 })))).toEqual(['Close', 'Cancel']);
  });
});

describe('the host’s players list', () => {
  it('offers Give host crown to everyone but the holder, and Kick to everyone but yourself', () => {
    const players = [chip('mika', 'Mika'), chip('jun', 'Jun', { crown: true }), chip('ana', 'Ana')];
    const html = renderToStaticMarkup(
      <HostPlayerList players={players} socket={socket} t={t} size="phone" mePid="mika" />,
    );
    expect(buttons(html)).toEqual(['Kick', 'Give host crown', 'Kick']);
    expect(html).toContain('Mika (you)');
    expect(html).toContain('👑 Jun');
  });

  it('keeps every button at least 44 px', () => {
    const html = sheet(view('DRAWING'));
    for (const m of html.matchAll(/<button[^>]*class="([^"]*)"/g))
      expect(m[1]).toMatch(/min-h-(11|12|16)/);
  });
});

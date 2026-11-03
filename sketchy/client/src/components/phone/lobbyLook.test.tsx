// The sketchbook phone shell and lobby (F58): markup and source checks. The look itself is checked
// by the F58 playtest against the mockup (`sketchbook.html#sketch-lobby`).
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { PlayerChipView, PlayerView } from '../../../../shared/types.js';
import { t } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { ConnectionDot } from './ConnectionDot.js';
import { LeaveButton } from './LeaveButton.js';
import { PhoneLobby } from './PhoneLobby.js';

const noop = () => {};
const socket = {} as GameSocket;
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const chip = (pid: string, name: string, color: string, extra: Partial<PlayerChipView> = {}) =>
  ({
    pid,
    name,
    color,
    connected: true,
    crown: false,
    isDrawer: false,
    avatar: '🦊',
    guessed: false,
    turnPoints: 0,
    score: null,
    rank: null,
    ...extra,
  }) satisfies PlayerChipView;

/** Jun's lobby; Mika holds the crown unless `host` makes it Jun's. */
function view(host: boolean, extra: PlayerChipView[] = []): PlayerView {
  return {
    role: 'player',
    code: 'KPRW',
    phase: 'LOBBY',
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: DEFAULT_SETTINGS,
    players: [
      chip('mika', 'Mika', '#B0307F', { crown: !host }),
      chip('jun', 'Jun', '#1A7A4A', { crown: host, avatar: '🚀' }),
      ...extra,
    ],
    turn: null,
    host: host ? { code: 'KPRW', customWordCount: 0, categories: [] } : null,
    me: { pid: 'jun', turnPoints: 0, score: null, rank: null, award: null },
    secret: null,
    lastGuess: null,
  };
}

const lobby = (v: PlayerView) =>
  renderToStaticMarkup(
    <PhoneLobby view={v} socket={socket} onLeave={noop} onAvatarSaved={noop} t={t} />,
  );

describe('the guest lobby (F58)', () => {
  const html = lobby(view(false, [chip('ana', 'Ana', '#2457B8', { connected: false })]));

  it('starts right of the ruled page’s margin', () => {
    expect(html).toContain('pl-[62px]');
  });

  it('shows a 64 px avatar (the Change avatar button) beside "You’re in, Jun!"', () => {
    expect(html).toMatch(/aria-label="Change avatar"[^>]*><span[^>]*data-avatar[^>]*width:4rem/);
    expect(html).toMatch(/<h1 class="[^"]*text-\[30px\][^"]*">You’re in, Jun!<\/h1>/);
  });

  it('writes the host’s name in their colour, and says the sentence whole to screen readers', () => {
    expect(html).toContain('<span class="sr-only">Waiting for 👑 Mika to start</span>');
    expect(html).toContain(
      '<span aria-hidden="true">Waiting for 👑 <span style="color:#B0307F">Mika</span> to start</span>',
    );
  });

  it('shows who’s here as avatars with the count, each named for screen readers', () => {
    expect(html).toContain('Who’s here (3)');
    const row = html.slice(html.indexOf('Who’s here (3)'));
    expect([...row.matchAll(/data-avatar[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual([
      '🚀',
      '🦊',
      '🦊',
    ]);
    expect(row).toContain('<span class="sr-only">Jun (you)</span>');
    expect(row).toContain('<span class="sr-only">👑 Mika</span>');
    // Ana is offline: her avatar is faded, and screen readers hear it.
    expect(row).toMatch(/<li class="opacity-50">[^]*?Ana \(Offline\)/);
  });

  it('has the doodle pad in a dashed box, with its note written under it', () => {
    expect(html).toMatch(/class="[^"]*border-dashed border-soft[^"]*"><canvas role="img"/);
    expect(html).toContain('<span aria-hidden="true">Your doodle. It stays on your phone.</span>');
    // Sketchbook swatches: wobbly, ringed in ink.
    expect(html).toContain('wobbly block size-10 border-[2.5px] border-ink');
  });

  it('ends with Leave, underlined', () => {
    expect(html).toMatch(/<button type="button" class="[^"]*underline[^"]*">Leave<\/button>/);
  });
});

describe('the host lobby (F58)', () => {
  const html = lobby(view(true, [chip('ana', 'Ana', '#2457B8')]));

  it('has a "Room KPRW" eyebrow over "You’re the host 👑"', () => {
    expect(html).toMatch(/<p class="[^"]*font-num[^"]*uppercase[^"]*">Room KPRW<\/p>/);
    expect(html.indexOf('Room KPRW')).toBeLessThan(html.indexOf('You’re the host 👑'));
  });

  it('lists the players on dashed rules, names in their colour, the crown marked', () => {
    const roster = html.slice(html.indexOf('<ul'), html.indexOf('</ul>'));
    const rows = roster.split('<li').slice(1);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toContain('border-dashed border-dot');
    // Jun (you, the host) first, then the others in order.
    expect(rows[0]).toContain('<span class="min-w-0 truncate" style="color:#1A7A4A">Jun</span>');
    expect(rows[0]).toContain('(you)');
    expect(rows[0]).toContain('👑');
    expect(rows[1]).toContain('style="color:#B0307F">Mika</span>');
    expect(rows[1]).not.toContain('👑');
    // The crown is named for screen readers.
    expect(rows[0]).toContain('<span role="img" aria-label="Host"');
    // Read-only: Kick and Give crown stay in Change's players list.
    expect(roster).not.toContain('<button');
  });

  it('has a full-width primary sketch Start under the roster, then the settings line', () => {
    expect(html).toMatch(/<button[^>]*class="[^"]*sketch-border[^"]*bg-hl[^"]*w-full[^"]*">Start/);
    expect(html.indexOf('Start game')).toBeGreaterThan(html.indexOf('</ul>'));
    expect(html).toMatch(
      /Classic · 60 s · 2 rounds · \d+ categor(?:y|ies)<\/span><span[^>]*><span aria-hidden="true">·<\/span><button[^>]*underline[^>]*>Change</,
    );
  });

  it('writes "(Offline)" by a player who dropped, fading only the avatar', () => {
    const away = lobby(view(true, [chip('ana', 'Ana', '#2457B8', { connected: false })]));
    expect(away).toMatch(/<span class="opacity-40"><span[^>]*data-avatar/);
    expect(away).toMatch(/style="color:#2457B8">Ana<\/span><span[^>]*>\(Offline\)<\/span>/);
  });

  it('is on dot-grid paper, not the ruled page', () => {
    expect(html).not.toContain('pl-[62px]');
  });
});

describe('the phone shell (F58)', () => {
  it('rings the connection dot in ink, so it reads on paper', () => {
    expect(renderToStaticMarkup(<ConnectionDot connection="connected" t={t} />)).toContain(
      'ring-ink',
    );
  });

  it('shows Leave as an underlined word until it is tapped', () => {
    const html = renderToStaticMarkup(<LeaveButton onLeave={noop} inGame={false} t={t} />);
    expect(html).toContain('underline');
    expect(html).not.toContain('bg-hl');
  });

  it('switches the page to paper: body, colour scheme and theme colour', () => {
    const css = read('../../index.css');
    const body = css.slice(css.indexOf('html,\nbody {'));
    expect(body).toMatch(/background: var\(--color-paper\);\s+color: var\(--color-ink\);/);
    expect(body).toContain('color-scheme: light;');
    expect(read('../../../index.html')).toContain('<meta name="theme-color" content="#F8F8F3" />');
  });

  it('uses only sketchbook tokens on the restyled surfaces', () => {
    for (const file of [
      '../../pages/Play.tsx',
      './PhoneLobby.tsx',
      './DoodlePad.tsx',
      './LeaveButton.tsx',
    ]) {
      const src = read(file);
      expect(src, file).not.toMatch(/#[0-9A-Fa-f]{6}\b|white\/\d|text-white|bg-white/);
    }
  });
});

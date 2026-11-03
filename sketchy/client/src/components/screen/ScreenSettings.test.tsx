import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type {
  LobbyCategoryView,
  PlayerChipView,
  RoomSettings,
  ScreenView,
} from '../../../../shared/types.js';
import { t } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { PlayersDialog } from './PlayersDialog.js';
import { ScreenLobby } from './ScreenLobby.js';
import { SettingsPanel, settingsLine } from './ScreenSettings.js';

const noop = () => {};

const panel = (
  settings: RoomSettings,
  error: string | null = null,
  categories: readonly LobbyCategoryView[] = [],
) =>
  renderToStaticMarkup(
    <SettingsPanel
      settings={settings}
      categories={categories}
      sending={false}
      error={error}
      onSend={noop}
      onClose={noop}
      t={t}
    />,
  );

/** The labels of the pressed buttons, in order. */
const pressed = (html: string) =>
  [...html.matchAll(/aria-pressed="true"[^>]*>(.*?)<\/button>/g)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, '').trim(),
  );

function lobby(host: boolean, settings: RoomSettings = DEFAULT_SETTINGS): ScreenView {
  return {
    role: 'screen',
    code: 'KPRW',
    phase: 'LOBBY',
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings,
    players: [],
    turn: null,
    host: host ? { code: 'KPRW', customWordCount: 0, categories: [] } : null,
    feed: [],
    almost: [],
    awards: [],
    gallery: [],
    tonight: null,
    nextDrawer: null,
  };
}

describe('Screen settings panel (F22)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists the three presets and every setting with its allowed values', () => {
    const html = panel(DEFAULT_SETTINGS);
    for (const label of ['Quick', 'Classic', 'Party Night']) expect(html).toContain(label);
    for (const label of [
      'Drawing time',
      'Rounds',
      'Hints',
      'Difficulty',
      'Guess feed',
      'Auto-advance',
    ])
      expect(html).toContain(`>${label}</legend>`);
    // English only (F69): no words or game-text setting, no language options.
    // The presets, the 6 choice settings and Categories (which replaced Spicy words, F78).
    expect(html.match(/<\/legend>/g)).toHaveLength(8);
    expect(html).toContain('>Categories</legend>');
    for (const gone of [
      '>Words</legend>',
      '>Game text</legend>',
      'English',
      'Tag' + 'lish',
      'Spicy words',
    ])
      expect(html).not.toContain(gone);
    for (const n of [45, 60, 80, 100]) expect(html).toContain(`>${n} s</button>`);
  });

  it('marks Classic and each default as pressed', () => {
    expect(pressed(panel(DEFAULT_SETTINGS))).toEqual([
      'Classic60 s · 2 roundsAbout 10 min',
      '60 s',
      '2',
      'On',
      'Mixed',
      'All',
      'On',
    ]);
  });

  it('marks no preset and says Custom once a preset value is changed', () => {
    const html = panel({ ...DEFAULT_SETTINGS, drawSeconds: 100 });
    expect(html).toContain('Presets · Custom');
    expect(pressed(html)[0]).toBe('100 s');
  });

  it('shows a refused change', () => {
    expect(panel(DEFAULT_SETTINGS, 'Could not change that. Try again.')).toContain(
      'Could not change that. Try again.',
    );
  });

  it('only the token Screen gets the Settings button; the summary names the preset', () => {
    // The lobby reads the join host from `window.location`; the tests have no DOM.
    vi.stubGlobal('window', { location: { host: 'sketchy.test', origin: 'https://sketchy.test' } });
    const socket = {} as GameSocket;
    const host = renderToStaticMarkup(<ScreenLobby view={lobby(true)} socket={socket} t={t} />);
    const plain = renderToStaticMarkup(<ScreenLobby view={lobby(false)} socket={socket} t={t} />);
    expect(host).toContain('aria-haspopup="dialog"');
    expect(plain).not.toContain('aria-haspopup="dialog"');
    expect(plain).toContain('Classic · 60 s · 2 rounds');
    const quick = renderToStaticMarkup(
      <ScreenLobby
        view={lobby(false, { ...DEFAULT_SETTINGS, drawSeconds: 45, cycles: 1 })}
        socket={socket}
        t={t}
      />,
    );
    expect(quick).toContain('Quick · 45 s · 1 round');
  });
});

describe('the crown on the Screen lobby (F25)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const socket = {} as GameSocket;
  const chip = (pid: string, name: string, crown = false): PlayerChipView => ({
    pid,
    name,
    color: '#C2410C',
    connected: true,
    crown,
    isDrawer: false,
    avatar: '🦊',
    guessed: false,
    turnPoints: 0,
    score: null,
    rank: null,
  });
  const players = [chip('mika', 'Mika', true), chip('jun', 'Jun')];

  it('with the token: "👑 Mika is hosting · tap a name to change", and the chips are buttons', () => {
    vi.stubGlobal('window', { location: { host: 'sketchy.test', origin: 'https://sketchy.test' } });
    const html = renderToStaticMarkup(
      <ScreenLobby view={{ ...lobby(true), players }} socket={socket} t={t} />,
    );
    expect(html).toContain('👑 Mika is hosting · tap a name to change');
    expect(html.match(/<button[^>]*aria-haspopup="dialog"[^>]*><span aria-hidden/g)).toHaveLength(
      2,
    );
  });

  it('without the token: "Waiting for 👑 Mika to start", and the chips are not buttons', () => {
    vi.stubGlobal('window', { location: { host: 'sketchy.test', origin: 'https://sketchy.test' } });
    const html = renderToStaticMarkup(
      <ScreenLobby view={{ ...lobby(false), players }} socket={socket} t={t} />,
    );
    expect(html).toContain('Waiting for 👑 Mika to start');
    expect(html).not.toContain('tap a name');
    expect(html).not.toContain('<button');
  });

  it('a chip’s dialog offers Give host crown and Kick; the holder only Kick', () => {
    const jun = renderToStaticMarkup(
      <PlayersDialog players={[players[1]!]} title="Jun" socket={socket} t={t} onClose={noop} />,
    );
    expect(jun).toContain('role="dialog"');
    expect([...jun.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1])).toEqual([
      'Close',
      'Give host crown',
      'Kick',
    ]);
    const mika = renderToStaticMarkup(
      <PlayersDialog players={[players[0]!]} title="Mika" socket={socket} t={t} onClose={noop} />,
    );
    expect(mika).not.toContain('Give host crown');
    expect(mika).toContain('Kick');
  });
});

describe('How to play on the Screen lobby (F26)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the three steps on every Screen, token or not', () => {
    vi.stubGlobal('window', { location: { host: 'sketchy.test', origin: 'https://sketchy.test' } });
    for (const host of [true, false]) {
      const html = renderToStaticMarkup(
        <ScreenLobby view={lobby(host)} socket={{} as GameSocket} t={t} />,
      );
      expect(html).toContain('How to play');
      const steps = html.indexOf('1 · One person draws on their phone');
      expect(steps).toBeGreaterThan(html.indexOf('KPRW'));
      expect(html.indexOf('2 · Everyone else types guesses 🤫')).toBeGreaterThan(steps);
      expect(html.indexOf('3 · Faster = more points')).toBeGreaterThan(steps);
    }
  });
});

describe('Categories in the settings sheet (F78)', () => {
  const CATS: LobbyCategoryView[] = [
    { id: 'en-animals', title: 'Animals', emoji: '🐾', wordCount: 70, defaultOn: true },
    { id: 'en-food', title: 'Food', emoji: '🍔', wordCount: 64, defaultOn: true },
    { id: 'en-spicy', title: 'Spicy', emoji: '🌶️', wordCount: 61, defaultOn: false },
  ];
  const chosen = { ...DEFAULT_SETTINGS, categories: ['en-food', 'en-animals'] };

  /** Each category chip: [pressed, text]. */
  const chips = (html: string) =>
    [
      ...html
        .slice(html.indexOf('data-settings="categories"'))
        .matchAll(/aria-pressed="(true|false)"[^>]*>(.*?)<\/button>/g),
    ].map((m) => [m[1] === 'true', m[2]!.replace(/<[^>]+>/g, '')] as const);

  it('shows one chip per category, in the order given, with emoji, title and word count', () => {
    expect(chips(panel(chosen, null, CATS))).toEqual([
      [true, '✓🐾Animals· 70 words'],
      [true, '✓🍔Food· 64 words'],
      [false, '🌶️Spicy· 61 words'],
    ]);
  });

  it('chips are 44 px paper options like the other settings', () => {
    const html = panel(chosen, null, CATS);
    const classes = [
      ...html
        .slice(html.indexOf('data-settings="categories"'))
        .matchAll(/<button[^>]*aria-pressed="[^"]*"[^>]*class="([^"]*)"/g),
    ].map((m) => m[1]!);
    expect(classes).toHaveLength(3);
    for (const c of classes) expect(c).toMatch(/min-h-11 min-w-11.*border-ink bg-paper/);
  });

  it('ticked chips show the count in ink, unticked in soft grey', () => {
    const html = panel(chosen, null, CATS);
    expect(html).toContain('<span class="shrink-0">· 70 words</span>');
    expect(html).toContain('<span class="shrink-0 text-soft">· 61 words</span>');
  });

  it('hints "Pick at least one category" when nothing is ticked', () => {
    expect(panel({ ...chosen, categories: [] }, null, CATS)).toContain(
      '<p class="text-soft">Pick at least one category</p>',
    );
    expect(panel(chosen, null, CATS)).not.toContain('Pick at least one category');
  });

  it('says so when there is nothing to pick', () => {
    expect(panel(chosen)).toContain('No categories to pick from.');
  });

  it('the summary names the category count, not counting ids the store no longer shows', () => {
    expect(settingsLine(t, chosen)).toBe('Classic · 60 s · 2 rounds · 2 categories');
    expect(settingsLine(t, { ...chosen, categories: ['en-food'] })).toBe(
      'Classic · 60 s · 2 rounds · 1 category',
    );
    expect(settingsLine(t, { ...chosen, categories: ['en-food', 'gone'] }, CATS)).toBe(
      'Classic · 60 s · 2 rounds · 1 category',
    );
    expect(settingsLine(t, { ...DEFAULT_SETTINGS, categories: [] })).toBe(
      'Classic · 60 s · 2 rounds · 0 categories',
    );
  });
});

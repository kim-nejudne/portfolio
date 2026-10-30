import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { RoomSettings, ScreenView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { ScreenLobby } from './ScreenLobby.js';
import { SettingsPanel } from './ScreenSettings.js';

const t = translator('en');
const noop = () => {};

const panel = (settings: RoomSettings, error: string | null = null) =>
  renderToStaticMarkup(
    <SettingsPanel
      settings={settings}
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
    settings,
    players: [],
    turn: null,
    host: host ? { code: 'KPRW', customWordCount: 0 } : null,
    feed: [],
    closeGuesses: [],
    awards: [],
    gallery: [],
  };
}

describe('Screen settings panel (F22)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists the three presets and every setting with its allowed values', () => {
    const html = panel(DEFAULT_SETTINGS);
    for (const label of ['Quick', 'Classic', 'Barkada Night']) expect(html).toContain(label);
    for (const label of [
      'Drawing time',
      'Rounds',
      'Hints',
      'Difficulty',
      'Words',
      'Spicy words',
      'Guess feed',
      'Game text',
      'Auto-advance',
    ])
      expect(html).toContain(`>${label}</legend>`);
    for (const n of [45, 60, 80, 100]) expect(html).toContain(`>${n} s</button>`);
  });

  it('marks Classic and each default as pressed', () => {
    expect(pressed(panel(DEFAULT_SETTINGS))).toEqual([
      'Classic60 s · 2 roundsAbout 10 min',
      '60 s',
      '2',
      'On',
      'Mixed',
      'Mixed',
      'Off',
      'All',
      'English',
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
    vi.stubGlobal('window', { location: { host: 'sketchy.test' } });
    const socket = {} as GameSocket;
    const host = renderToStaticMarkup(<ScreenLobby view={lobby(true)} socket={socket} t={t} />);
    const plain = renderToStaticMarkup(<ScreenLobby view={lobby(false)} socket={socket} t={t} />);
    expect(host).toContain('aria-haspopup="dialog"');
    expect(plain).not.toContain('aria-haspopup="dialog"');
    expect(plain).toContain('Classic · 60 s · 2 rounds · Mixed words');
    const quick = renderToStaticMarkup(
      <ScreenLobby
        view={lobby(false, { ...DEFAULT_SETTINGS, drawSeconds: 45, cycles: 1 })}
        socket={socket}
        t={t}
      />,
    );
    expect(quick).toContain('Quick · 45 s · 1 round · Mixed words');
  });
});

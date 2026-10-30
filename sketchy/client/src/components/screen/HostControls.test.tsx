import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { Phase, ScreenView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { ControlId } from '../../lib/hostKeys.js';
import type { GameSocket } from '../../lib/socket.js';
import type { SoundLevel } from '../../lib/soundPref.js';
import { ControlBar, HostControls, ShortcutsHelp } from './HostControls.js';

const t = translator('en');
const noop = () => {};
const socket = {} as GameSocket;

function view(
  phase: Phase,
  opts: { host?: boolean; paused?: boolean; rematchInMs?: number } = {},
): ScreenView {
  return {
    role: 'screen',
    code: 'KPRW',
    phase,
    paused: opts.paused ? { reasons: ['host'], resumeInMs: null } : null,
    rematchInMs: opts.rematchInMs ?? null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS },
    players: [],
    turn: null,
    host: opts.host === false ? null : { code: 'KPRW', customWordCount: 0 },
    feed: [],
    closeGuesses: [],
    awards: [],
    gallery: [],
    tonight: null,
  };
}

const bar = (
  v: ScreenView,
  opts: {
    armed?: ControlId;
    sound?: SoundLevel;
    fullscreen?: boolean | null;
    onPlayers?: () => void;
  } = {},
) =>
  renderToStaticMarkup(
    <ControlBar
      view={v}
      armed={opts.armed ?? null}
      sending={null}
      sound={opts.sound ?? 'on'}
      fullscreen={opts.fullscreen === undefined ? false : opts.fullscreen}
      onControl={noop}
      onFullscreen={noop}
      onSound={noop}
      onHelp={noop}
      {...(opts.onPlayers ? { onPlayers: opts.onPlayers } : {})}
      t={t}
    />,
  );

/** The buttons' accessible text (without `aria-hidden` icons), in order. */
const buttons = (html: string) =>
  [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) =>
    m[1]!
      .replace(/<span aria-hidden="true">.*?<\/span>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim(),
  );

describe('Screen control bar (F24)', () => {
  it('renders nothing without the token, in every phase', () => {
    for (const phase of ['LOBBY', 'CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'] as const)
      expect(
        renderToStaticMarkup(
          <HostControls view={view(phase, { host: false })} socket={socket} t={t} />,
        ),
      ).toBe('');
  });

  it('renders the bar on the token Screen', () => {
    const html = renderToStaticMarkup(<HostControls view={view('REVEAL')} socket={socket} t={t} />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Host controls"');
  });

  it('shows the turn controls in DRAWING, with the guess feed setting', () => {
    expect(buttons(bar(view('DRAWING')))).toEqual([
      'Pause',
      'Skip turn',
      'Guess feed: All',
      'End game',
      'Fullscreen',
      'Sound on',
      'Shortcuts',
    ]);
  });

  it('shows Next in REVEAL and SCOREBOARD, and Resume without Next while paused', () => {
    expect(buttons(bar(view('REVEAL')))).toContain('Next');
    expect(buttons(bar(view('SCOREBOARD')))).toContain('Next');
    const paused = buttons(bar(view('REVEAL', { paused: true })));
    expect(paused).toContain('Resume');
    expect(paused).not.toContain('Next');
  });

  it('shows Rematch, Back to lobby and End on FINAL, and only Cancel in the countdown', () => {
    expect(buttons(bar(view('FINAL'))).slice(0, 3)).toEqual([
      'Rematch',
      'Back to lobby',
      'End game',
    ]);
    expect(buttons(bar(view('FINAL', { rematchInMs: 2000 }))).slice(0, 1)).toEqual(['Cancel']);
    expect(buttons(bar(view('FINAL', { rematchInMs: 2000 })))).not.toContain('Rematch');
  });

  it('only the utilities in the lobby, where Start is the lobby’s own button', () => {
    expect(buttons(bar(view('LOBBY')))).toEqual(['Fullscreen', 'Sound on', 'Shortcuts']);
  });

  it('a first tap asks for a second', () => {
    expect(buttons(bar(view('DRAWING'), { armed: 'skip' }))).toContain('Tap again to skip');
    expect(buttons(bar(view('FINAL'), { armed: 'rematch' }))).toContain(
      'Tap again to rematch: the gallery will be cleared',
    );
  });

  it('shows the sound level, and no Fullscreen where the API is missing', () => {
    expect(buttons(bar(view('DRAWING'), { sound: 'muted' }))).toContain('Muted');
    expect(buttons(bar(view('DRAWING'), { fullscreen: true }))).toContain('Exit fullscreen');
    expect(buttons(bar(view('DRAWING'), { fullscreen: null }))).not.toContain('Fullscreen');
  });

  it('labels every control at least 44 px', () => {
    const html = bar(view('DRAWING'));
    const all = html.match(/<button/g)!.length;
    expect(html.match(/<button[^>]*min-h-11 min-w-11/g)).toHaveLength(all);
  });
});

describe('Screen shortcuts overlay (F24)', () => {
  it('lists every shortcut from the spec’s table as a dialog', () => {
    const html = renderToStaticMarkup(<ShortcutsHelp onClose={noop} t={t} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Keyboard shortcuts');
    for (const key of ['Space', 'Esc', 'L', 'P', 'S', 'E', 'N', 'G', 'F', 'M', '?'])
      expect(html).toContain(`>${key}</kbd>`);
    expect(html).toContain('Guess feed All → Clean → Off');
    expect(html).toContain('Sound on / Quiet / Muted');
  });
});

describe('the bar’s players list (F25)', () => {
  it('has a Players button once the game has started, not in the lobby', () => {
    for (const phase of ['CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'] as const)
      expect(buttons(bar(view(phase), { onPlayers: noop }))).toContain('Players');
    expect(buttons(bar(view('LOBBY'), { onPlayers: noop }))).not.toContain('Players');
  });
});

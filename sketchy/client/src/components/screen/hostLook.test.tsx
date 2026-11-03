// F63: the token Screen's host UI in the Sketchbook look. The behaviour stays pinned by the
// HostControls, ScreenSettings, CustomWords and PlayersDialog tests; these pin the look.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, PLAYER_COLORS } from '../../../../shared/constants.js';
import type { Phase, PlayerChipView, ScreenView } from '../../../../shared/types.js';
import { t } from '../../lib/copy.js';
import type { ControlId } from '../../lib/hostKeys.js';
import type { GameSocket } from '../../lib/socket.js';
import { CustomWordsPanel } from '../CustomWords.js';
import { ControlBar, ShortcutsHelp } from './HostControls.js';
import { PlayersDialog } from './PlayersDialog.js';
import { SettingsPanel } from './ScreenSettings.js';

const noop = () => {};
const socket = {} as GameSocket;
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

function view(phase: Phase, paused = false): ScreenView {
  return {
    role: 'screen',
    code: 'KPRW',
    phase,
    paused: paused ? { reasons: ['host'], resumeInMs: null } : null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS },
    players: [],
    turn: null,
    host: { code: 'KPRW', customWordCount: 0, categories: [] },
    feed: [],
    almost: [],
    awards: [],
    gallery: [],
    tonight: null,
    nextDrawer: null,
  };
}

const bar = (v: ScreenView, armed: ControlId | null = null) =>
  renderToStaticMarkup(
    <ControlBar
      view={v}
      armed={armed}
      sending={null}
      sound="on"
      fullscreen={false}
      onControl={noop}
      onFullscreen={noop}
      onSound={noop}
      onHelp={noop}
      onPlayers={noop}
      t={t}
    />,
  );

/** The class of the button whose text starts with `label`. */
const buttonClass = (html: string, label: string) =>
  [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>(.*?)<\/button>/g)].find((m) =>
    m[2]!
      .replace(/<span aria-hidden="true">.*?<\/span>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .startsWith(label),
  )?.[1];

const player = (pid: string, name: string, crown = false): PlayerChipView => ({
  pid,
  name,
  color: PLAYER_COLORS[0]!,
  avatar: '🦊',
  connected: true,
  crown,
  isDrawer: false,
  guessed: false,
  turnPoints: 0,
  score: null,
  rank: null,
});

describe('the control bar (F63)', () => {
  it('is a strip of tape along the bottom edge with the buttons on it', () => {
    const html = bar(view('DRAWING'));
    expect(html).toMatch(/^<div role="group" aria-label="Host controls" data-host-bar/);
    const tape = html.indexOf('data-tape="wide"');
    expect(tape).toBeGreaterThan(0);
    expect(tape).toBeLessThan(html.indexOf('<button'));
    expect(html).not.toMatch(/backdrop-blur|bg-black/);
  });

  it('every control is a sketch button with a hard shadow and a 44 px floor', () => {
    const html = bar(view('DRAWING'));
    const classes = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]!);
    expect(classes).toHaveLength(8);
    for (const c of classes) {
      expect(c).toContain('sketch-border');
      expect(c).toContain('font-hand');
      expect(c).toContain('min-h-11');
      expect(c).toMatch(/shadow-\[[^\]]*var\(--color-ink\)\]/);
      // The press collapses the shadow, over the smaller `!` one.
      expect(c).toContain('not-disabled:active:shadow-none!');
    }
  });

  it('Next, Resume and Rematch are on the highlighter, the rest on paper', () => {
    expect(buttonClass(bar(view('REVEAL')), 'Next')).toContain('bg-hl');
    expect(buttonClass(bar(view('REVEAL', true)), 'Resume')).toContain('bg-hl');
    expect(buttonClass(bar(view('FINAL')), 'Rematch')).toContain('bg-hl');
    for (const label of ['Pause', 'Skip turn', 'Guess feed', 'End game', 'Players', 'Shortcuts'])
      expect(buttonClass(bar(view('DRAWING')), label), label).toContain('bg-paper');
  });

  it('a first tap turns the button red pen until the second', () => {
    const armed = buttonClass(bar(view('DRAWING'), 'skip'), 'Tap again to skip');
    expect(armed).toContain('bg-red');
    expect(armed).toContain('text-paper');
    expect(buttonClass(bar(view('DRAWING')), 'Skip turn')).not.toContain('bg-red');
  });
});

describe('the shortcuts overlay (F63)', () => {
  const html = renderToStaticMarkup(<ShortcutsHelp onClose={noop} t={t} />);

  it('is a ruled index card, taped on a paper veil', () => {
    expect(html).toMatch(/^<div class="[^"]*bg-paper\/80/);
    expect(html).toMatch(/role="dialog"[^>]*data-index-card[^>]*class="[^"]*bg-paper[^"]*"/);
    expect(html.indexOf('data-tape="top"')).toBeLessThan(html.indexOf('Keyboard shortcuts'));
    // The red header line under the title, then one shortcut to each blue rule.
    expect(html).toMatch(/<h2 id="shortcuts-title" class="[^"]*border-margin/);
    expect(html.match(/<tr class="border-b border-rule">/g)).toHaveLength(11);
  });

  it('keys are hand-bordered paper caps, and Close is a sketch button', () => {
    const caps = html.match(/<kbd class="([^"]*)"/g)!;
    expect(caps.length).toBeGreaterThanOrEqual(11);
    for (const c of caps) expect(c).toMatch(/border-ink bg-paper/);
    expect(buttonClass(html, 'Close')).toMatch(/sketch-border.*bg-hl/);
  });
});

describe('the settings sheet (F63)', () => {
  const html = renderToStaticMarkup(
    <SettingsPanel
      settings={{ ...DEFAULT_SETTINGS, categories: ['en-food'] }}
      categories={[
        { id: 'en-food', title: 'Food', emoji: '🍔', wordCount: 64, defaultOn: true },
        { id: 'en-spicy', title: 'Spicy', emoji: '🌶️', wordCount: 61, defaultOn: false },
      ]}
      sending={false}
      error="Could not change that. Try again."
      onSend={noop}
      onClose={noop}
      t={t}
    />,
  );

  it('is a dot-grid sheet with a pen-underlined title and Done on the highlighter', () => {
    expect(html).toMatch(/role="dialog"[^>]*data-sheet="settings" class="[^"]*bg-paper paper-dots/);
    expect(html).toMatch(/<h2 id="settings-title" class="[^"]*border-pen[^"]*font-normal/);
    expect(buttonClass(html, 'Done')).toMatch(/sketch-border.*bg-hl/);
    expect(buttonClass(html, 'Done')).toContain('not-disabled:active:shadow-none!');
  });

  it('each choice is hand-bordered paper, the room’s value on the highlighter', () => {
    const options = [
      ...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*class="([^"]*)"/g),
    ];
    expect(options.length).toBeGreaterThan(20);
    for (const [, , c] of options) expect(c).toMatch(/border-ink bg-paper.*aria-pressed:bg-hl/);
    expect(html).toContain('<legend class="mb-[1vmin] text-soft">');
  });

  it('writes a refusal in red pen', () => {
    expect(html).toMatch(/<p role="status" class="[^"]*text-red">Could not change that/);
  });
});

describe('the custom words sheet (F63)', () => {
  const panel = (count: number, onScreen: boolean) =>
    renderToStaticMarkup(
      <CustomWordsPanel count={count} socket={socket} t={t} onClose={noop} onScreen={onScreen} />,
    );

  it('is a dot-grid sheet with a hand-bordered box and sketch buttons', () => {
    const html = panel(3, true);
    expect(html).toMatch(/role="dialog"[^>]*data-sheet="custom-words" class="[^"]*paper-dots/);
    expect(html).toMatch(/<textarea[^>]*class="sketch-border w-full bg-paper[^"]*caret-pen/);
    expect(buttonClass(html, 'Done')).toContain('bg-hl');
    expect(buttonClass(html, 'Add words')).toContain('bg-hl');
    expect(buttonClass(html, 'Clear all')).toMatch(/sketch-border.*bg-paper/);
  });

  it('the Screen’s “everyone can see this” is a sticky note', () => {
    expect(panel(0, true)).toMatch(/<p class="[^"]*bg-sticky[^"]*">Everyone can see this screen/);
  });
});

describe('the players sheet (F63)', () => {
  it('is a dot-grid sheet with a hard shadow on a paper veil, Close a sketch button', () => {
    const html = renderToStaticMarkup(
      <PlayersDialog
        players={[player('a', 'Mika', true), player('b', 'Jun')]}
        title="Players"
        socket={socket}
        t={t}
        onClose={noop}
      />,
    );
    expect(html).toMatch(/^<div class="[^"]*bg-paper\/80/);
    expect(html).toMatch(
      /data-sheet="players" class="[^"]*border-ink bg-paper paper-dots[^"]*shadow-\[0\.8vmin_1vmin_0_var\(--color-ink\)\]/,
    );
    expect(buttonClass(html, 'Close')).toMatch(/sketch-border.*bg-hl/);
    expect(buttonClass(html, 'Give host crown')).toContain('border-ink bg-paper');
  });
});

describe('the restyled host files', () => {
  it('use only the sketchbook tokens: no hex, no white/NN, no display face, no dark wrapper', () => {
    for (const file of [
      './HostControls.tsx',
      './ScreenSettings.tsx',
      './PlayersDialog.tsx',
      './ScreenLobby.tsx',
      '../CustomWords.tsx',
      '../HostPlayerList.tsx',
      '../sketch/sheet.ts',
      '../phone/PhoneLobby.tsx',
      '../../pages/Screen.tsx',
    ]) {
      const src = read(file);
      expect(src, file).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
      expect(src, file).not.toMatch(/white\/\d|text-white|bg-white|bg-black|font-display/);
      expect(src, file).not.toContain('legacy-ink');
    }
    expect(read('../../index.css')).not.toContain('legacy-ink');
  });
});

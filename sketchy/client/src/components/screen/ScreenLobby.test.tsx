import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../shared/constants.js';
import type { ScreenView } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { ScreenLobby } from './ScreenLobby.js';
import { StartOverlay } from './StartOverlay.js';

// The lobby asks `usePointerCoarse` whether this Screen is a tablet or phone; a test sets it.
const pointer = vi.hoisted(() => ({ coarse: false }));
vi.mock('../../lib/usePointerCoarse.js', () => ({ usePointerCoarse: () => pointer.coarse }));

const t = translator('en');

const lobby = (host: boolean): ScreenView => ({
  role: 'screen',
  code: 'KPRW',
  phase: 'LOBBY',
  paused: null,
  rematchInMs: null,
  rematchFirst: null,
  gameNumber: 1,
  settings: DEFAULT_SETTINGS,
  players: [],
  turn: null,
  host: host ? { code: 'KPRW', customWordCount: 0 } : null,
  feed: [],
  almost: [],
  awards: [],
  gallery: [],
  tonight: null,
});

const render = (host = false) =>
  renderToStaticMarkup(<ScreenLobby view={lobby(host)} socket={{} as GameSocket} t={t} />);

describe('the lobby QR (F37)', () => {
  beforeEach(() => {
    pointer.coarse = false;
    vi.stubGlobal('window', {
      location: { host: 'sketchy.kimnejudne.dev', origin: 'https://sketchy.kimnejudne.dev' },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("links to /play/CODE on this Screen's own origin, on every Screen", () => {
    for (const host of [true, false]) {
      const html = render(host);
      expect(html).toContain('role="img" aria-label="Scan to join game KPRW"');
      expect(html).toContain('data-url="https://sketchy.kimnejudne.dev/play/KPRW"');
      // Dark modules on a white ground, quiet zone included in the viewBox (29 + 2 × 4).
      expect(html).toContain('viewBox="0 0 37 37"');
      expect(html).toMatch(/<path d="M4 4h1v1h-1z/);
    }
  });

  it('sits beside the code, before How to play', () => {
    const html = render();
    const qr = html.indexOf('Scan to join');
    expect(qr).toBeGreaterThan(html.indexOf('KPRW'));
    expect(html.indexOf('How to play')).toBeGreaterThan(qr);
  });
});

describe('"Keep this device plugged in" (F37)', () => {
  beforeEach(() =>
    vi.stubGlobal('window', { location: { host: 'sketchy.test', origin: 'https://sketchy.test' } }),
  );
  afterEach(() => vi.unstubAllGlobals());

  it('shows on a tablet or phone Screen (coarse pointer), token or not', () => {
    pointer.coarse = true;
    expect(render(true)).toContain('🔌 Keep this device plugged in');
    expect(render(false)).toContain('🔌 Keep this device plugged in');
  });

  it('does not show on a laptop on a TV', () => {
    pointer.coarse = false;
    expect(render(true)).not.toContain('plugged in');
  });
});

describe('the Tap to start overlay (F37)', () => {
  it('says Tap on a touch Screen and Click on a laptop, with what the tap turns on', () => {
    const tap = renderToStaticMarkup(<StartOverlay coarse onStart={() => {}} t={t} />);
    const click = renderToStaticMarkup(<StartOverlay coarse={false} onStart={() => {}} t={t} />);
    expect(tap).toContain('aria-label="Tap to start"');
    expect(tap).toContain('>Tap to start<');
    expect(click).toContain('>Click to start<');
    expect(tap).toContain('Turns on sound and fullscreen, and keeps the screen on');
  });

  it('is one full-screen modal button, so any tap, Enter or Space starts', () => {
    const html = renderToStaticMarkup(<StartOverlay coarse onStart={() => {}} t={t} />);
    expect(html).toMatch(/^<div role="dialog" aria-modal="true"[^>]*class="fixed inset-0 z-50"/);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toMatch(/<button type="button" autofocus="" class="flex size-full/);
  });
});

// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  GAME_ENDED_ERROR,
  PLAYER_PALETTE,
  ROOM_NOT_FOUND_ERROR,
  TITLE_CARD_MS,
} from '../../../shared/constants.js';
import type { RankedPlayer, ScreenView } from '../../../shared/types.js';
import { loadHostToken, saveHostToken } from '../lib/hostTokens.js';
import type { GameSocket } from '../lib/socket.js';
import { playSound, resetSounds, startSounds } from '../lib/sounds.js';
import { REORDER_DELAY_MS } from '../components/ScreenResults.js';
import { FX_MS } from '../lib/useRecentFx.js';
import { OFFLINE_AFTER_MS } from '../lib/useRoomSocket.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { buttonsWithoutHover } from '../test/hover.js';
import { Screen } from './Screen.js';

// Records the sounds instead of loading Howler.
vi.mock('../lib/sounds.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/sounds.js')>()),
  preloadSounds: vi.fn(),
  startSounds: vi.fn(() => Promise.resolve()),
  playSound: vi.fn(),
}));

// Renders the QR's encoded value, so tests can check where it points.
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title: string }) => (
    <svg data-testid="qr" data-value={value}>
      <title>{title}</title>
    </svg>
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  // Forgets the in-memory sound level, so one test's Quiet never carries into the next.
  resetSounds();
});

function player(n: number, overrides: Partial<RankedPlayer> = {}): RankedPlayer {
  return {
    id: `p${n}`,
    name: `Player ${n}`,
    color: PLAYER_PALETTE[n % PLAYER_PALETTE.length]!,
    score: 0,
    connected: true,
    rank: 1,
    ...overrides,
  };
}

function lobbyView(players: RankedPlayer[] = [], overrides: Partial<ScreenView> = {}): ScreenView {
  return {
    role: 'screen',
    code: 'WXYZ',
    title: 'Sample quiz',
    phase: 'LOBBY',
    questionIndex: -1,
    questionCount: 10,
    openingCounter: 0,
    players,
    winnerId: null,
    alsoBuzzed: [],
    lockedOut: [],
    falseStarts: [],
    showScoreboard: false,
    settings: DEFAULT_SETTINGS,
    canJudge: false,
    canUndo: false,
    scorerId: null,
    answerTimer: null,
    buzzTimer: null,
    question: null,
    nextImageId: null,
    category: null,
    difficulty: null,
    hostDevices: 0,
    ...overrides,
  };
}

/** Renders the Screen and, unless `start` is false, presses Click to start as a host would. */
function renderScreen(path = '/screen/WXYZ', { start = true } = {}) {
  const socket = new FakeSocket();
  const makeSocket = vi.fn(() => socket as unknown as GameSocket);
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/screen/:code" element={<Screen makeSocket={makeSocket} />} />
      </Routes>
    </MemoryRouter>,
  );
  if (start) fireEvent.click(screen.getByRole('button', { name: /Click to start/ }));
  return { socket, makeSocket, unmount: view.unmount };
}

const joinUrl = `${window.location.host}/play/WXYZ`;
/** The header's "Join at <url>" and room lines. */
const joinInfo = () => screen.getByRole('group', { name: 'How to join' });
/** The reveal's pill naming the player judged correct. */
const scorer = () => document.querySelector<HTMLElement>('[data-scorer]');
/** The palette-colour dot beside a player's name. */
const colourDot = (name: HTMLElement) => name.querySelector<HTMLElement>('[data-player-color]')!;

describe('Screen', () => {
  it('joins the room from the URL as a Screen', () => {
    const { socket } = renderScreen('/screen/wxyz');
    expect(socket.emitted).toHaveLength(1);
    expect(socket.emitted[0]).toMatchObject({ event: 'screen:join', payload: { code: 'WXYZ' } });
  });

  it('sends the stored hostToken when this device created the room', () => {
    const hostToken = 'h'.repeat(43);
    saveHostToken('WXYZ', hostToken);
    const { socket } = renderScreen();
    expect(socket.emitted[0]?.payload).toEqual({ code: 'WXYZ', hostToken });
  });

  it('drops a stale hostToken and joins as a plain Screen when the server rejects it', () => {
    saveHostToken('WXYZ', 's'.repeat(43));
    const { socket } = renderScreen();
    act(() => socket.emitted[0]!.ack({ ok: false, error: 'Invalid host token' }));
    expect(socket.emitted[1]).toMatchObject({ event: 'screen:join', payload: { code: 'WXYZ' } });
    expect(socket.emitted[1]!.payload).not.toHaveProperty('hostToken');
    expect(loadHostToken('WXYZ')).toBeNull();
    socket.fire('state', lobbyView());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('WXYZ');
  });

  it('joins again after a reconnect', () => {
    const { socket } = renderScreen();
    socket.fire('connect');
    expect(socket.emitted.map((e) => e.event)).toEqual(['screen:join', 'screen:join']);
  });

  it('shows Connecting until the first state arrives', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Connecting…');
  });

  it('lobby shows the huge code, the join URL and a QR to /play/<CODE>', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('WXYZ');
    const main = screen.getByRole('main');
    expect(within(main).getAllByText(joinUrl).length).toBeGreaterThan(0);
    expect(screen.getByTitle(`Join at http://${joinUrl}`)).toBeTruthy();
    expect(screen.getByText('Waiting for players…')).toBeTruthy();
  });

  describe('join address', () => {
    function stubConfig(joinOrigin: string | null) {
      const fetch = vi.fn(() => Promise.resolve(Response.json({ joinOrigin })));
      vi.stubGlobal('fetch', fetch);
      return fetch;
    }

    afterEach(() => vi.unstubAllGlobals());

    it('warns that phones cannot open a localhost join URL when the server has no address', async () => {
      const fetch = stubConfig(null);
      const { socket } = renderScreen();
      socket.fire('state', lobbyView());
      expect((await screen.findByRole('note')).textContent).toContain(
        'Phones can’t open localhost',
      );
      expect(fetch).toHaveBeenCalledWith('/api/config');
    });

    it('shows no warning before the server has answered', () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise(() => {})),
      );
      const { socket } = renderScreen();
      socket.fire('state', lobbyView());
      expect(screen.queryByRole('note')).toBeNull();
    });

    it("uses the server's LAN address with the page's port for the QR, the URL and the header", async () => {
      stubConfig('http://192.168.1.20');
      const { socket } = renderScreen();
      socket.fire('state', lobbyView());
      const lan = `192.168.1.20:${window.location.port}/play/WXYZ`;
      expect(await screen.findByTitle(`Join at http://${lan}`)).toBeTruthy();
      expect(within(screen.getByRole('main')).getAllByText(lan)).toHaveLength(1);
      expect(screen.queryByRole('note')).toBeNull();
      socket.fire('state', lobbyView([], { phase: 'REVEAL', questionIndex: 1 }));
      expect(joinInfo().textContent).toBe(`Join at ${lan}Room WXYZ`);
    });

    it('uses PUBLIC_URL as it is', async () => {
      stubConfig('https://buzzr.example');
      const { socket } = renderScreen();
      socket.fire('state', lobbyView());
      expect(await screen.findByTitle('Join at https://buzzr.example/play/WXYZ')).toBeTruthy();
      expect(screen.queryByRole('note')).toBeNull();
      socket.fire('state', lobbyView([], { phase: 'REVEAL', questionIndex: 1 }));
      expect(joinInfo().textContent).toBe('Join at buzzr.example/play/WXYZRoom WXYZ');
    });
  });

  it('player chips appear live, in each player’s colour', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView([player(1)]));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Player 1']);

    socket.fire('state', lobbyView([player(1), player(2)]));
    const chips = screen.getAllByRole('listitem');
    expect(chips.map((li) => li.textContent)).toEqual(['Player 1', 'Player 2']);
    expect(chips[1]!.style.backgroundColor).not.toBe('');
    expect(chips[0]!.style.backgroundColor).not.toBe(chips[1]!.style.backgroundColor);
    expect(screen.getByText('2 players')).toBeTruthy();
  });

  it('a test buzz pops that player’s chip, and each new test buzz replays the pop', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView([player(1), player(2)]));
    const chip = (name: string) => screen.getByText(name);
    expect(chip('Player 1').className).toContain('motion-safe:animate-pop-in');

    socket.fire('fx', { kind: 'practice', playerId: 'p2' });
    const first = chip('Player 2');
    expect(first.className).toContain('motion-safe:animate-chip-bump');
    expect(chip('Player 1').className).not.toContain('animate-chip-bump');

    socket.fire('fx', { kind: 'practice', playerId: 'p1' });
    socket.fire('fx', { kind: 'practice', playerId: 'p2' });
    // A new element, so the browser runs the bump again; Player 1's bump is not cut short.
    expect(chip('Player 2')).not.toBe(first);
    expect(chip('Player 2').className).toContain('motion-safe:animate-chip-bump');
    expect(chip('Player 1').className).toContain('motion-safe:animate-chip-bump');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Player 1',
      'Player 2',
    ]);
  });

  it('a disconnected player keeps their chip, greyed out, and it returns to full strength on reconnect', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView([player(1), player(2, { connected: false })]));
    let chips = screen.getAllByRole('listitem');
    expect(chips.map((li) => li.textContent)).toEqual(['Player 1', 'Player 2']);
    expect(chips[0]!.className).not.toContain('opacity-40');
    expect(chips[1]!.className).toContain('opacity-40');

    socket.fire('state', lobbyView([player(1), player(2)]));
    chips = screen.getAllByRole('listitem');
    expect(chips[1]!.className).not.toContain('opacity-40');
  });

  it('the scoreboard keeps a disconnected player, greyed out', () => {
    const { socket } = renderScreen();
    socket.fire(
      'state',
      lobbyView([player(1), player(2, { connected: false })], {
        phase: 'REVEAL',
        questionIndex: 0,
        showScoreboard: true,
      }),
    );
    const rows = within(screen.getByRole('region', { name: 'Scoreboard' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.className.includes('opacity-40'))).toEqual([false, true]);
  });

  it('the lobby shows the join address once, in its QR block, not in the header', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView());
    expect(screen.queryByRole('group', { name: 'How to join' })).toBeNull();
    expect(within(screen.getByRole('banner')).queryByText(joinUrl)).toBeNull();
    expect(within(screen.getByRole('main')).getAllByText(joinUrl)).toHaveLength(1);
    expect(screen.getByTitle(`Join at http://${joinUrl}`)).toBeTruthy();
  });

  it('the header shows "Join at <url>" and the room code once the game is on', () => {
    const { socket } = renderScreen();
    for (const phase of ['QUESTION', 'OPEN', 'REVEAL', 'FINAL'] as const) {
      socket.fire('state', lobbyView([], { phase, questionIndex: 1 }));
      expect(joinInfo().textContent).toBe(`Join at ${joinUrl}Room WXYZ`);
    }
  });

  it('frames every state with a marquee bulb rail at the top and the bottom', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView());
    const main = screen.getByRole('main');
    const rails = main.querySelectorAll(':scope > [data-bulbs="rail"]');
    expect(rails).toHaveLength(2);
    expect(main.firstElementChild).toBe(rails[0]);
    expect(main.querySelector(':scope > header')?.previousElementSibling).toBe(rails[0]);
  });

  it('shows the join error, such as an unknown room, with a link home', () => {
    const { socket } = renderScreen();
    act(() => socket.emitted[0]!.ack({ ok: false, error: 'Room not found' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Room not found');
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
  });

  it('with a stored hostToken, a room the server no longer has shows "This game has ended"', () => {
    saveHostToken('WXYZ', 'h'.repeat(43));
    const { socket } = renderScreen();
    act(() => socket.emitted[0]!.ack({ ok: false, error: ROOM_NOT_FOUND_ERROR }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(GAME_ENDED_ERROR);
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
  });

  it('a reconnect refused with "Room not found" after a snapshot (server restart) shows "This game has ended"', () => {
    const { socket } = renderScreen();
    act(() => socket.emitted[0]!.ack({ ok: true }));
    socket.fire('state', lobbyView([], { phase: 'QUESTION', questionIndex: 0 }));
    socket.fire('connect');
    act(() => socket.emitted.at(-1)!.ack({ ok: false, error: ROOM_NOT_FOUND_ERROR }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(GAME_ENDED_ERROR);
  });

  it('room:closed (the room expired) shows "This game has ended" with a link home', () => {
    const { socket } = renderScreen();
    act(() => socket.emitted[0]!.ack({ ok: true }));
    socket.fire('state', lobbyView());
    socket.fire('room:closed', { reason: 'expired' });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(GAME_ENDED_ERROR);
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
  });

  it('a malformed code shows Room not found without connecting', () => {
    const { makeSocket } = renderScreen('/screen/AB1', { start: false });
    expect(makeSocket).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Room not found');
  });

  it('shows a Reconnecting banner over the last snapshot after 5 s down, and drops it on reconnect', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView([player(1)]));
    const banner = () => screen.queryByText('Reconnecting…');
    expect(banner()).toBeNull();

    vi.useFakeTimers();
    try {
      socket.fire('disconnect', 'transport close');
      act(() => vi.advanceTimersByTime(OFFLINE_AFTER_MS - 1));
      expect(banner()).toBeNull();
      act(() => vi.advanceTimersByTime(1));
      expect(banner()!.getAttribute('role')).toBe('status');
      // The last snapshot stays underneath.
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('WXYZ');
      expect(screen.getByText('Player 1')).toBeTruthy();

      socket.fire('connect');
      expect(banner()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('disconnects when the page closes', () => {
    const { socket, unmount } = renderScreen();
    unmount();
    expect(socket.disconnected).toBe(true);
  });

  describe('Pair host phone', () => {
    const hostToken = 'h'.repeat(43);
    const dialog = () => screen.queryByRole('dialog', { name: 'Pair host phone' });
    const openPairing = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Pair host phone' }));
    const hostEvents = (socket: FakeSocket) =>
      socket.emitted.filter((e) => e.event.startsWith('host:')).map((e) => e.event);

    function lobbyWithToken(players: RankedPlayer[] = []) {
      saveHostToken('WXYZ', hostToken);
      const { socket } = renderScreen();
      act(() => socket.emitted[0]!.ack({ ok: true }));
      socket.fire('state', lobbyView(players));
      return socket;
    }

    it('is offered only on a Screen that holds the hostToken', () => {
      const { socket } = renderScreen();
      socket.fire('state', lobbyView());
      expect(screen.queryByRole('button', { name: 'Pair host phone' })).toBeNull();
      cleanup();

      lobbyWithToken();
      expect(screen.getByRole('button', { name: 'Pair host phone' })).toBeTruthy();
    });

    it('opens a modal dialog over the lobby with a QR to /host/<CODE>#t=<hostToken>', () => {
      lobbyWithToken([player(1), player(2)]);
      openPairing();
      const pairing = dialog()!;
      expect(pairing.getAttribute('aria-modal')).toBe('true');
      expect(within(pairing).getByTestId('qr').dataset.value).toBe(
        `${window.location.origin}/host/WXYZ#t=${hostToken}`,
      );
      expect(within(pairing).getByText('Hides in 60 s')).toBeTruthy();
      // The token is only inside the QR, never printed as text.
      expect(pairing.textContent).not.toContain(hostToken);
      // Over the lobby, not inside it: the code, the join QR and the chips are all still there.
      expect(within(screen.getByRole('main')).queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('WXYZ');
      expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Player 1',
        'Player 2',
      ]);
    });

    it('hides the QR after 60 seconds', () => {
      vi.useFakeTimers();
      lobbyWithToken();
      openPairing();
      act(() => vi.advanceTimersByTime(59_000));
      expect(within(dialog()!).getByText('Hides in 1 s')).toBeTruthy();

      act(() => vi.advanceTimersByTime(1_000));
      expect(dialog()).toBeNull();
      for (const qr of screen.getAllByTestId('qr')) expect(qr.dataset.value).not.toContain('#t=');
      expect(screen.getByRole('button', { name: 'Pair host phone' })).toBeTruthy();
    });

    it('hides the QR on time even when the browser throttles its timer', () => {
      vi.useFakeTimers();
      lobbyWithToken();
      openPairing();
      // A background tab: 60 s pass on the clock, but the timer fires only once.
      vi.setSystemTime(Date.now() + 60_000);
      act(() => vi.advanceTimersByTime(1_000));
      expect(dialog()).toBeNull();
    });

    it('Hide closes the dialog early', () => {
      lobbyWithToken();
      openPairing();
      fireEvent.click(within(dialog()!).getByRole('button', { name: 'Hide' }));
      expect(dialog()).toBeNull();
    });

    it('Esc closes the dialog without starting the game', () => {
      const socket = lobbyWithToken([player(1)]);
      openPairing();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(dialog()).toBeNull();
      expect(hostEvents(socket)).toEqual([]);
    });

    it('closes as soon as a host phone joins', () => {
      const socket = lobbyWithToken();
      openPairing();
      socket.fire('host:paired', {});
      expect(dialog()).toBeNull();
      // Opening it again works, and the next join closes it again.
      openPairing();
      expect(dialog()).not.toBeNull();
      socket.fire('host:paired', {});
      expect(dialog()).toBeNull();
    });

    it('Space still starts the game with the dialog open', () => {
      const socket = lobbyWithToken([player(1)]);
      openPairing();
      fireEvent.keyDown(window, { key: ' ' });
      expect(hostEvents(socket)).toEqual(['host:start']);
    });

    it("links to the server's LAN address, as the join QR does, when the Screen is on localhost", async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(Response.json({ joinOrigin: 'http://192.168.1.20' }))),
      );
      try {
        lobbyWithToken();
        const lan = `http://192.168.1.20:${window.location.port}`;
        await screen.findByTitle(`Join at ${lan}/play/WXYZ`);
        openPairing();
        expect(within(dialog()!).getByTestId('qr').dataset.value).toBe(
          `${lan}/host/WXYZ#t=${hostToken}`,
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('the lobby buttons and the dialog have the mouse hover', () => {
      lobbyWithToken([player(1)]);
      expect(buttonsWithoutHover(screen.getByRole('main'))).toEqual([]);
      openPairing();
      expect(buttonsWithoutHover(dialog()!)).toEqual([]);
    });
  });

  describe('question and buzz views', () => {
    const ANSWER = 'Canberra-secret-answer';
    const ana = player(1, { name: 'Ana' });
    const ben = player(2, { name: 'Ben' });
    const cy = player(3, { name: 'Cy' });

    function questionView(overrides: Partial<ScreenView> = {}): ScreenView {
      return lobbyView([ana, ben, cy], {
        phase: 'QUESTION',
        questionIndex: 2,
        question: { id: 'q3', text: 'What is the capital of Australia?', points: 100 },
        ...overrides,
      });
    }

    function show(view: ScreenView) {
      const { socket } = renderScreen();
      socket.fire('state', view);
      return socket;
    }

    it('shows "Question N / M" in the header pill and the question text', () => {
      show(questionView());
      expect(within(screen.getByRole('banner')).getByText('Question 3 / 10')).toBeTruthy();
      expect(
        screen.getByRole('heading', { level: 1, name: 'What is the capital of Australia?' }),
      ).toBeTruthy();
    });

    it('shows "Buzzers locked" until the buzzers open, then "Buzzers OPEN" in another colour', () => {
      const socket = show(questionView());
      const locked = screen.getByRole('status');
      expect(locked.textContent).toBe('Buzzers locked');
      const lockedClass = locked.className;

      socket.fire('state', questionView({ phase: 'OPEN', openingCounter: 1 }));
      const open = screen.getByRole('status');
      expect(open.textContent).toBe('Buzzers OPEN');
      expect(open.className).toContain('bg-buzz');
      expect(lockedClass).not.toContain('bg-buzz');
    });

    it('keeps "Buzzers OPEN" through the collection window', () => {
      show(questionView({ phase: 'COLLECTING', openingCounter: 1 }));
      expect(screen.getByRole('status').textContent).toBe('Buzzers OPEN');
    });

    it('shows the question image, contained and never cropped', () => {
      show(
        questionView({
          question: { id: 'q3', text: 'Who is this?', imageId: 'img-1', points: 100 },
        }),
      );
      const img = screen.getByRole('img', { name: 'Question image' });
      expect(img.getAttribute('src')).toBe('/api/rooms/WXYZ/images/img-1');
      expect(img.className).toContain('object-contain');
    });

    it('shows an image-only question without a text block', () => {
      show(questionView({ question: { id: 'q3', text: '', imageId: 'img-1', points: 100 } }));
      expect(screen.getByRole('img', { name: 'Question 3' })).toBeTruthy();
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    });

    it("preloads the next question's image, without showing it", () => {
      const loaded: string[] = [];
      vi.stubGlobal(
        'Image',
        class {
          set src(url: string) {
            loaded.push(url);
          }
        },
      );
      const socket = show(questionView({ nextImageId: 'img-4' }));
      expect(loaded).toEqual(['/api/rooms/WXYZ/images/img-4']);
      expect(screen.queryByRole('img')).toBeNull();
      socket.fire(
        'state',
        questionView({ phase: 'OPEN', openingCounter: 1, nextImageId: 'img-4' }),
      );
      expect(loaded).toHaveLength(1);
      vi.unstubAllGlobals();
    });

    it('shrinks long question text', () => {
      // The text row carries the size step; the heading inherits it (F52).
      const sizeClass = () => screen.getByRole('heading', { level: 1 }).parentElement!.className;
      const socket = show(questionView());
      const shortClass = sizeClass();
      socket.fire(
        'state',
        questionView({ question: { id: 'q3', text: 'Why '.repeat(60).trim() + '?', points: 100 } }),
      );
      expect(sizeClass()).not.toBe(shortClass);
    });

    it('fits the text row by measurement, so the reveal never clips the question (F52)', () => {
      show(questionView());
      // jsdom has no layout: everything "fits", so the row gets its class size inline.
      const row = screen.getByRole('heading', { level: 1 }).parentElement!;
      expect(row.style.fontSize).toBe('16px');
      expect(row.className).toContain('overflow-hidden');
    });

    it('shows the winner on the red first-to-buzz panel with their colour dot, in place of the status', () => {
      show(questionView({ phase: 'BUZZED', openingCounter: 1, winnerId: 'p2' }));
      const panel = screen.getByRole('region', { name: 'Buzz result' });
      expect(panel.className).toContain('bg-buzz');
      expect(within(panel).getByText('First to buzz')).toBeTruthy();
      const banner = within(panel).getByRole('heading', { level: 2, name: 'Ben' });
      const probe = document.createElement('div');
      probe.style.backgroundColor = ben.color;
      expect(colourDot(banner).style.backgroundColor).toBe(probe.style.backgroundColor);
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('lists the other buzzes in rank order with their gaps', () => {
      show(
        questionView({
          phase: 'BUZZED',
          openingCounter: 1,
          winnerId: 'p2',
          alsoBuzzed: [
            { playerId: 'p3', gapMs: 120 },
            { playerId: 'p1', gapMs: 1_480.6 },
          ],
        }),
      );
      const items = within(screen.getByRole('list', { name: 'Also buzzed' })).getAllByRole(
        'listitem',
      );
      expect(items.map((li) => li.textContent)).toEqual(['Cy+0.12 s', 'Ana+1.48 s']);
    });

    it('shows no "also buzzed" line when only the winner buzzed', () => {
      show(questionView({ phase: 'BUZZED', openingCounter: 1, winnerId: 'p2' }));
      expect(screen.queryByText('also buzzed')).toBeNull();
    });

    it('never puts the answer in the DOM before REVEAL, even if a view carries it', () => {
      const question = { id: 'q3', text: 'Capital?', points: 100, answer: ANSWER };
      for (const phase of ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED'] as const) {
        show(questionView({ phase, question, winnerId: phase === 'BUZZED' ? 'p2' : null }));
        expect(document.body.innerHTML).not.toContain(ANSWER);
        cleanup();
      }
    });
  });

  describe('host controls', () => {
    const hostToken = 'h'.repeat(43);
    const ANSWER = 'Canberra-secret-answer';
    const question = { id: 'q3', text: 'Capital?', points: 100 };

    function inPhase(phase: ScreenView['phase'], overrides: Partial<ScreenView> = {}) {
      return lobbyView([player(1)], {
        phase,
        questionIndex: phase === 'LOBBY' ? -1 : 2,
        question: phase === 'LOBBY' || phase === 'FINAL' ? null : question,
        ...overrides,
      });
    }

    /** A Screen whose hostToken the server accepted, showing `view`. */
    function hostScreen(view: ScreenView = inPhase('LOBBY')) {
      saveHostToken('WXYZ', hostToken);
      const { socket } = renderScreen();
      act(() => socket.emitted[0]!.ack({ ok: true }));
      socket.fire('state', view);
      return socket;
    }

    const bar = () => screen.queryByRole('toolbar', { name: 'Host controls' });
    const press = (key: string, init: KeyboardEventInit = {}) =>
      fireEvent.keyDown(window, { key, ...init });
    const sent = (socket: FakeSocket) =>
      socket.emitted.filter((e) => e.event.startsWith('host:')).map((e) => [e.event, e.payload]);

    it('the bar appears only when the server accepted this device’s hostToken', () => {
      const { socket } = renderScreen();
      socket.fire('state', inPhase('OPEN'));
      expect(bar()).toBeNull();
      cleanup();

      saveHostToken('WXYZ', 's'.repeat(43));
      const stale = renderScreen().socket;
      act(() => stale.emitted[0]!.ack({ ok: false, error: 'Invalid host token' }));
      act(() => stale.emitted[1]!.ack({ ok: true }));
      stale.fire('state', inPhase('OPEN'));
      expect(bar()).toBeNull();
      cleanup();

      hostScreen(inPhase('OPEN'));
      expect(bar()).toBeTruthy();
    });

    it('a Screen without the hostToken ignores the shortcuts', () => {
      const { socket } = renderScreen();
      socket.fire('state', inPhase('LOBBY'));
      for (const key of [' ', 's', '?']) press(key);
      expect(sent(socket)).toEqual([]);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('the bar hides after 3 s without mouse movement and comes back when the mouse moves', () => {
      vi.useFakeTimers();
      hostScreen(inPhase('OPEN'));
      act(() => vi.advanceTimersByTime(2_999));
      expect(bar()).toBeTruthy();
      act(() => vi.advanceTimersByTime(1));
      expect(bar()).toBeNull();

      fireEvent.pointerMove(window);
      expect(bar()).toBeTruthy();
      act(() => vi.advanceTimersByTime(2_000));
      fireEvent.pointerMove(window);
      act(() => vi.advanceTimersByTime(2_000));
      expect(bar()).toBeTruthy();
    });

    it('the bar stays up while the mouse rests on it', () => {
      vi.useFakeTimers();
      hostScreen(inPhase('OPEN'));
      fireEvent.pointerEnter(bar()!);
      act(() => vi.advanceTimersByTime(10_000));
      expect(bar()).toBeTruthy();
      fireEvent.pointerLeave(bar()!);
      expect(bar()).toBeNull();
    });

    it('H hides the bar, mouse movement then offers it back, and H shows it again', () => {
      vi.useFakeTimers();
      hostScreen(inPhase('OPEN'));
      press('h');
      expect(bar()).toBeNull();
      fireEvent.pointerMove(window);
      expect(bar()).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Show controls' }));
      expect(bar()).toBeTruthy();

      act(() => vi.advanceTimersByTime(3_000));
      expect(bar()).toBeNull();
      press('H');
      expect(bar()).toBeTruthy();
    });

    it('every bar button, the shortcuts sheet and Show controls have the hover style', () => {
      hostScreen(inPhase('BUZZED', { winnerId: 'p1', canJudge: true }));
      expect(screen.getByRole('button', { name: 'Undo' })).toHaveProperty('disabled', true);
      expect(buttonsWithoutHover(bar()!)).toEqual([]);
      fireEvent.click(screen.getByRole('button', { name: 'Shortcuts' }));
      expect(
        buttonsWithoutHover(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })),
      ).toEqual([]);
      press('Escape');
      press('h');
      fireEvent.pointerMove(window);
      expect(buttonsWithoutHover()).toEqual([]);
      expect(screen.getByRole('button', { name: 'Show controls' })).toBeTruthy();
    });

    it('Hide controls collapses the bar even while the mouse is on it', () => {
      hostScreen(inPhase('OPEN'));
      fireEvent.pointerEnter(bar()!);
      fireEvent.click(screen.getByRole('button', { name: 'Hide controls' }));
      expect(bar()).toBeNull();
      press('h');
      fireEvent.pointerMove(window);
      expect(bar()).toBeTruthy();
    });

    it('? shows the shortcut help and Escape closes it', () => {
      hostScreen(inPhase('OPEN'));
      press('?', { shiftKey: true });
      const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
      expect(within(help).getByText('Toggle fullscreen')).toBeTruthy();
      expect(within(help).getByText('N or →')).toBeTruthy();
      press('Escape');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('the bar’s sound button and M cycle Sound on, Quiet and Muted, kept on this device', () => {
      const socket = hostScreen(inPhase('OPEN'));
      const sound = () => within(bar()!).getByRole('button', { name: /^(Sound on|Quiet|Muted)$/ });
      expect(sound().textContent).toBe('Sound onM');
      expect(sound().getAttribute('aria-keyshortcuts')).toBe('M');
      fireEvent.click(sound());
      expect(sound().textContent).toBe('QuietM');
      press('m');
      expect(sound().textContent).toBe('MutedM');
      expect(localStorage.getItem('buzzr:soundLevel')).toBe('muted');
      press('M', { shiftKey: true });
      expect(sound().textContent).toBe('Sound onM');
      expect(sent(socket)).toEqual([]);
    });

    it('the bar shows the level this device chose before', () => {
      localStorage.setItem('buzzr:soundLevel', 'quiet');
      hostScreen(inPhase('OPEN'));
      expect(within(bar()!).getByRole('button', { name: 'Quiet' })).toBeTruthy();
    });

    it('the ? help lists M for the sound level', () => {
      hostScreen(inPhase('OPEN'));
      press('?', { shiftKey: true });
      const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
      expect(within(help).getByText('M')).toBeTruthy();
      expect(within(help).getByText('Sound on / Quiet / Muted')).toBeTruthy();
    });

    it('a host Screen’s lobby has one sound button, on the bar', () => {
      hostScreen(inPhase('LOBBY'));
      expect(screen.getAllByRole('button', { name: 'Sound on' })).toHaveLength(1);
      expect(within(bar()!).getByRole('button', { name: 'Sound on' })).toBeTruthy();
    });

    it('a token-less Screen has the sound button in its lobby, and M cycles it', () => {
      const { socket } = renderScreen();
      socket.fire('state', inPhase('LOBBY'));
      expect(bar()).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Sound on' }));
      expect(screen.getByRole('button', { name: 'Quiet' })).toBeTruthy();
      press('m');
      expect(screen.getByRole('button', { name: 'Muted' })).toBeTruthy();
      expect(localStorage.getItem('buzzr:soundLevel')).toBe('muted');
      expect(sent(socket)).toEqual([]);
    });

    it('a token-less Screen keeps M during the game, with no button over the question', () => {
      const { socket } = renderScreen();
      socket.fire('state', inPhase('OPEN'));
      expect(screen.queryByRole('button', { name: 'Sound on' })).toBeNull();
      press('m');
      expect(localStorage.getItem('buzzr:soundLevel')).toBe('quiet');
      press('m', { ctrlKey: true });
      expect(localStorage.getItem('buzzr:soundLevel')).toBe('quiet');
    });

    it.each([
      ['Space in the lobby', ' ', inPhase('LOBBY'), ['host:start', {}]],
      ['Space on a question', ' ', inPhase('QUESTION'), ['host:open', {}]],
      ['Space with the buzzers open', ' ', inPhase('OPEN'), ['host:reveal', {}]],
      ['Space after reveal', ' ', inPhase('REVEAL'), ['host:next', {}]],
      [
        'C',
        'c',
        inPhase('BUZZED', { winnerId: 'p1', canJudge: true }),
        ['host:judge', { result: 'correct' }],
      ],
      [
        'V',
        'v',
        inPhase('BUZZED', { winnerId: 'p1', canJudge: true }),
        ['host:judge', { result: 'half' }],
      ],
      [
        'X',
        'x',
        inPhase('BUZZED', { winnerId: 'p1', canJudge: true }),
        ['host:judge', { result: 'wrong' }],
      ],
      ['R', 'r', inPhase('BUZZED', { winnerId: 'p1', canJudge: true }), ['host:reveal', {}]],
      ['N', 'n', inPhase('REVEAL'), ['host:next', {}]],
      ['→', 'ArrowRight', inPhase('REVEAL'), ['host:next', {}]],
      ['←', 'ArrowLeft', inPhase('OPEN'), ['host:prev', {}]],
      ['S', 's', inPhase('REVEAL'), ['host:scoreboard', { show: true }]],
      ['U', 'u', inPhase('REVEAL', { canUndo: true }), ['host:undo', {}]],
    ] as const)('%s sends the matching host event', (_name, key, view, expected) => {
      const socket = hostScreen(view);
      press(key);
      expect(sent(socket)).toEqual([expected]);
    });

    it('ignores shortcuts with Ctrl, Cmd or Alt held, and key repeats', () => {
      const socket = hostScreen(inPhase('REVEAL'));
      press('s', { ctrlKey: true });
      press('s', { metaKey: true });
      press('ArrowRight', { altKey: true });
      press('s', { repeat: true });
      expect(sent(socket)).toEqual([]);
    });

    it('a second key press waits for the next snapshot, like the remote', () => {
      const socket = hostScreen(inPhase('QUESTION'));
      press(' ');
      act(() => socket.emitted.at(-1)!.ack({ ok: true }));
      press(' ');
      expect(sent(socket)).toEqual([['host:open', {}]]);
      socket.fire('state', inPhase('OPEN', { openingCounter: 1 }));
      press(' ');
      expect(sent(socket).at(-1)).toEqual(['host:reveal', {}]);
    });

    it('a rejected action shows the server’s message', () => {
      const socket = hostScreen(inPhase('LOBBY', { players: [] }));
      press(' ');
      act(() =>
        socket.emitted.at(-1)!.ack({ ok: false, error: 'Wait for at least one player to join' }),
      );
      expect(screen.getByRole('alert').textContent).toBe('Wait for at least one player to join');
    });

    it('the bar’s buttons send the same actions, and judging replaces the primary action', () => {
      const socket = hostScreen(inPhase('BUZZED', { winnerId: 'p1', canJudge: true }));
      const controls = within(bar()!);
      expect(controls.queryByRole('button', { name: 'Reveal answer' })).toBeNull();
      fireEvent.click(controls.getByRole('button', { name: 'Wrong' }));
      expect(sent(socket)).toEqual([['host:judge', { result: 'wrong' }]]);
    });

    it('the bar shows Half, with its V key, between Correct and Wrong', () => {
      const socket = hostScreen(inPhase('BUZZED', { winnerId: 'p1', canJudge: true }));
      const half = within(bar()!).getByRole('button', { name: 'Half' });
      expect(half.getAttribute('aria-keyshortcuts')).toBe('V');
      const labels = [...half.parentElement!.querySelectorAll('button')].map((b) => b.textContent);
      expect(labels.slice(labels.indexOf('CorrectC'), labels.indexOf('WrongX') + 1)).toEqual([
        'CorrectC',
        'HalfV',
        'WrongX',
      ]);
      fireEvent.click(half);
      expect(sent(socket)).toEqual([['host:judge', { result: 'half' }]]);
    });

    it('End game needs a second click', () => {
      const socket = hostScreen(inPhase('OPEN'));
      fireEvent.click(screen.getByRole('button', { name: 'End game' }));
      expect(sent(socket)).toEqual([]);
      fireEvent.click(screen.getByRole('button', { name: 'Confirm end' }));
      expect(sent(socket)).toEqual([['host:end', {}]]);
    });

    it('F enters fullscreen, and leaves it when already fullscreen', () => {
      const request = vi.fn(() => Promise.resolve());
      const exit = vi.fn(() => Promise.resolve());
      document.documentElement.requestFullscreen = request;
      document.exitFullscreen = exit;
      hostScreen(inPhase('OPEN'));
      // Click to start already entered fullscreen once.
      request.mockClear();
      press('f');
      expect(request).toHaveBeenCalledOnce();

      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => document.documentElement,
      });
      press('F');
      expect(exit).toHaveBeenCalledOnce();
      Reflect.deleteProperty(document, 'fullscreenElement');
    });

    describe('new game', () => {
      const newGame = () => screen.queryByRole('button', { name: 'New game' });

      it('in FINAL the bar offers New game, which opens the picker over the results', () => {
        hostScreen(inPhase('FINAL'));
        expect(screen.queryByRole('dialog', { name: 'New game' })).toBeNull();
        fireEvent.click(newGame()!);
        const picker = screen.getByRole('dialog', { name: 'New game' });
        expect(within(picker).getByRole('checkbox', { name: 'Keep scores' })).toBeTruthy();
        // The bar and its shortcuts are off under the picker.
        expect(bar()).toBeNull();
        expect(screen.getByRole('region', { name: 'Podium' })).toBeTruthy();
        fireEvent.click(within(picker).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog', { name: 'New game' })).toBeNull();
        expect(bar()).toBeTruthy();
      });

      it('its picker offers no Preview: the Screen is public and a preview shows answers', async () => {
        hostScreen(inPhase('FINAL'));
        fireEvent.click(newGame()!);
        const picker = screen.getByRole('dialog', { name: 'New game' });
        expect((await within(picker).findAllByRole('radio')).length).toBeGreaterThan(0);
        expect(within(picker).queryAllByRole('button', { name: /^Preview/ })).toEqual([]);
      });

      it('its picker offers no Build a game: that is on the host remote', async () => {
        hostScreen(inPhase('FINAL'));
        fireEvent.click(newGame()!);
        const picker = screen.getByRole('dialog', { name: 'New game' });
        expect((await within(picker).findAllByRole('radio')).length).toBeGreaterThan(0);
        expect(within(picker).queryByRole('button', { name: 'Build a game' })).toBeNull();
      });

      it('is not offered before FINAL', () => {
        for (const phase of ['LOBBY', 'QUESTION', 'OPEN', 'BUZZED', 'REVEAL'] as const) {
          hostScreen(inPhase(phase));
          expect(bar()).toBeTruthy();
          expect(newGame()).toBeNull();
          cleanup();
          localStorage.clear();
        }
      });

      it('is never offered on a Screen without the hostToken', () => {
        const { socket } = renderScreen();
        socket.fire('state', inPhase('FINAL'));
        expect(screen.getByRole('region', { name: 'Podium' })).toBeTruthy();
        expect(newGame()).toBeNull();
      });
    });

    describe('lobby settings', () => {
      const setup = () => screen.queryByRole('complementary', { name: 'Game setup' });

      it('show beside Start game only on a Screen whose hostToken the server accepted', () => {
        const { socket } = renderScreen();
        socket.fire('state', inPhase('LOBBY'));
        expect(setup()).toBeNull();
        expect(screen.queryByRole('switch')).toBeNull();
        cleanup();

        saveHostToken('WXYZ', 's'.repeat(43));
        const stale = renderScreen().socket;
        act(() => stale.emitted[0]!.ack({ ok: false, error: 'Invalid host token' }));
        act(() => stale.emitted[1]!.ack({ ok: true }));
        stale.fire('state', inPhase('LOBBY'));
        expect(setup()).toBeNull();
        cleanup();

        hostScreen();
        const panel = within(setup()!);
        expect(panel.getByRole('button', { name: /Start game/ })).toBeTruthy();
        for (const name of ['Auto-open buzzers', 'Wrong-answer penalty']) {
          expect(panel.getByRole('switch', { name: new RegExp(name) })).toBeTruthy();
        }
        expect(panel.getByRole('status', { name: 'Answer time' }).textContent).toBe('Off');
        expect(panel.getByRole('status', { name: 'Scoreboard every' }).textContent).toBe('5');
      });

      it('leave the Screen once the game starts', () => {
        const socket = hostScreen();
        socket.fire('state', inPhase('QUESTION'));
        expect(setup()).toBeNull();
      });

      it('a toggle and the answer-time stepper send host:settings with only that key', () => {
        const socket = hostScreen();
        fireEvent.click(screen.getByRole('switch', { name: /Auto-open buzzers/ }));
        expect(sent(socket)).toEqual([['host:settings', { autoOpenBuzzers: true }]]);

        act(() => socket.emitted.at(-1)!.ack({ ok: true }));
        socket.fire(
          'state',
          inPhase('LOBBY', { settings: { ...DEFAULT_SETTINGS, autoOpenBuzzers: true } }),
        );
        expect(
          screen.getByRole('switch', { name: /Auto-open buzzers/ }).getAttribute('aria-checked'),
        ).toBe('true');
        fireEvent.click(screen.getByRole('button', { name: 'More answer time' }));
        expect(sent(socket).at(-1)).toEqual(['host:settings', { answerSeconds: 3 }]);
      });

      it('a refused change shows the Screen’s toast', () => {
        const socket = hostScreen();
        fireEvent.click(screen.getByRole('switch', { name: /Wrong-answer penalty/ }));
        act(() => socket.emitted.at(-1)!.ack({ ok: false, error: 'Not connected' }));
        expect(screen.getByRole('alert').textContent).toBe('Not connected');
        // The lock is released, so the host can try again.
        expect(
          (screen.getByRole('switch', { name: /Wrong-answer penalty/ }) as HTMLButtonElement)
            .disabled,
        ).toBe(false);
      });

      it('Start game in the lobby sends host:start', () => {
        const socket = hostScreen();
        fireEvent.click(within(setup()!).getByRole('button', { name: /Start game/ }));
        expect(sent(socket)).toEqual([['host:start', {}]]);
      });

      describe('with a host phone paired', () => {
        const paired = (hostDevices = 1) => inPhase('LOBBY', { hostDevices });
        const toggle = () => within(setup()!).getByRole('button', { name: /^Settings/ });

        it('fold behind a Settings button, Start game still showing', () => {
          hostScreen(paired());
          expect(within(setup()!).getByRole('button', { name: /Start game/ })).toBeTruthy();
          expect(toggle().getAttribute('aria-expanded')).toBe('false');
          expect(screen.queryByRole('switch')).toBeNull();
        });

        it('Settings opens and closes them', () => {
          hostScreen(paired(2));
          fireEvent.click(toggle());
          expect(toggle().getAttribute('aria-expanded')).toBe('true');
          const panel = document.getElementById(toggle().getAttribute('aria-controls')!)!;
          expect(within(panel).getByRole('switch', { name: /Auto-open buzzers/ })).toBeTruthy();
          fireEvent.click(toggle());
          expect(screen.queryByRole('switch')).toBeNull();
        });

        it('fold when a phone pairs, and come back when the last one leaves', () => {
          const socket = hostScreen();
          expect(screen.getByRole('switch', { name: /Auto-open buzzers/ })).toBeTruthy();
          expect(within(setup()!).queryByRole('button', { name: /^Settings/ })).toBeNull();

          socket.fire('state', paired());
          expect(screen.queryByRole('switch')).toBeNull();

          socket.fire('state', paired(0));
          expect(screen.getByRole('switch', { name: /Auto-open buzzers/ })).toBeTruthy();
          expect(within(setup()!).queryByRole('button', { name: /^Settings/ })).toBeNull();
        });
      });

      it('Space still starts the game while a settings control has focus', () => {
        const socket = hostScreen();
        const toggle = screen.getByRole('switch', { name: /Auto-open buzzers/ });
        toggle.focus();
        fireEvent.keyDown(toggle, { key: ' ' });
        expect(sent(socket)).toEqual([['host:start', {}]]);
        // Blurred, so the keyup cannot press the toggle as well.
        expect(document.activeElement).not.toBe(toggle);
      });
    });

    it('never puts the answer in the DOM before REVEAL, with the bar and help open', () => {
      const leaky = { ...question, answer: ANSWER };
      for (const phase of ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED'] as const) {
        hostScreen(
          inPhase(phase, {
            question: leaky,
            winnerId: phase === 'BUZZED' ? 'p1' : null,
            canJudge: phase === 'BUZZED',
          }),
        );
        press('?', { shiftKey: true });
        expect(bar()).toBeTruthy();
        expect(document.body.innerHTML).not.toContain(ANSWER);
        cleanup();
        localStorage.clear();
      }
    });
  });
});

describe('Screen result states', () => {
  const ANSWER = 'Canberra';
  const ana = player(1, { name: 'Ana' });
  const ben = player(2, { name: 'Ben' });
  const cy = player(3, { name: 'Cy' });

  function questionView(overrides: Partial<ScreenView> = {}): ScreenView {
    return lobbyView([ana, ben, cy], {
      phase: 'QUESTION',
      questionIndex: 2,
      question: { id: 'q3', text: 'What is the capital of Australia?', points: 100 },
      ...overrides,
    });
  }

  /** REVEAL after Ben's correct answer: the view carries the answer. */
  function revealView(overrides: Partial<ScreenView> = {}): ScreenView {
    return questionView({
      phase: 'REVEAL',
      openingCounter: 1,
      winnerId: 'p2',
      scorerId: 'p2',
      question: {
        id: 'q3',
        text: 'What is the capital of Australia?',
        points: 100,
        answer: ANSWER,
      },
      ...overrides,
    });
  }

  function show(view: ScreenView) {
    const { socket } = renderScreen();
    socket.fire('state', view);
    return socket;
  }

  const flash = () => document.querySelector<HTMLElement>('[data-flash]');
  const rows = (name: string) =>
    within(screen.getByRole('region', { name }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);

  describe('standings rail', () => {
    const rail = () => screen.queryByRole('complementary', { name: 'Standings' });
    const six = [
      player(1, { name: 'Ana', score: 500, rank: 1 }),
      player(2, { name: 'Ben', score: 400, rank: 2 }),
      player(3, { name: 'Cy', score: 400, rank: 2 }),
      player(4, { name: 'Dee', score: 200, rank: 4 }),
      player(5, { name: 'Eli', score: 100, rank: 5, connected: false }),
      player(6, { name: 'Fay', score: 0, rank: 6 }),
    ];
    const railRows = () =>
      within(rail()!)
        .getAllByRole('listitem')
        .map((li) => li.textContent);

    it.each(['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'REVEAL'] as const)(
      'lists the top 5 with rank, colour, name and score in %s',
      (phase) => {
        show(
          phase === 'REVEAL'
            ? revealView({ players: six, winnerId: 'p1', scorerId: 'p1' })
            : questionView({ phase, players: six, winnerId: phase === 'BUZZED' ? 'p1' : null }),
        );
        expect(railRows()).toEqual(['1Ana500', '2Ben400', '2Cy400', '4Dee200', '5Eli100']);
        const first = within(rail()!).getAllByRole('listitem')[0]!;
        const probe = document.createElement('span');
        probe.style.backgroundColor = six[0]!.color;
        expect(colourDot(first).style.backgroundColor).toBe(probe.style.backgroundColor);
      },
    );

    it('sits beside the question card, not over it, and only from 1280×720', () => {
      show(questionView({ players: six }));
      const card = screen.getByRole('region', { name: 'Question' });
      expect(rail()!.contains(card)).toBe(false);
      expect(card.contains(rail())).toBe(false);
      expect(rail()!.className).toContain('hidden');
      expect(rail()!.className).toContain('[@media(min-width:1280px)_and_(min-height:720px)]:flex');
    });

    it('dims a disconnected player', () => {
      show(questionView({ players: six }));
      const eli = within(rail()!).getAllByRole('listitem')[4]!;
      expect(eli.className).toContain('opacity-40');
    });

    it('is gone when standings are off', () => {
      show(questionView({ players: six, settings: { ...DEFAULT_SETTINGS, showStandings: false } }));
      expect(rail()).toBeNull();
      expect(screen.getByRole('region', { name: 'Question' })).toBeTruthy();
    });

    it('turns off and on with the setting mid-question', () => {
      const socket = show(questionView({ phase: 'OPEN', openingCounter: 1, players: six }));
      expect(rail()).not.toBeNull();
      socket.fire(
        'state',
        questionView({
          phase: 'OPEN',
          openingCounter: 1,
          players: six,
          settings: { ...DEFAULT_SETTINGS, showStandings: false },
        }),
      );
      expect(rail()).toBeNull();
    });

    it('reorders when the scores change', () => {
      const socket = show(questionView({ players: six }));
      socket.fire(
        'state',
        revealView({
          players: [
            { ...six[5]!, score: 600, rank: 1 },
            ...six.slice(0, 5).map((p) => ({ ...p, rank: p.rank + 1 })),
          ],
          winnerId: 'p6',
          scorerId: 'p6',
        }),
      );
      expect(railRows()).toEqual(['1Fay600', '2Ana500', '3Ben400', '3Cy400', '5Dee200']);
    });

    it('is absent in the lobby and on the Final screen', () => {
      const socket = show(lobbyView(six));
      expect(rail()).toBeNull();
      socket.fire('state', lobbyView(six, { phase: 'FINAL', questionIndex: 9 }));
      expect(rail()).toBeNull();
    });

    it('is absent with no players', () => {
      show(questionView({ players: [] }));
      expect(rail()).toBeNull();
    });
  });

  describe('buzz time', () => {
    const ring = () => document.querySelector<HTMLElement>('[data-buzz-ring]');
    const buzzTime = () => screen.queryByRole('timer', { name: 'Buzz time' });
    const opened = (openingCounter = 1) =>
      questionView({ phase: 'OPEN', openingCounter, buzzTimer: { seconds: 10 } });

    it('counts down in a ring around "Buzzers OPEN" that drains as the seconds go', () => {
      vi.useFakeTimers();
      show(opened());
      expect(screen.getByRole('status').textContent).toBe('Buzzers OPEN');
      expect(ring()?.contains(screen.getByRole('status'))).toBe(true);
      expect(ring()?.contains(buzzTime())).toBe(true);
      expect(buzzTime()?.textContent).toBe('10');
      expect(ring()?.style.getPropertyValue('--left')).toBe('1');
      act(() => vi.advanceTimersByTime(4000));
      expect(buzzTime()?.textContent).toBe('6');
      expect(ring()?.style.getPropertyValue('--left')).toBe('0.6');
    });

    it('goes on the first buzz, and restarts in full when the buzzers reopen', () => {
      vi.useFakeTimers();
      const socket = show(opened());
      act(() => vi.advanceTimersByTime(7000));
      socket.fire('state', questionView({ phase: 'COLLECTING', openingCounter: 1 }));
      expect(ring()).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('Buzzers OPEN');
      socket.fire('state', opened(2));
      expect(buzzTime()?.textContent).toBe('10');
    });

    it('without a buzz time, "Buzzers OPEN" keeps its plain stage ring', () => {
      show(questionView({ phase: 'OPEN', openingCounter: 1 }));
      expect(ring()).toBeNull();
      expect(buzzTime()).toBeNull();
    });

    it('at time up plays the time’s-up sound, flashes red and moves to the reveal', () => {
      vi.mocked(playSound).mockClear();
      const socket = show(opened());
      socket.fire('state', revealView({ winnerId: null, scorerId: null }));
      socket.fire('fx', { kind: 'buzzTimeUp' });
      expect(vi.mocked(playSound).mock.calls.map(([name]) => name)).toEqual(['timeUp']);
      expect(flash()?.dataset.flash).toBe('buzzTimeUp');
      expect(flash()?.className).toContain('bg-buzz');
      expect(ring()).toBeNull();
      expect(within(screen.getByRole('region', { name: 'Answer' })).getByText(ANSWER)).toBeTruthy();
    });
  });

  describe('judged', () => {
    it('a correct answer flashes green and floats "+100" up from the name, then both clear', () => {
      vi.useFakeTimers();
      const socket = show(revealView());
      expect(flash()).toBeNull();

      socket.fire('fx', { kind: 'correct', playerId: 'p2', points: 100 });
      expect(flash()?.dataset.flash).toBe('correct');
      expect(flash()?.className).toContain('bg-win');
      expect(within(scorer()!).getByText('+100').className).toContain('animate-float-up');

      act(() => vi.advanceTimersByTime(FX_MS));
      expect(flash()).toBeNull();
      expect(screen.queryByText('+100')).toBeNull();
    });

    it('a wrong answer flashes red and greys out the winner’s banner until the reopen', () => {
      vi.useFakeTimers();
      const socket = show(questionView({ phase: 'BUZZED', openingCounter: 1, winnerId: 'p2' }));
      const panel = () => screen.getByRole('region', { name: 'Buzz result' });
      expect(panel().className).toContain('bg-buzz');

      socket.fire(
        'state',
        questionView({ phase: 'BUZZED', openingCounter: 1, winnerId: 'p2', lockedOut: ['p2'] }),
      );
      socket.fire('fx', { kind: 'wrong', playerId: 'p2' });
      expect(flash()?.dataset.flash).toBe('wrong');
      expect(flash()?.className).toContain('bg-buzz');
      expect(panel().dataset.judged).toBe('wrong');
      expect(panel().className).not.toContain('bg-buzz');
      const greyed = screen.getByRole('heading', { level: 2, name: 'Ben' });
      expect(greyed.className).toContain('text-muted');
      expect(greyed.className).toContain('line-through');

      act(() => vi.advanceTimersByTime(FX_MS));
      expect(flash()).toBeNull();
    });

    it('back to Buzzers open after a wrong answer, the player’s chip stays greyed out', () => {
      show(questionView({ phase: 'OPEN', openingCounter: 2, lockedOut: ['p2'] }));
      expect(screen.getByRole('status').textContent).toBe('Buzzers OPEN');
      const chips = within(screen.getByRole('list', { name: 'Locked out' })).getAllByRole(
        'listitem',
      );
      expect(chips.map((li) => li.textContent)).toEqual(['Ben']);
      expect(chips[0]!.className).toContain('line-through');
      expect(chips[0]!.style.backgroundColor).toBe('');
    });

    it('shows no locked-out row when nobody was judged wrong', () => {
      show(questionView({ phase: 'OPEN', openingCounter: 1 }));
      expect(screen.queryByRole('list', { name: 'Locked out' })).toBeNull();
    });

    describe('with false start on', () => {
      const settings = { ...DEFAULT_SETTINGS, falseStartMs: 500 as const };
      const chips = () =>
        within(screen.getByRole('list', { name: 'Too early' })).getAllByRole('listitem');

      it('a false start shows a small "Too early" tag on that player’s chip, in their colour', () => {
        show(questionView({ settings, falseStarts: ['p2'] }));
        expect(chips().map((li) => li.textContent)).toEqual(['BenToo early']);
        const probe = document.createElement('span');
        probe.style.backgroundColor = ben.color;
        expect(chips()[0]!.style.backgroundColor).toBe(probe.style.backgroundColor);
        expect(within(chips()[0]!).getByText('Too early').className).toContain('bg-warn');
      });

      it('keeps the tag after the opening until the wait ends', () => {
        vi.useFakeTimers();
        const socket = show(questionView({ settings, falseStarts: ['p2', 'p1'] }));
        socket.fire(
          'state',
          questionView({ phase: 'OPEN', openingCounter: 1, settings, falseStarts: ['p2', 'p1'] }),
        );
        expect(chips().map((li) => li.textContent)).toEqual(['BenToo early', 'AnaToo early']);
        act(() => vi.advanceTimersByTime(499));
        expect(chips()).toHaveLength(2);
        act(() => vi.advanceTimersByTime(1));
        expect(screen.queryByRole('list', { name: 'Too early' })).toBeNull();
      });

      it('shows no tag when nobody pressed early, or once someone wins the buzz', () => {
        show(questionView({ settings }));
        expect(screen.queryByRole('list', { name: 'Too early' })).toBeNull();
        cleanup();
        show(
          questionView({
            phase: 'BUZZED',
            openingCounter: 1,
            winnerId: 'p1',
            settings,
            falseStarts: ['p2'],
          }),
        );
        expect(screen.queryByRole('list', { name: 'Too early' })).toBeNull();
      });
    });

    it('a buzz or join fx does not flash the Screen', () => {
      const socket = show(questionView({ phase: 'OPEN', openingCounter: 1 }));
      socket.fire('fx', { kind: 'buzz', playerId: 'p2', gaps: [] });
      socket.fire('fx', { kind: 'join', playerId: 'p3' });
      expect(flash()).toBeNull();
    });
  });

  describe('answer time', () => {
    const buzzed = (overrides: Partial<ScreenView> = {}) =>
      questionView({ phase: 'BUZZED', openingCounter: 1, winnerId: 'p2', ...overrides });
    const timer = () => screen.queryByRole('timer', { name: 'Answer time' });

    it('shows a large countdown on the winner’s panel, counting down', () => {
      vi.useFakeTimers();
      show(buzzed({ answerTimer: { seconds: 5, up: false } }));
      const panel = screen.getByRole('region', { name: 'Buzz result' });
      expect(within(panel).getByRole('timer', { name: 'Answer time' })).toBe(timer());
      expect(timer()?.className).toContain('font-display');
      expect(timer()?.textContent).toBe('5');
      act(() => vi.advanceTimersByTime(2000));
      expect(timer()?.textContent).toBe('3');
      act(() => vi.advanceTimersByTime(10_000));
      expect(timer()?.textContent).toBe('0');
    });

    it('at time up shows "Time’s up!" and flashes red; the banner stays for the host to judge', () => {
      vi.useFakeTimers();
      const socket = show(buzzed({ answerTimer: { seconds: 3, up: false } }));
      act(() => vi.advanceTimersByTime(3000));
      socket.fire('state', buzzed({ answerTimer: { seconds: 3, up: true } }));
      socket.fire('fx', { kind: 'timeUp', playerId: 'p2' });
      expect(timer()?.textContent).toBe('Time’s up!');
      expect(timer()?.className).toContain('bg-buzz-ink');
      expect(flash()?.dataset.flash).toBe('timeUp');
      expect(flash()?.className).toContain('bg-buzz');
      expect(screen.getByRole('heading', { level: 2, name: 'Ben' })).toBeTruthy();

      act(() => vi.advanceTimersByTime(FX_MS));
      expect(flash()).toBeNull();
      expect(timer()?.textContent).toBe('Time’s up!');
    });

    it('restarts for the next winner after a wrong answer reopens the buzzers', () => {
      vi.useFakeTimers();
      const socket = show(buzzed({ answerTimer: { seconds: 5, up: false } }));
      act(() => vi.advanceTimersByTime(4000));
      socket.fire('state', buzzed({ lockedOut: ['p2'] }));
      expect(timer()).toBeNull();
      socket.fire(
        'state',
        buzzed({ openingCounter: 2, winnerId: 'p3', answerTimer: { seconds: 5, up: false } }),
      );
      expect(timer()?.textContent).toBe('5');
    });

    it('with the timer off, the buzz looks as before: no countdown', () => {
      show(buzzed());
      expect(screen.getByRole('heading', { level: 2, name: 'Ben' })).toBeTruthy();
      expect(timer()).toBeNull();
    });
  });

  describe('reveal', () => {
    it('shows the answer in large type under the question', () => {
      show(revealView());
      const question = screen.getByRole('heading', { level: 1 });
      const answer = within(screen.getByRole('region', { name: 'Answer' })).getByText(ANSWER);
      expect(answer.className).toContain('font-display');
      // DOCUMENT_POSITION_FOLLOWING: the answer comes after the question.
      expect(question.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
    });

    it('names the player who answered correctly', () => {
      show(revealView());
      expect(scorer()?.textContent).toBe('Ben ✓');
    });

    it('names nobody when the last eligible player answered wrong', () => {
      show(revealView({ lockedOut: ['p2'], scorerId: null }));
      expect(screen.getByText(ANSWER)).toBeTruthy();
      expect(scorer()).toBeNull();
    });

    it('names nobody after a skipped question', () => {
      show(revealView({ winnerId: null, scorerId: null }));
      expect(screen.getByText(ANSWER)).toBeTruthy();
      expect(screen.queryByText(/✓/)).toBeNull();
    });
  });

  describe('scoreboard overlay', () => {
    const standings = (scores: Record<string, number>, overrides: Partial<ScreenView> = {}) => {
      const players = [ana, ben, cy]
        .map((p) => ({ ...p, score: scores[p.id] ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .map((p, i) => ({ ...p, rank: i + 1 }));
      return questionView({ phase: 'REVEAL', players, ...overrides });
    };
    const names = () => rows('Scoreboard').map((text) => text?.replace(/\d+/g, ''));

    it('shows a ranked list of names and scores over the question while showScoreboard is set', () => {
      const socket = show(standings({ p1: 300, p2: 200, p3: 100 }, { showScoreboard: true }));
      expect(rows('Scoreboard')).toEqual(['1Ana300', '2Ben200', '3Cy100']);

      socket.fire('state', standings({ p1: 300, p2: 200, p3: 100 }));
      expect(screen.queryByRole('region', { name: 'Scoreboard' })).toBeNull();
    });

    it('says "No players yet" when shown with nobody in the room', () => {
      show(lobbyView([], { showScoreboard: true }));
      const board = screen.getByRole('region', { name: 'Scoreboard' });
      expect(board.textContent).toContain('No players yet');
      expect(within(board).queryAllByRole('listitem')).toHaveLength(0);
    });

    it('opens in the order it last showed, then reorders to the current ranking', () => {
      vi.useFakeTimers();
      const socket = show(standings({ p1: 300, p2: 200, p3: 100 }, { showScoreboard: true }));
      expect(names()).toEqual(['Ana', 'Ben', 'Cy']);
      socket.fire('state', standings({ p1: 300, p2: 200, p3: 100 }));

      // Cy scores twice while the scoreboard is hidden.
      socket.fire('state', standings({ p1: 300, p2: 200, p3: 400 }, { showScoreboard: true }));
      expect(names()).toEqual(['Ana', 'Ben', 'Cy']);
      expect(rows('Scoreboard')[2]).toBe('1Cy400');

      act(() => vi.advanceTimersByTime(REORDER_DELAY_MS));
      expect(names()).toEqual(['Cy', 'Ana', 'Ben']);
    });

    it('moves rows when a score changes while it is showing', () => {
      const socket = show(standings({ p1: 300, p2: 200, p3: 100 }, { showScoreboard: true }));
      socket.fire('state', standings({ p1: 300, p2: 400, p3: 100 }, { showScoreboard: true }));
      expect(names()).toEqual(['Ben', 'Ana', 'Cy']);
    });

    it('sits under the host control bar, so the host can still hide it, and ends above it', () => {
      saveHostToken('WXYZ', 'h'.repeat(43));
      const { socket } = renderScreen();
      act(() => socket.emitted[0]!.ack({ ok: true }));
      socket.fire('state', standings({ p1: 100 }, { showScoreboard: true }));
      const overlay = screen.getByRole('region', { name: 'Scoreboard' });
      const bar = screen.getByRole('toolbar', { name: 'Host controls' });
      // The bar comes later in the document, so it paints above the overlay.
      expect(overlay.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
      // The overlay and the question stop above the bar's 8vh.
      expect(overlay.parentElement!.className).toContain('mb-[8vh]');
    });

    it('a Screen without the host token keeps the full height', () => {
      show(standings({ p1: 100 }, { showScoreboard: true }));
      const overlay = screen.getByRole('region', { name: 'Scoreboard' });
      expect(overlay.parentElement!.className).not.toContain('mb-[8vh]');
    });

    it('carries no answer before reveal', () => {
      show(
        questionView({
          phase: 'BUZZED',
          winnerId: 'p2',
          showScoreboard: true,
          question: { id: 'q3', text: 'Capital?', points: 100, answer: 'Secret-answer-xyz' },
        }),
      );
      expect(screen.getByRole('region', { name: 'Scoreboard' })).toBeTruthy();
      expect(document.body.innerHTML).not.toContain('Secret-answer-xyz');
    });
  });

  describe('final', () => {
    function finalView(players: RankedPlayer[]): ScreenView {
      return lobbyView(players, { phase: 'FINAL', questionIndex: 9, question: null });
    }

    it('shows a top-3 podium, then the full ranking', () => {
      show(
        finalView([
          player(1, { name: 'Ana', score: 400, rank: 1 }),
          player(2, { name: 'Ben', score: 300, rank: 2 }),
          player(3, { name: 'Cy', score: 200, rank: 3 }),
          player(4, { name: 'Di', score: 100, rank: 4 }),
        ]),
      );
      const podium = screen.getByRole('region', { name: 'Podium' });
      const step = (place: string) =>
        within(podium).getByRole('listitem', { name: `${place} place` }).textContent;
      expect(step('1st')).toBe('Ana1st400');
      expect(step('2nd')).toBe('Ben2nd300');
      expect(step('3rd')).toBe('Cy3rd200');
      expect(podium.textContent).not.toContain('Di');
      expect(rows('Full ranking')).toEqual(['1Ana400', '2Ben300', '3Cy200', '4Di100']);
      // The podium comes first.
      const ranking = screen.getByRole('region', { name: 'Full ranking' });
      expect(podium.compareDocumentPosition(ranking) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
    });

    it('ties share a podium rank', () => {
      show(
        finalView([
          player(1, { name: 'Ana', score: 300, rank: 1 }),
          player(2, { name: 'Ben', score: 300, rank: 1 }),
          player(3, { name: 'Cy', score: 100, rank: 3 }),
        ]),
      );
      const podium = screen.getByRole('region', { name: 'Podium' });
      const first = within(podium).getByRole('listitem', { name: '1st place' });
      expect(within(first).getByText('Ana')).toBeTruthy();
      expect(within(first).getByText('Ben')).toBeTruthy();
      expect(within(podium).getByRole('listitem', { name: '3rd place' }).textContent).toContain(
        'Cy',
      );
      expect(within(podium).queryByRole('listitem', { name: '2nd place' })).toBeNull();
      expect(rows('Full ranking')).toEqual(['1Ana300', '1Ben300', '3Cy100']);
    });

    it('shows the podium, not the scoreboard overlay, when the game ends on a scoreboard question', () => {
      show({
        ...finalView([player(1, { name: 'Ana', score: 100, rank: 1 })]),
        showScoreboard: true,
      });
      expect(screen.getByRole('region', { name: 'Podium' })).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Scoreboard' })).toBeNull();
    });

    it('says "Game over" when nobody played', () => {
      show(finalView([]));
      expect(screen.getByRole('heading', { name: 'Game over' })).toBeTruthy();
    });
  });
});

describe('title card', () => {
  const q1 = { id: 'q1', text: 'Which planet is largest?', points: 100 };
  const lobby = () =>
    lobbyView([player(1)], { title: 'Space Quiz', category: 'Science', difficulty: 'hard' });
  const first = (phase: ScreenView['phase'] = 'QUESTION', overrides: Partial<ScreenView> = {}) =>
    lobbyView([player(1)], {
      title: 'Space Quiz',
      category: 'Science',
      difficulty: 'hard',
      phase,
      questionIndex: 0,
      question: q1,
      ...overrides,
    });
  const card = () => screen.queryByRole('region', { name: 'Title card' });

  it('shows the set’s title, category and difficulty for 3 s after Start game, then question 1', () => {
    vi.useFakeTimers();
    const { socket } = renderScreen();
    socket.fire('state', lobby());
    socket.fire('state', first());
    expect(within(card()!).getByRole('heading').textContent).toBe('Space Quiz');
    expect(card()!.textContent).toContain('Science · Hard');
    expect(screen.queryByText(q1.text)).toBeNull();

    act(() => vi.advanceTimersByTime(TITLE_CARD_MS - 1));
    expect(card()).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(card()).toBeNull();
    expect(screen.getByText(q1.text)).toBeTruthy();
  });

  it('leaves out a category or difficulty the set does not have', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView([player(1)], { title: 'Pub Quiz' }));
    socket.fire(
      'state',
      first('QUESTION', { title: 'Pub Quiz', category: null, difficulty: null }),
    );
    expect(card()!.textContent).toBe('Get readyPub Quiz');
    cleanup();

    const next = renderScreen().socket;
    next.fire('state', lobbyView([player(1)], { title: 'Pub Quiz' }));
    next.fire(
      'state',
      first('QUESTION', { title: 'Pub Quiz', category: null, difficulty: 'easy' }),
    );
    expect(card()!.textContent).toBe('Get readyPub QuizEasy');
  });

  it('ends as soon as the buzzers open', () => {
    vi.useFakeTimers();
    const { socket } = renderScreen();
    socket.fire('state', lobby());
    socket.fire('state', first());
    act(() => vi.advanceTimersByTime(1000));
    socket.fire('state', first('OPEN', { openingCounter: 1 }));
    expect(card()).toBeNull();
    expect(screen.getByText(q1.text)).toBeTruthy();
    // It does not come back in the rest of its 3 s.
    socket.fire('state', first('QUESTION'));
    expect(card()).toBeNull();
  });

  it('shows again at the start of a new game', () => {
    vi.useFakeTimers();
    const { socket } = renderScreen();
    socket.fire('state', lobby());
    socket.fire('state', first());
    act(() => vi.advanceTimersByTime(TITLE_CARD_MS));
    socket.fire('state', first('FINAL', { questionIndex: 0, question: null }));
    socket.fire('state', lobbyView([player(1)], { title: 'Ocean Quiz', category: 'Nature' }));
    socket.fire(
      'state',
      first('QUESTION', { title: 'Ocean Quiz', category: 'Nature', difficulty: null }),
    );
    expect(within(card()!).getByRole('heading').textContent).toBe('Ocean Quiz');
  });

  it('does not show on a Screen that joins mid-game', () => {
    const { socket } = renderScreen();
    socket.fire('state', first());
    expect(card()).toBeNull();
    expect(screen.getByText(q1.text)).toBeTruthy();
  });

  it('does not show when the game moves between other questions', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobby());
    socket.fire('state', first('QUESTION', { questionIndex: 1 }));
    expect(card()).toBeNull();
  });
});

describe('Click to start and sounds', () => {
  beforeEach(() => {
    vi.mocked(playSound).mockClear();
    vi.mocked(startSounds).mockClear();
  });

  const overlay = () => screen.queryByRole('dialog', { name: 'Click to start' });
  const startButton = () => screen.getByRole('button', { name: /Click to start/ });
  const played = () => vi.mocked(playSound).mock.calls.map(([name]) => name);
  const view = (phase: ScreenView['phase']) =>
    lobbyView([player(1)], {
      phase,
      questionIndex: phase === 'LOBBY' ? -1 : 2,
      question:
        phase === 'LOBBY' || phase === 'FINAL' ? null : { id: 'q3', text: 'Q?', points: 100 },
    });

  it('first load covers the Screen; the click unlocks audio, enters fullscreen and removes it', () => {
    const request = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = request;
    const { socket } = renderScreen(undefined, { start: false });
    socket.fire('state', view('LOBBY'));
    expect(overlay()).toBeTruthy();
    expect(document.activeElement).toBe(startButton());

    fireEvent.click(startButton());
    expect(startSounds).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
    expect(overlay()).toBeNull();
  });

  it('keys pressed on the overlay never reach the host shortcuts behind it', () => {
    saveHostToken('WXYZ', 'h'.repeat(43));
    const { socket } = renderScreen(undefined, { start: false });
    act(() => socket.emitted[0]!.ack({ ok: true }));
    socket.fire('state', view('LOBBY'));
    for (const key of [' ', 'Enter', 's']) fireEvent.keyDown(startButton(), { key });
    expect(socket.emitted.filter((e) => e.event.startsWith('host:'))).toEqual([]);
  });

  it('M pressed on the overlay leaves a token-less Screen’s sound level alone', () => {
    const { socket } = renderScreen(undefined, { start: false });
    socket.fire('state', view('LOBBY'));
    fireEvent.keyDown(startButton(), { key: 'm' });
    expect(localStorage.getItem('buzzr:soundLevel')).toBeNull();
  });

  it('is not shown over an error', () => {
    const { socket } = renderScreen(undefined, { start: false });
    act(() => socket.emitted[0]!.ack({ ok: false, error: 'Room not found' }));
    expect(screen.getByRole('heading', { name: 'Room not found' })).toBeTruthy();
    expect(overlay()).toBeNull();
  });

  it('plays the sound of each fx event: buzz, time up, correct, wrong and join', () => {
    const { socket } = renderScreen();
    socket.fire('state', view('BUZZED'));
    socket.fire('fx', { kind: 'buzz', playerId: 'p1', gaps: [] });
    socket.fire('fx', { kind: 'timeUp', playerId: 'p1' });
    socket.fire('fx', { kind: 'correct', playerId: 'p1', points: 100 });
    socket.fire('fx', { kind: 'wrong', playerId: 'p1' });
    socket.fire('fx', { kind: 'join', playerId: 'p2' });
    expect(played()).toEqual(['buzz', 'timeUp', 'correct', 'wrong', 'join']);
  });

  it('plays the practice sound for each lobby test buzz', () => {
    const { socket } = renderScreen();
    socket.fire('state', view('LOBBY'));
    socket.fire('fx', { kind: 'practice', playerId: 'p1' });
    socket.fire('fx', { kind: 'practice', playerId: 'p1' });
    expect(played()).toEqual(['practice', 'practice']);
  });

  it('plays nothing for a false start, and the next fx still plays (F71)', () => {
    const { socket } = renderScreen();
    socket.fire('state', view('QUESTION'));
    socket.fire('fx', { kind: 'falseStart', playerId: 'p1' });
    expect(played()).toEqual([]);
    socket.fire('fx', { kind: 'buzz', playerId: 'p1', gaps: [] });
    expect(played()).toEqual(['buzz']);
  });

  it('plays nothing before Click to start, and never replays an fx from before the click', () => {
    const { socket } = renderScreen(undefined, { start: false });
    socket.fire('state', view('LOBBY'));
    socket.fire('fx', { kind: 'join', playerId: 'p1' });
    expect(played()).toEqual([]);

    fireEvent.click(startButton());
    expect(played()).toEqual([]);
    socket.fire('fx', { kind: 'join', playerId: 'p2' });
    expect(played()).toEqual(['join']);
  });

  it('a Screen started while connecting plays an fx that arrives with the first state', () => {
    const { socket } = renderScreen();
    act(() => {
      socket.fire('state', view('BUZZED'));
      socket.fire('fx', { kind: 'buzz', playerId: 'p1', gaps: [] });
    });
    expect(played()).toEqual(['buzz']);
  });

  it('a Screen whose first state after the click is FINAL plays no fanfare', () => {
    const { socket } = renderScreen();
    socket.fire('state', view('FINAL'));
    expect(played()).toEqual([]);
  });

  it('plays the fanfare once when the game reaches FINAL', () => {
    const { socket } = renderScreen();
    socket.fire('state', view('REVEAL'));
    socket.fire('state', view('FINAL'));
    socket.fire('state', view('FINAL'));
    expect(played()).toEqual(['fanfare']);
  });

  it('a Screen that loads straight into FINAL plays no fanfare', () => {
    const { socket } = renderScreen();
    socket.fire('state', view('FINAL'));
    expect(played()).toEqual([]);
  });
});

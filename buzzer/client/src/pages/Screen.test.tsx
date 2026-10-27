// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, PLAYER_PALETTE } from '../../../shared/constants.js';
import type { RankedPlayer, ScreenView } from '../../../shared/types.js';
import { loadHostToken, saveHostToken } from '../lib/hostTokens.js';
import type { GameSocket } from '../lib/socket.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { Screen } from './Screen.js';

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
    showScoreboard: false,
    settings: DEFAULT_SETTINGS,
    question: null,
    ...overrides,
  };
}

function renderScreen(path = '/screen/WXYZ') {
  const socket = new FakeSocket();
  const makeSocket = vi.fn(() => socket as unknown as GameSocket);
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/screen/:code" element={<Screen makeSocket={makeSocket} />} />
      </Routes>
    </MemoryRouter>,
  );
  return { socket, makeSocket, unmount: view.unmount };
}

const joinUrl = `${window.location.host}/play/WXYZ`;

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

  it('warns that phones cannot open a localhost join URL', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView());
    expect(screen.getByRole('note').textContent).toContain('Phones can’t open localhost');
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

  it('bottom strip shows the code and "Join at <url>" in the lobby and in a game', () => {
    const { socket } = renderScreen();
    socket.fire('state', lobbyView());
    let strip = screen.getByRole('contentinfo');
    expect(strip.textContent).toBe(`Room WXYZJoin at ${joinUrl}`);

    socket.fire('state', lobbyView([], { phase: 'QUESTION', questionIndex: 0 }));
    strip = screen.getByRole('contentinfo');
    expect(strip.textContent).toBe(`Room WXYZJoin at ${joinUrl}`);
  });

  it('shows the join error, such as an unknown room, with a link home', () => {
    const { socket } = renderScreen();
    act(() => socket.emitted[0]!.ack({ ok: false, error: 'Room not found' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Room not found');
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
  });

  it('a malformed code shows Room not found without connecting', () => {
    const { makeSocket } = renderScreen('/screen/AB1');
    expect(makeSocket).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Room not found');
  });

  it('disconnects when the page closes', () => {
    const { socket, unmount } = renderScreen();
    unmount();
    expect(socket.disconnected).toBe(true);
  });

  describe('Pair host phone', () => {
    const hostToken = 'h'.repeat(43);

    function lobbyWithToken() {
      saveHostToken('WXYZ', hostToken);
      const { socket } = renderScreen();
      act(() => socket.emitted[0]!.ack({ ok: true }));
      socket.fire('state', lobbyView());
    }

    it('is offered only on a Screen that holds the hostToken', () => {
      const { socket } = renderScreen();
      socket.fire('state', lobbyView());
      expect(screen.queryByRole('button', { name: 'Pair host phone' })).toBeNull();
      cleanup();

      lobbyWithToken();
      expect(screen.getByRole('button', { name: 'Pair host phone' })).toBeTruthy();
    });

    it('shows a QR to /host/<CODE>#t=<hostToken>', () => {
      lobbyWithToken();
      fireEvent.click(screen.getByRole('button', { name: 'Pair host phone' }));
      const pairing = screen.getByRole('region', { name: 'Pair host phone' });
      expect(within(pairing).getByTestId('qr').dataset.value).toBe(
        `${window.location.origin}/host/WXYZ#t=${hostToken}`,
      );
      // The token is only inside the QR, never printed as text.
      expect(pairing.textContent).not.toContain(hostToken);
    });

    it('hides the QR after 60 seconds', () => {
      vi.useFakeTimers();
      lobbyWithToken();
      fireEvent.click(screen.getByRole('button', { name: 'Pair host phone' }));
      expect(screen.getByText('Hides in 60 s')).toBeTruthy();

      act(() => vi.advanceTimersByTime(59_000));
      expect(screen.getByRole('region', { name: 'Pair host phone' })).toBeTruthy();
      expect(screen.getByText('Hides in 1 s')).toBeTruthy();

      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.queryByRole('region', { name: 'Pair host phone' })).toBeNull();
      for (const qr of screen.getAllByTestId('qr')) expect(qr.dataset.value).not.toContain('#t=');
      expect(screen.getByRole('button', { name: 'Pair host phone' })).toBeTruthy();
    });

    it('hides the QR on time even when the browser throttles its timer', () => {
      vi.useFakeTimers();
      lobbyWithToken();
      fireEvent.click(screen.getByRole('button', { name: 'Pair host phone' }));
      // A background tab: 60 s pass on the clock, but the timer fires only once.
      vi.setSystemTime(Date.now() + 60_000);
      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.queryByRole('region', { name: 'Pair host phone' })).toBeNull();
    });

    it('Hide removes the QR early', () => {
      lobbyWithToken();
      fireEvent.click(screen.getByRole('button', { name: 'Pair host phone' }));
      fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
      expect(screen.queryByRole('region', { name: 'Pair host phone' })).toBeNull();
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

    it('shows "Question N of M" and the question text', () => {
      show(questionView());
      expect(screen.getByText('Question 3 of 10')).toBeTruthy();
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

    it('shrinks long question text', () => {
      const socket = show(questionView());
      const shortClass = screen.getByRole('heading', { level: 1 }).className;
      socket.fire(
        'state',
        questionView({ question: { id: 'q3', text: 'Why '.repeat(60).trim() + '?', points: 100 } }),
      );
      expect(screen.getByRole('heading', { level: 1 }).className).not.toBe(shortClass);
    });

    it('shows the winner in a banner in their colour, in place of the status', () => {
      show(questionView({ phase: 'BUZZED', openingCounter: 1, winnerId: 'p2' }));
      const banner = screen.getByRole('heading', { level: 2, name: 'Ben' });
      expect(banner.style.backgroundColor).not.toBe('');
      const probe = document.createElement('div');
      probe.style.backgroundColor = ben.color;
      expect(banner.style.backgroundColor).toBe(probe.style.backgroundColor);
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
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, PLAYER_PALETTE } from '../../../shared/constants.js';
import type { HostView, Question, RankedPlayer } from '../../../shared/types.js';
import { loadHostToken, saveHostToken } from '../lib/hostTokens.js';
import type { GameSocket } from '../lib/socket.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { Host } from './Host.js';

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

const TOKEN = 't'.repeat(43);

function question(n: number, overrides: Partial<Question> = {}): Question {
  return {
    id: `q${n}`,
    text: `Question text ${n}`,
    answer: `Answer ${n}`,
    hostNotes: `Notes ${n}`,
    points: 100,
    ...overrides,
  };
}

function player(n: number, overrides: Partial<RankedPlayer> = {}) {
  return {
    id: `p${n}`,
    name: `Player ${n}`,
    color: PLAYER_PALETTE[n % PLAYER_PALETTE.length]!,
    score: 0,
    connected: true,
    rank: 1,
    rttMs: 0,
    ...overrides,
  };
}

function hostView(overrides: Partial<HostView> = {}): HostView {
  return {
    role: 'host',
    code: 'WXYZ',
    title: 'Sample quiz',
    phase: 'LOBBY',
    questionIndex: -1,
    questionCount: 10,
    openingCounter: 0,
    players: [],
    winnerId: null,
    alsoBuzzed: [],
    lockedOut: [],
    showScoreboard: false,
    settings: DEFAULT_SETTINGS,
    question: null,
    nextQuestion: question(1),
    buzzes: [],
    judgements: [],
    ...overrides,
  };
}

/**
 * Shows the router's current URL, so tests can see the hash being stripped. Its button opens a
 * pairing link in the same tab, which changes only the hash.
 */
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.pathname + location.hash}</output>
      <button type="button" onClick={() => void navigate(`/host/WXYZ#t=${TOKEN}`)}>
        Open pairing link
      </button>
    </>
  );
}

function renderHost(path = '/host/WXYZ') {
  const socket = new FakeSocket();
  const makeSocket = vi.fn(() => socket as unknown as GameSocket);
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/host/:code" element={<Host makeSocket={makeSocket} />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
  return { socket, makeSocket, unmount: view.unmount };
}

/** React Router runs navigations in a transition, so let it settle before reading the URL. */
async function flushNavigation() {
  await act(async () => {});
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('Host remote', () => {
  describe('pairing link', () => {
    it('strips the hash from the URL and stores the token once the server accepts it', async () => {
      const { socket } = renderHost(`/host/WXYZ#t=${TOKEN}`);
      await flushNavigation();
      expect(screen.getByTestId('location').textContent).toBe('/host/WXYZ');
      expect(loadHostToken('WXYZ')).toBeNull();
      act(() => socket.emitted[0]!.ack({ ok: true }));
      expect(loadHostToken('WXYZ')).toBe(TOKEN);
    });

    it('sends host:join with the token from the hash', () => {
      const { socket } = renderHost(`/host/wxyz#t=${TOKEN}`);
      expect(socket.emitted).toHaveLength(1);
      expect(socket.emitted[0]).toMatchObject({
        event: 'host:join',
        payload: { code: 'WXYZ', hostToken: TOKEN },
      });
    });

    it('prefers the hash token over an older stored one', () => {
      saveHostToken('WXYZ', 'o'.repeat(43));
      const { socket } = renderHost(`/host/WXYZ#t=${TOKEN}`);
      expect(socket.emitted[0]?.payload).toEqual({ code: 'WXYZ', hostToken: TOKEN });
      act(() => socket.emitted[0]!.ack({ ok: true }));
      expect(loadHostToken('WXYZ')).toBe(TOKEN);
    });

    it('a wrong link keeps the good stored token and joins with it instead', async () => {
      const sockets: FakeSocket[] = [];
      const makeSocket = vi.fn(() => {
        sockets.push(new FakeSocket());
        return sockets.at(-1) as unknown as GameSocket;
      });
      saveHostToken('WXYZ', TOKEN);
      const wrong = 'w'.repeat(43);
      render(
        <MemoryRouter initialEntries={[`/host/WXYZ#t=${wrong}`]}>
          <Routes>
            <Route path="/host/:code" element={<Host makeSocket={makeSocket} />} />
          </Routes>
        </MemoryRouter>,
      );
      await flushNavigation();
      expect(sockets[0]!.emitted[0]?.payload).toEqual({ code: 'WXYZ', hostToken: wrong });
      act(() => sockets[0]!.emitted[0]!.ack({ ok: false, error: 'Invalid host token' }));
      expect(loadHostToken('WXYZ')).toBe(TOKEN);
      expect(sockets[0]!.disconnected).toBe(true);
      expect(sockets[1]!.emitted[0]?.payload).toEqual({ code: 'WXYZ', hostToken: TOKEN });
    });

    it('a pairing link opened in a tab already on this page takes effect without a reload', async () => {
      const { socket, makeSocket } = renderHost();
      expect(heading()).toBe('Not authorised');
      fireEvent.click(screen.getByRole('button', { name: 'Open pairing link' }));
      await flushNavigation();
      expect(makeSocket).toHaveBeenCalledOnce();
      expect(socket.emitted[0]?.payload).toEqual({ code: 'WXYZ', hostToken: TOKEN });
      expect(screen.getByTestId('location').textContent).toBe('/host/WXYZ');
    });
  });

  it('a device that already holds the token joins without a hash', () => {
    saveHostToken('WXYZ', TOKEN);
    const { socket } = renderHost();
    expect(socket.emitted[0]?.payload).toEqual({ code: 'WXYZ', hostToken: TOKEN });
  });

  it('joins again with the token after a reconnect, once the hash is gone', () => {
    const { socket } = renderHost(`/host/WXYZ#t=${TOKEN}`);
    socket.fire('connect');
    expect(socket.emitted.map((e) => e.payload)).toEqual([
      { code: 'WXYZ', hostToken: TOKEN },
      { code: 'WXYZ', hostToken: TOKEN },
    ]);
  });

  describe('Not authorised', () => {
    it('without a token it says Not authorised and never connects', () => {
      const { makeSocket } = renderHost();
      expect(heading()).toBe('Not authorised');
      expect(makeSocket).not.toHaveBeenCalled();
    });

    it('a malformed hash token counts as no token, and the hash is still stripped', async () => {
      const { makeSocket } = renderHost('/host/WXYZ#t=short');
      await flushNavigation();
      expect(heading()).toBe('Not authorised');
      expect(makeSocket).not.toHaveBeenCalled();
      expect(loadHostToken('WXYZ')).toBeNull();
      expect(screen.getByTestId('location').textContent).toBe('/host/WXYZ');
    });

    it('a token the server rejects is forgotten, the socket closes and nothing secret shows', () => {
      const { socket } = renderHost(`/host/WXYZ#t=${TOKEN}`);
      act(() => socket.emitted[0]!.ack({ ok: false, error: 'Invalid host token' }));
      expect(heading()).toBe('Not authorised');
      expect(loadHostToken('WXYZ')).toBeNull();
      expect(socket.disconnected).toBe(true);
      expect(document.body.textContent).not.toContain('Answer 1');
      expect(document.body.textContent).not.toContain('Notes 1');
    });
  });

  it('shows other join errors, such as an unknown room, with a link home', () => {
    saveHostToken('WXYZ', TOKEN);
    const { socket } = renderHost();
    act(() => socket.emitted[0]!.ack({ ok: false, error: 'Room not found' }));
    expect(heading()).toBe('Room not found');
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
  });

  it('a malformed code shows Room not found without connecting', () => {
    saveHostToken('AB1', TOKEN);
    const { makeSocket } = renderHost('/host/AB1');
    expect(heading()).toBe('Room not found');
    expect(makeSocket).not.toHaveBeenCalled();
  });

  it('shows Connecting until the first state arrives', () => {
    renderHost(`/host/WXYZ#t=${TOKEN}`);
    expect(heading()).toBe('Connecting…');
  });

  describe('remote', () => {
    function remote(view: HostView) {
      const { socket } = renderHost(`/host/WXYZ#t=${TOKEN}`);
      act(() => socket.emitted[0]!.ack({ ok: true }));
      socket.fire('state', view);
      return socket;
    }

    it('lobby lists the players with colour, score and connection status', () => {
      remote(
        hostView({
          players: [player(1), player(2, { connected: false, score: 300 })],
        }),
      );
      const list = screen.getByRole('region', { name: 'Players (2)' });
      const rows = within(list).getAllByRole('listitem');
      expect(rows.map((row) => row.textContent)).toEqual(['Player 10', 'Player 2offline300']);
      const dots = rows.map((row) => (row.firstElementChild as HTMLElement).style.backgroundColor);
      expect(dots[0]).not.toBe('');
      expect(dots[0]).not.toBe(dots[1]);
    });

    it('players appear live as they join', () => {
      const socket = remote(hostView());
      expect(screen.getByText('No one has joined yet.')).toBeTruthy();
      socket.fire('state', hostView({ players: [player(1)] }));
      expect(screen.getByRole('region', { name: 'Players (1)' })).toBeTruthy();
    });

    it('lobby shows the first question with its answer and notes box', () => {
      remote(hostView());
      const card = screen.getByRole('region', { name: 'Question' });
      expect(card.textContent).toContain('Up first: question 1 of 10');
      expect(card.textContent).toContain('Question text 1');
      const answer = within(card).getByLabelText('Answer');
      expect(answer.textContent).toContain('Answer 1');
      expect(answer.textContent).toContain('Notes 1');
    });

    it('during a game shows the current question number, answer and notes', () => {
      remote(
        hostView({
          phase: 'QUESTION',
          questionIndex: 2,
          question: question(3, { points: 200 }),
          nextQuestion: question(4),
        }),
      );
      const card = screen.getByRole('region', { name: 'Question' });
      expect(card.textContent).toContain('Question 3 of 10');
      expect(card.textContent).toContain('200 pts');
      expect(within(card).getByLabelText('Answer').textContent).toBe('AnswerAnswer 3Notes 3');
    });

    it('omits the notes line when the question has none', () => {
      remote(hostView({ nextQuestion: question(1, { hostNotes: undefined }) }));
      expect(screen.getByLabelText('Answer').textContent).toBe('AnswerAnswer 1');
    });

    it('lobby offers Pair host phone, with a QR to this room and token that hides after 60 s', () => {
      vi.useFakeTimers();
      remote(hostView());
      fireEvent.click(screen.getByRole('button', { name: 'Pair host phone' }));
      expect(screen.getByTestId('qr').dataset.value).toBe(
        `${window.location.origin}/host/WXYZ#t=${TOKEN}`,
      );
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.queryByTestId('qr')).toBeNull();
    });

    it('Pair host phone is only in the lobby', () => {
      remote(hostView({ phase: 'QUESTION', questionIndex: 0, question: question(1) }));
      expect(screen.queryByRole('button', { name: 'Pair host phone' })).toBeNull();
    });
  });
});

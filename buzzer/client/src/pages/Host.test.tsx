// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  GAME_ENDED_ERROR,
  PLAYER_PALETTE,
  ROOM_NOT_FOUND_ERROR,
} from '../../../shared/constants.js';
import { TOAST_MS } from '../components/Toast.js';
import type { HostView, Question } from '../../../shared/types.js';
import { loadHostToken, saveHostToken } from '../lib/hostTokens.js';
import { OFFLINE_AFTER_MS } from '../lib/useRoomSocket.js';
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

function player(n: number, overrides: Partial<HostView['players'][number]> = {}) {
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
    canJudge: false,
    canUndo: false,
    scorerId: null,
    answerTimer: null,
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

  it('the device that created the room opens the remote with no hash and joins as host', () => {
    saveHostToken('WXYZ', TOKEN);
    const { socket } = renderHost('/host/WXYZ');
    expect(socket.emitted[0]?.event).toBe('host:join');
    act(() => socket.emitted[0]!.ack({ ok: true }));
    socket.fire('state', hostView());
    expect(heading()).toBe('Host controls');
    expect(loadHostToken('WXYZ')).toBe(TOKEN);
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

  it('shows other join errors with a link home', () => {
    saveHostToken('WXYZ', TOKEN);
    const { socket } = renderHost();
    act(() => socket.emitted[0]!.ack({ ok: false, error: 'Already joined' }));
    expect(heading()).toBe('Already joined');
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
  });

  it('a room the server no longer has (expiry or restart) shows "This game has ended" with a link home', () => {
    saveHostToken('WXYZ', TOKEN);
    const { socket } = renderHost();
    act(() => socket.emitted[0]!.ack({ ok: false, error: ROOM_NOT_FOUND_ERROR }));
    expect(heading()).toBe(GAME_ENDED_ERROR);
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
  });

  it('room:closed mid-game shows "This game has ended"', () => {
    saveHostToken('WXYZ', TOKEN);
    const { socket } = renderHost();
    act(() => socket.emitted[0]!.ack({ ok: true }));
    socket.fire('state', hostView());
    socket.fire('room:closed', { reason: 'expired' });
    expect(heading()).toBe(GAME_ENDED_ERROR);
  });

  it('a reconnect rejoins silently with the stored token and renders the new snapshot', () => {
    saveHostToken('WXYZ', TOKEN);
    const { socket } = renderHost();
    act(() => socket.emitted[0]!.ack({ ok: true }));
    socket.fire('state', hostView());
    socket.fire('connect');
    const joins = socket.emitted.filter((e) => e.event === 'host:join');
    expect(joins.map((e) => e.payload)).toEqual([
      { code: 'WXYZ', hostToken: TOKEN },
      { code: 'WXYZ', hostToken: TOKEN },
    ]);
    act(() => joins[1]!.ack({ ok: true }));
    socket.fire('state', hostView({ players: [player(1)] }));
    expect(screen.getByRole('tab', { name: 'Players (1)' })).toBeTruthy();
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

    const openTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));

    it('opens on the Game tab and switches between Game, Players and Settings', () => {
      remote(hostView({ players: [player(1)] }));
      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((t) => t.textContent)).toEqual(['Game', 'Players (1)', 'Settings']);
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Game');
      expect(screen.getByRole('region', { name: 'Question' })).toBeTruthy();
      openTab(/^Players/);
      expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('tab-Players');
      expect(screen.queryByRole('region', { name: 'Question' })).toBeNull();
      expect(screen.getByRole('region', { name: 'Players (1)' })).toBeTruthy();
      openTab(/^Settings$/);
      expect(screen.getByRole('region', { name: 'Settings' })).toBeTruthy();
    });

    describe('tab keys', () => {
      const selected = () => screen.getByRole('tab', { selected: true });
      const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });

      function focusGame() {
        remote(hostView({ players: [player(1)] }));
        act(() => screen.getByRole('tab', { name: 'Game' }).focus());
      }

      it('only the selected tab is in the tab order', () => {
        focusGame();
        expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([0, -1, -1]);
        press('ArrowRight');
        expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
      });

      it('→ and ← select, show and focus the next and previous tab', () => {
        focusGame();
        press('ArrowRight');
        expect(selected().id).toBe('tab-Players');
        expect(document.activeElement).toBe(selected());
        expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('tab-Players');
        press('ArrowRight');
        expect(selected().id).toBe('tab-Settings');
        press('ArrowLeft');
        expect(selected().id).toBe('tab-Players');
        expect(document.activeElement).toBe(selected());
      });

      it('wraps at both ends', () => {
        focusGame();
        press('ArrowLeft');
        expect(selected().id).toBe('tab-Settings');
        expect(document.activeElement).toBe(selected());
        press('ArrowRight');
        expect(selected().id).toBe('tab-Game');
        expect(document.activeElement).toBe(selected());
      });

      it('Home and End jump to the first and last tab', () => {
        focusGame();
        press('End');
        expect(selected().id).toBe('tab-Settings');
        expect(document.activeElement).toBe(selected());
        press('Home');
        expect(selected().id).toBe('tab-Game');
        expect(document.activeElement).toBe(selected());
      });

      it('other keys leave the selection alone', () => {
        focusGame();
        press('ArrowDown');
        press('a');
        expect(selected().id).toBe('tab-Game');
      });
    });

    describe('game over', () => {
      const final = (players: HostView['players']) =>
        hostView({ phase: 'FINAL', questionIndex: 9, question: question(10), players });

      it('the Game tab shows Game over and the ranking instead of the last question', () => {
        // Join order, as the server sends it; the card orders by rank.
        remote(
          final([
            player(1, { score: 100, rank: 3 }),
            player(2, { score: 400, rank: 1 }),
            player(3, { score: 200, rank: 2 }),
          ]),
        );
        expect(screen.queryByRole('region', { name: 'Question' })).toBeNull();
        expect(screen.queryByText('Answer 10')).toBeNull();
        const card = screen.getByRole('region', { name: 'Game over' });
        const rows = within(card).getAllByRole('listitem');
        expect(rows.map((row) => row.textContent)).toEqual([
          '1stPlayer 2400',
          '2ndPlayer 3200',
          '3rdPlayer 1100',
        ]);
      });

      it('tied players share a rank and keep join order between them', () => {
        remote(
          final([
            player(1, { score: 0, rank: 3 }),
            player(2, { score: 200, rank: 1 }),
            player(3, { score: 200, rank: 1 }),
          ]),
        );
        const card = screen.getByRole('region', { name: 'Game over' });
        expect(
          within(card)
            .getAllByRole('listitem')
            .map((row) => row.textContent),
        ).toEqual(['1stPlayer 2200', '1stPlayer 3200', '3rdPlayer 10']);
      });

      it('with no players it says so', () => {
        remote(final([]));
        const card = screen.getByRole('region', { name: 'Game over' });
        expect(within(card).getByText('No players')).toBeTruthy();
      });

      it('Show / Hide scoreboard stays', () => {
        const socket = remote(final([player(1)]));
        fireEvent.click(screen.getByRole('button', { name: 'Show scoreboard' }));
        expect(socket.emitted.at(-1)).toMatchObject({
          event: 'host:scoreboard',
          payload: { show: true },
        });
      });

      it('New game on the card opens the picker over the remote', () => {
        remote(final([player(1)]));
        const card = screen.getByRole('region', { name: 'Game over' });
        expect(screen.queryByRole('dialog', { name: 'New game' })).toBeNull();
        fireEvent.click(within(card).getByRole('button', { name: 'New game' }));
        const picker = screen.getByRole('dialog', { name: 'New game' });
        expect(within(picker).getByRole('checkbox', { name: 'Keep scores' })).toBeTruthy();
        fireEvent.click(within(picker).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog', { name: 'New game' })).toBeNull();
      });

      it('offers New game only in FINAL', () => {
        for (const phase of ['LOBBY', 'QUESTION', 'OPEN', 'REVEAL'] as const) {
          remote(
            hostView({ phase, questionIndex: phase === 'LOBBY' ? -1 : 0, question: question(1) }),
          );
          expect(screen.queryByRole('button', { name: 'New game' })).toBeNull();
          cleanup();
        }
      });

      it('before FINAL the Game tab shows the question, not the card', () => {
        remote(hostView({ phase: 'REVEAL', questionIndex: 0, question: question(1) }));
        expect(screen.getByRole('region', { name: 'Question' })).toBeTruthy();
        expect(screen.queryByRole('region', { name: 'Game over' })).toBeNull();
      });
    });

    it('lobby lists the players with colour, score and connection status', () => {
      remote(
        hostView({
          players: [player(1, { rttMs: 42 }), player(2, { connected: false, score: 300 })],
        }),
      );
      openTab(/^Players/);
      const list = screen.getByRole('region', { name: 'Players (2)' });
      const rows = within(list).getAllByRole('listitem');
      const lines = rows.map((row) => row.firstElementChild as HTMLElement);
      expect(lines.map((line) => line.textContent)).toEqual([
        'Player 1online · 42 ms0',
        'Player 2offline300',
      ]);
      const dots = lines.map(
        (line) => (line.firstElementChild as HTMLElement).style.backgroundColor,
      );
      expect(dots[0]).not.toBe('');
      expect(dots[0]).not.toBe(dots[1]);
    });

    it('players appear live as they join', () => {
      const socket = remote(hostView());
      openTab(/^Players/);
      expect(screen.getByText('No one has joined yet.')).toBeTruthy();
      socket.fire('state', hostView({ players: [player(1)] }));
      expect(screen.getByRole('region', { name: 'Players (1)' })).toBeTruthy();
    });

    it('a rejected action from another tab shows the same toast', () => {
      const socket = remote(
        hostView({
          phase: 'QUESTION',
          questionIndex: 0,
          question: question(1),
          players: [player(1)],
        }),
      );
      openTab(/^Players/);
      fireEvent.click(screen.getByRole('button', { name: 'Add 100 to Player 1' }));
      expect(socket.emitted.at(-1)).toMatchObject({
        event: 'host:adjustScore',
        payload: { playerId: 'p1', delta: 100 },
      });
      act(() => socket.emitted.at(-1)!.ack({ ok: false, error: 'Unknown player' }));
      expect(screen.getByRole('alert').textContent).toBe('Unknown player');
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

    it("shows the current question's image thumbnail from the room's image route", () => {
      remote(
        hostView({
          phase: 'QUESTION',
          questionIndex: 0,
          question: question(1, { text: '', imageId: 'img1' }),
          nextQuestion: question(2),
        }),
      );
      const card = screen.getByRole('region', { name: 'Question' });
      const image = within(card).getByRole('img', { name: 'Picture question' });
      expect(image.getAttribute('src')).toBe('/api/rooms/WXYZ/images/img1');
    });

    it("preloads the next question's image", () => {
      const loaded: string[] = [];
      vi.stubGlobal(
        'Image',
        class {
          set src(url: string) {
            loaded.push(url);
          }
        },
      );
      remote(
        hostView({
          phase: 'REVEAL',
          questionIndex: 0,
          question: question(1),
          nextQuestion: question(2, { imageId: 'img2' }),
        }),
      );
      expect(loaded).toEqual(['/api/rooms/WXYZ/images/img2']);
      expect(screen.queryByRole('img')).toBeNull();
      vi.unstubAllGlobals();
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

  describe('primary action', () => {
    function remote(view: HostView) {
      const { socket } = renderHost(`/host/WXYZ#t=${TOKEN}`);
      act(() => socket.emitted[0]!.ack({ ok: true }));
      socket.fire('state', view);
      return socket;
    }

    const PRIMARY_LABELS =
      /^(Start game|Open buzzers|Reveal answer|Next question|Show final results)$/;
    const primary = () => screen.getByRole('button', { name: PRIMARY_LABELS });
    const inPhase = (phase: HostView['phase'], questionIndex = 0) =>
      hostView({ phase, questionIndex, question: question(questionIndex + 1) });

    it.each([
      ['LOBBY', 'Start game', 'host:start', hostView({ players: [player(1)] })],
      ['QUESTION', 'Open buzzers', 'host:open', inPhase('QUESTION')],
      ['OPEN', 'Reveal answer', 'host:reveal', inPhase('OPEN')],
      ['COLLECTING', 'Reveal answer', 'host:reveal', inPhase('COLLECTING')],
      ['REVEAL', 'Next question', 'host:next', inPhase('REVEAL', 3)],
      ['REVEAL of the last question', 'Show final results', 'host:next', inPhase('REVEAL', 9)],
    ])('in %s it reads %s and sends %s', (_phase, label, event, view) => {
      const socket = remote(view);
      expect(primary().textContent).toBe(label);
      fireEvent.click(primary());
      expect(socket.emitted.at(-1)).toMatchObject({ event, payload: {} });
    });

    describe('BUZZED', () => {
      const buzzed = (canJudge: boolean) =>
        hostView({ ...inPhase('BUZZED'), winnerId: 'p1', players: [player(1)], canJudge });

      it.each([
        ['Correct', 'correct'],
        ['Wrong', 'wrong'],
      ])('shows Correct and Wrong side by side; %s sends host:judge %s', (label, result) => {
        const socket = remote(buzzed(true));
        expect(screen.queryByRole('button', { name: PRIMARY_LABELS })).toBeNull();
        const correct = screen.getByRole('button', { name: 'Correct' });
        const wrong = screen.getByRole('button', { name: 'Wrong' });
        expect(correct.parentElement).toBe(wrong.parentElement);
        fireEvent.click(screen.getByRole('button', { name: label }));
        expect(socket.emitted.at(-1)).toMatchObject({ event: 'host:judge', payload: { result } });
      });

      it('a double tap judges once', () => {
        const socket = remote(buzzed(true));
        fireEvent.click(screen.getByRole('button', { name: 'Wrong' }));
        fireEvent.click(screen.getByRole('button', { name: 'Correct' }));
        expect(socket.emitted.filter((e) => e.event === 'host:judge')).toHaveLength(1);
      });

      it('one press locks every button on the remote until the next snapshot', () => {
        const socket = remote(buzzed(true));
        fireEvent.click(screen.getByRole('button', { name: 'Wrong' }));
        fireEvent.click(screen.getByRole('button', { name: 'Skip question' }));
        expect(
          socket.emitted.filter((e) => e.event.startsWith('host:') && e.event !== 'host:join'),
        ).toHaveLength(1);
        socket.fire('state', { ...buzzed(false) });
        expect(
          (screen.getByRole('button', { name: 'Skip question' }) as HTMLButtonElement).disabled,
        ).toBe(false);
      });

      describe('with an answer time', () => {
        const timed = (up: boolean) => ({
          ...buzzed(true),
          openingCounter: 1,
          answerTimer: { seconds: 3, up },
        });
        const timer = () => screen.queryByRole('timer', { name: 'Answer time' });

        function stubVibrate() {
          const vibrate = vi.fn(() => true);
          Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
          return vibrate;
        }

        afterEach(() => {
          Reflect.deleteProperty(navigator, 'vibrate');
        });

        it('shows the countdown right above Correct / Wrong, counting down', () => {
          vi.useFakeTimers();
          remote(timed(false));
          const buttons = screen.getByRole('button', { name: 'Correct' }).parentElement!;
          expect(timer()?.nextElementSibling).toBe(buttons);
          expect(timer()?.textContent).toBe('Answer time3');
          act(() => vi.advanceTimersByTime(1000));
          expect(timer()?.textContent).toBe('Answer time2');
        });

        it('at time up shows a "Time’s up" badge and vibrates; Correct / Wrong still judge', () => {
          const vibrate = stubVibrate();
          const socket = remote(timed(false));
          socket.fire('state', timed(true));
          socket.fire('fx', { kind: 'timeUp', playerId: 'p1' });
          expect(within(timer()!).getByText('Time’s up').className).toContain('bg-buzz');
          expect(vibrate).toHaveBeenCalledExactlyOnceWith([200, 100, 200]);
          fireEvent.click(screen.getByRole('button', { name: 'Wrong' }));
          expect(socket.emitted.at(-1)).toMatchObject({
            event: 'host:judge',
            payload: { result: 'wrong' },
          });
        });

        it('vibrates only for time up', () => {
          const vibrate = stubVibrate();
          const socket = remote(timed(false));
          socket.fire('fx', { kind: 'buzz', playerId: 'p1', gaps: [] });
          socket.fire('fx', { kind: 'wrong', playerId: 'p1' });
          expect(vibrate).not.toHaveBeenCalled();
          socket.fire('fx', { kind: 'timeUp', playerId: 'p1' });
          expect(vibrate).toHaveBeenCalledOnce();
        });

        it('never vibrates for a time up that arrived before the remote showed', () => {
          const vibrate = stubVibrate();
          const { socket } = renderHost(`/host/WXYZ#t=${TOKEN}`);
          act(() => socket.emitted[0]!.ack({ ok: true }));
          socket.fire('fx', { kind: 'timeUp', playerId: 'p1' });
          socket.fire('state', timed(true));
          expect(timer()).toBeTruthy();
          expect(vibrate).not.toHaveBeenCalled();
          socket.fire('fx', { kind: 'timeUp', playerId: 'p1' });
          expect(vibrate).toHaveBeenCalledOnce();
        });

        it('with the timer off, Correct / Wrong look as before: no countdown', () => {
          remote(buzzed(true));
          expect(screen.getByRole('button', { name: 'Correct' })).toBeTruthy();
          expect(timer()).toBeNull();
        });
      });

      it('while the buzzers wait to reopen it says so and cannot judge', () => {
        remote(buzzed(false));
        expect(screen.queryByRole('button', { name: 'Correct' })).toBeNull();
        const waiting = screen.getByRole('button', { name: 'Reopening buzzers…' });
        expect((waiting as HTMLButtonElement).disabled).toBe(true);
      });
    });

    it('is absent in FINAL', () => {
      remote(inPhase('FINAL'));
      expect(screen.queryByRole('button', { name: PRIMARY_LABELS })).toBeNull();
    });

    it('cycles through the game as each new state arrives', () => {
      const socket = remote(hostView({ players: [player(1)] }));
      const labels = [primary().textContent];
      for (const view of [inPhase('QUESTION'), inPhase('OPEN'), inPhase('REVEAL')]) {
        socket.fire('state', view);
        labels.push(primary().textContent);
      }
      expect(labels).toEqual(['Start game', 'Open buzzers', 'Reveal answer', 'Next question']);
    });

    it('sends once on a double tap, and is enabled again by the next state', () => {
      const socket = remote(inPhase('QUESTION'));
      fireEvent.click(primary());
      fireEvent.click(primary());
      expect(socket.emitted.filter((e) => e.event === 'host:open')).toHaveLength(1);
      expect((primary() as HTMLButtonElement).disabled).toBe(true);
      socket.fire('state', inPhase('OPEN'));
      expect((primary() as HTMLButtonElement).disabled).toBe(false);
    });

    it('stays disabled after an ok ack until the new state arrives', () => {
      const socket = remote(inPhase('REVEAL'));
      fireEvent.click(primary());
      act(() => socket.emitted.at(-1)!.ack({ ok: true }));
      fireEvent.click(primary());
      expect(socket.emitted.filter((e) => e.event === 'host:next')).toHaveLength(1);
      socket.fire('state', inPhase('QUESTION', 1));
      expect((primary() as HTMLButtonElement).disabled).toBe(false);
    });

    it('a rejected ack shows a brief toast and enables the button again', () => {
      vi.useFakeTimers();
      const socket = remote(inPhase('REVEAL'));
      fireEvent.click(primary());
      act(() => socket.emitted.at(-1)!.ack({ ok: false, error: 'Not allowed in this phase' }));
      expect(screen.getByRole('alert').textContent).toBe('Not allowed in this phase');
      expect((primary() as HTMLButtonElement).disabled).toBe(false);
      act(() => vi.advanceTimersByTime(TOAST_MS));
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('a second rejection while a toast shows restarts its timer', () => {
      vi.useFakeTimers();
      const socket = remote(hostView());
      fireEvent.click(primary());
      act(() => socket.emitted.at(-1)!.ack({ ok: false, error: 'Wait' }));
      act(() => vi.advanceTimersByTime(TOAST_MS - 1000));
      fireEvent.click(primary());
      act(() => socket.emitted.at(-1)!.ack({ ok: false, error: 'Wait' }));
      act(() => vi.advanceTimersByTime(TOAST_MS - 1000));
      expect(screen.getByRole('alert').textContent).toBe('Wait');
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('connection dot', () => {
    it('is green while connected, amber while reconnecting and red after 5 s down', () => {
      const { socket } = renderHost(`/host/WXYZ#t=${TOKEN}`);
      act(() => socket.emitted[0]!.ack({ ok: true }));
      socket.fire('state', hostView());
      const dot = () => within(screen.getByRole('banner')).getByRole('status');
      expect(dot().getAttribute('aria-label')).toBe('Connected');

      vi.useFakeTimers();
      try {
        socket.fire('disconnect', 'transport close');
        expect(dot().getAttribute('aria-label')).toBe('Reconnecting…');
        act(() => vi.advanceTimersByTime(OFFLINE_AFTER_MS));
        expect(dot().getAttribute('aria-label')).toBe('Offline');
        socket.fire('connect');
        expect(dot().getAttribute('aria-label')).toBe('Connected');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

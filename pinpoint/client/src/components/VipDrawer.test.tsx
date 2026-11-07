// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSettings, Phase, PublicPlayer } from '#shared/types.js';
import { vipControls } from '../../../server/views.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { CONFIRM_MS, VipDrawer } from './VipDrawer.js';

let socket: FakeSocket;
let onClose: () => void;

const player = (id: string, name: string, emoji: string, connected = true): PublicPlayer => ({
  id,
  name,
  emoji,
  color: '#56B4E9',
  connected,
  waiting: false,
  isVip: id === 'p1',
  total: 0,
  rank: 1,
});
const PLAYERS = [
  player('p1', 'Mika', '🦊'),
  player('p2', 'Ana', '🐸'),
  player('p3', 'Sam', '🐙', false),
];

const SETTINGS: GameSettings = {
  categoryId: 'japan',
  mode: 'name',
  difficulty: 'mixed',
  rounds: 10,
  timerSeconds: 30,
};

function renderDrawer(phase: Phase, paused = false, players: PublicPlayer[] = [], played = 0) {
  render(
    <VipDrawer
      phase={phase}
      controls={vipControls(phase, paused, false)}
      players={players}
      meId="p1"
      settings={SETTINGS}
      played={played}
      socket={socket.asSocket()}
      onClose={onClose}
    />,
  );
}
const buttons = () => screen.getAllByRole('button').map((b) => b.textContent);

beforeEach(() => {
  socket = new FakeSocket();
  onClose = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('VipDrawer controls per phase', () => {
  it.each([
    ['INTRO', false, ['Pause', 'Skip round', 'End game']],
    ['GUESSING', true, ['Resume', 'Skip round', 'End game']],
    ['REVEAL', false, ['Next', 'Pause', 'Skip round', 'End game']],
    ['SCOREBOARD', false, ['Next', 'Pause', '20 s', '30 s', '45 s', '5', '10', '15', 'End game']],
  ] as const)('%s (paused: %s)', (phase, paused, expected) => {
    renderDrawer(phase, paused);
    expect(buttons()).toEqual(expected);
  });

  it('sends a one-tap control at once and closes when it lands', () => {
    renderDrawer('REVEAL');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(socket.emitted.map((e) => e.event)).toEqual(['vip:next']);
    act(() => socket.emitted[0]!.ack({ ok: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows a refusal and stays open', () => {
    renderDrawer('GUESSING');
    fireEvent.click(screen.getByRole('button', { name: 'Skip round' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to skip' }));
    act(() => socket.emitted[0]!.ack({ ok: false, error: 'No spare places left at Hard' }));
    expect(screen.getByRole('alert').textContent).toBe('No spare places left at Hard');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape and on a tap outside the sheet', () => {
    renderDrawer('INTRO');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').previousElementSibling!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('VipDrawer two-tap confirm', () => {
  it('Skip round arms on the first tap and sends on the second', () => {
    renderDrawer('GUESSING');
    fireEvent.click(screen.getByRole('button', { name: 'Skip round' }));
    expect(socket.emitted).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to skip' }));
    expect(socket.emitted.map((e) => e.event)).toEqual(['vip:skipRound']);
  });

  it('reads "Tap again to void this round" in REVEAL, and End game asks too', () => {
    renderDrawer('REVEAL');
    fireEvent.click(screen.getByRole('button', { name: 'Skip round' }));
    expect(screen.getByRole('button', { name: 'Tap again to void this round' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'End game' }));
    // Arming one control disarms the other.
    expect(buttons()).toEqual(['Next', 'Pause', 'Skip round', 'Tap again to end the game']);
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to end the game' }));
    expect(socket.emitted.map((e) => e.event)).toEqual(['vip:end']);
  });

  it('resets after 3 s', () => {
    vi.useFakeTimers();
    renderDrawer('INTRO');
    fireEvent.click(screen.getByRole('button', { name: 'End game' }));
    act(() => vi.advanceTimersByTime(CONFIRM_MS - 1));
    expect(screen.getByRole('button', { name: 'Tap again to end the game' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    fireEvent.click(screen.getByRole('button', { name: 'End game' }));
    expect(socket.emitted).toEqual([]);
  });
});

describe('VipDrawer Players', () => {
  it('lists everyone but the VIP where the spec has Players, and not in REVEAL', () => {
    renderDrawer('GUESSING', false, PLAYERS);
    const list = within(screen.getByRole('region', { name: 'Players' }));
    expect(list.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '🐸AnaKick',
      '🐙SamKick',
    ]);
    cleanup();
    renderDrawer('SCOREBOARD', false, PLAYERS);
    expect(screen.getByRole('region', { name: 'Players' })).toBeTruthy();
    cleanup();
    renderDrawer('REVEAL', false, PLAYERS);
    expect(screen.queryByRole('region', { name: 'Players' })).toBeNull();
  });

  it('kicks with two taps: the first arms only that row', () => {
    renderDrawer('GUESSING', false, PLAYERS);
    fireEvent.click(screen.getByRole('button', { name: 'Kick Ana' }));
    expect(socket.emitted).toEqual([]);
    expect(screen.getByRole('button', { name: 'Kick Sam' })).toBeTruthy();
    expect(screen.getByText('Tap again to kick Ana', { selector: '[aria-live]' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to kick' }));
    expect(socket.emitted.map((e) => [e.event, e.payload])).toEqual([
      ['vip:kick', { playerId: 'p2' }],
    ]);
    act(() => socket.emitted[0]!.ack({ ok: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('says so when nobody else is in the room', () => {
    renderDrawer('SCOREBOARD', false, [PLAYERS[0]!]);
    expect(screen.getByText('No other players')).toBeTruthy();
  });
});

describe('VipDrawer Round settings', () => {
  const pressed = (group: string) =>
    within(screen.getByRole('group', { name: group }))
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent);

  it('shows the timer and total rounds on SCOREBOARD only', () => {
    renderDrawer('SCOREBOARD', false, [], 4);
    expect(screen.getByRole('heading', { name: 'Round settings' })).toBeTruthy();
    expect(pressed('Timer')).toEqual(['30 s']);
    expect(pressed('Rounds')).toEqual(['10']);
    cleanup();
    for (const phase of ['INTRO', 'GUESSING', 'REVEAL'] as const) {
      renderDrawer(phase);
      expect(screen.queryByRole('heading', { name: 'Round settings' })).toBeNull();
      cleanup();
    }
  });

  it('disables a total at or below the rounds played, with the reason', () => {
    renderDrawer('SCOREBOARD', false, [], 5);
    const rounds = within(screen.getByRole('group', { name: 'Rounds' }));
    expect((rounds.getByRole('button', { name: '5' }) as HTMLButtonElement).disabled).toBe(true);
    expect((rounds.getByRole('button', { name: '15' }) as HTMLButtonElement).disabled).toBe(false);
    expect(rounds.getByText('5 rounds already played')).toBeTruthy();
  });

  it('sends one change at a time and stays open; a refusal shows', () => {
    renderDrawer('SCOREBOARD', false, [], 4);
    fireEvent.click(screen.getByRole('button', { name: '45 s' }));
    expect(socket.emitted[0]).toMatchObject({
      event: 'vip:roundSettings',
      payload: { timerSeconds: 45 },
    });
    act(() => socket.emitted[0]!.ack({ ok: true }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // While it is sending, no other option can be tapped.
    expect((screen.getByRole('button', { name: '20 s' }) as HTMLButtonElement).disabled).toBe(true);
    expect(socket.emitted[1]).toMatchObject({
      event: 'vip:roundSettings',
      payload: { rounds: 15 },
    });
    const refusal = 'Japan · Medium has 4 cities left; the rest of the game needs 5.';
    act(() => socket.emitted[1]!.ack({ ok: false, error: refusal }));
    // Under the Round settings controls, not below End game.
    const section = screen.getByRole('region', { name: 'Round settings' });
    expect(within(section).getByRole('alert').textContent).toBe(refusal);
    expect(onClose).not.toHaveBeenCalled();
  });
});

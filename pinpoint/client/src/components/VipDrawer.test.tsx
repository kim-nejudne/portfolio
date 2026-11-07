// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Phase, PublicPlayer } from '#shared/types.js';
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

function renderDrawer(phase: Phase, paused = false, players: PublicPlayer[] = []) {
  render(
    <VipDrawer
      phase={phase}
      controls={vipControls(phase, paused, false)}
      players={players}
      meId="p1"
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
    ['SCOREBOARD', false, ['Next', 'Pause', 'End game']],
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

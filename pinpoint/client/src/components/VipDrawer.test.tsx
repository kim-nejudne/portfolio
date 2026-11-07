// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Phase } from '#shared/types.js';
import { vipControls } from '../../../server/views.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { CONFIRM_MS, VipDrawer } from './VipDrawer.js';

let socket: FakeSocket;
let onClose: () => void;

function renderDrawer(phase: Phase, paused = false) {
  render(
    <VipDrawer
      phase={phase}
      controls={vipControls(phase, paused, false)}
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

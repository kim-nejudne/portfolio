// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetRoomStore, useRoomStore } from '../lib/roomStore.js';
import { PairHostPhone } from './PairHostPhone.js';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr" data-value={value} />,
}));

afterEach(() => {
  cleanup();
  resetRoomStore();
});

const dialog = () => screen.queryByRole('dialog', { name: 'Pair host phone' });

function renderPairing() {
  render(
    <PairHostPhone
      code="WXYZ"
      hostToken={'h'.repeat(43)}
      className="text-lg"
      dialogClassName="text-lg"
      qrSize="200px"
    />,
  );
  const button = screen.getByRole('button', { name: 'Pair host phone' });
  return {
    button,
    open: () => {
      button.focus();
      fireEvent.click(button);
    },
  };
}

const hostJoined = () =>
  act(() => useRoomStore.setState((state) => ({ hostJoins: state.hostJoins + 1 })));

describe('PairHostPhone', () => {
  it('the button opens a modal dialog with the QR, the countdown and Hide', () => {
    const { button, open } = renderPairing();
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dialog()).toBeNull();
    open();
    const pairing = dialog()!;
    expect(pairing.getAttribute('aria-modal')).toBe('true');
    expect(within(pairing).getByTestId('qr').dataset.value).toContain('/host/WXYZ#t=');
    expect(within(pairing).getByText('Hides in 60 s')).toBeTruthy();
    expect(within(pairing).getByRole('button', { name: 'Hide' })).toBeTruthy();
  });

  it('moves focus to Hide, keeps Tab there, and gives focus back to the button on close', () => {
    const { button, open } = renderPairing();
    open();
    const hide = within(dialog()!).getByRole('button', { name: 'Hide' });
    expect(document.activeElement).toBe(hide);
    fireEvent.keyDown(hide, { key: 'Tab' });
    expect(document.activeElement).toBe(hide);
    fireEvent.click(hide);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('Esc closes it, and the page behind does not see that Esc', () => {
    const behind = vi.fn();
    window.addEventListener('keydown', behind);
    const { open } = renderPairing();
    open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(behind).not.toHaveBeenCalled();
    // Closed, it no longer swallows Esc.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(behind).toHaveBeenCalledOnce();
    window.removeEventListener('keydown', behind);
  });

  it('closes as soon as another host device joins', () => {
    const { open } = renderPairing();
    open();
    hostJoined();
    expect(dialog()).toBeNull();
  });

  it('a host that joined while it was closed does not stop it from opening', () => {
    const { open } = renderPairing();
    hostJoined();
    open();
    expect(dialog()).not.toBeNull();
  });

  it('closes at the 60 s deadline', () => {
    vi.useFakeTimers();
    const { open } = renderPairing();
    open();
    act(() => vi.advanceTimersByTime(59_000));
    expect(dialog()).not.toBeNull();
    act(() => vi.advanceTimersByTime(1_000));
    expect(dialog()).toBeNull();
    vi.useRealTimers();
  });
});

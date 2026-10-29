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

  it('links to the join origin from the server, with the page port', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ joinOrigin: 'http://192.168.1.20' }))),
    );
    try {
      const { open } = renderPairing();
      // Let the config request settle before the dialog opens.
      await act(async () => {});
      open();
      expect(within(dialog()!).getByTestId('qr').dataset.value).toBe(
        `http://192.168.1.20:${window.location.port}/host/WXYZ#t=${'h'.repeat(43)}`,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falls back to the page origin when the server has no address', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ joinOrigin: null }))),
    );
    try {
      const { open } = renderPairing();
      await act(async () => {});
      open();
      expect(within(dialog()!).getByTestId('qr').dataset.value).toBe(
        `${window.location.origin}/host/WXYZ#t=${'h'.repeat(43)}`,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  /** Answers the config request with no address and each pairing request with the next PIN. */
  function stubPins(...pins: (string | Error)[]) {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) => {
      if (url === '/api/config') return Promise.resolve(Response.json({ joinOrigin: null }));
      const pin = pins.shift();
      return pin instanceof Error || pin === undefined
        ? Promise.resolve(Response.json({ ok: false, error: 'No' }, { status: 401 }))
        : Promise.resolve(Response.json({ pin }, { status: 201 }));
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  const pinText = () => within(dialog()!).queryByTestId('pairing-pin')?.textContent;

  it('shows a 6-digit PIN from the server beside the QR, with the address to type it at', async () => {
    const fetch = stubPins('012345');
    try {
      const { open } = renderPairing();
      await act(async () => {});
      open();
      expect(pinText()).toBe('··· ···');
      await act(async () => {});
      expect(pinText()).toBe('012 345');
      expect(within(dialog()!).getByText(`${window.location.host}/host/WXYZ`)).toBeTruthy();
      const call = fetch.mock.calls.find(([url]) => url === '/api/rooms/WXYZ/pairing')!;
      expect(call[1]?.headers).toEqual({ authorization: `Bearer ${'h'.repeat(43)}` });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('asks for a new PIN each time it opens, and ignores a late answer for the last opening', async () => {
    const answers: ((pin: string) => void)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/api/config'
          ? Promise.resolve(Response.json({ joinOrigin: null }))
          : new Promise<Response>((resolve) =>
              answers.push((pin) => resolve(Response.json({ pin }, { status: 201 }))),
            ),
      ),
    );
    try {
      const { open } = renderPairing();
      await act(async () => {});
      open();
      fireEvent.click(within(dialog()!).getByRole('button', { name: 'Hide' }));
      open();
      expect(answers).toHaveLength(2);
      await act(async () => answers[1]!('222222'));
      expect(pinText()).toBe('222 222');
      // The first opening's answer arrives last; the dialog keeps the PIN that is live on the server.
      await act(async () => answers[0]!('111111'));
      expect(pinText()).toBe('222 222');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('says the PIN is unavailable when the server cannot make one, and keeps the QR', async () => {
    stubPins(new Error('refused'));
    try {
      const { open } = renderPairing();
      await act(async () => {});
      open();
      await act(async () => {});
      expect(within(dialog()!).getByText('PIN unavailable. Use the QR.')).toBeTruthy();
      expect(pinText()).toBeUndefined();
      expect(within(dialog()!).getByTestId('qr')).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
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

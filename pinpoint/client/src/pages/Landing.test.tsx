// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Landing, NETWORK_ERROR, UNKNOWN_CODE_ERROR } from './Landing.js';

function Where({ page }: { page: string }) {
  return <p>{`${page} ${useParams().code}`}</p>;
}

function renderLanding() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/play/:code" element={<Where page="play" />} />
        <Route path="/screen/:code" element={<Where page="screen" />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const codeInput = () => screen.getByLabelText('Room code') as HTMLInputElement;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Landing', () => {
  it('shows the wordmark, the line and both choices, with no admin link', () => {
    renderLanding();
    expect(screen.getByRole('img', { name: 'Pinpoint' })).toBeTruthy();
    expect(screen.getByText('Find it on the map. Closest pin wins.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Join a game' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Show a game on this screen' })).toBeTruthy();
    expect(screen.getByText('Use the device everyone can see: a laptop on the TV.')).toBeTruthy();
    expect(document.querySelector('a[href*="admin"]')).toBeNull();
  });

  it('upper-cases the code, drops non-letters and stops at 4 letters', () => {
    renderLanding();
    fireEvent.change(codeInput(), { target: { value: 'ab-c1de' } });
    expect(codeInput().value).toBe('ABCD');
  });

  it('keeps Join disabled until the code has 4 letters', () => {
    renderLanding();
    const joinButton = screen.getByRole('button', { name: 'Join' }) as HTMLButtonElement;
    fireEvent.change(codeInput(), { target: { value: 'abc' } });
    expect(joinButton.disabled).toBe(true);
    fireEvent.change(codeInput(), { target: { value: 'abcd' } });
    expect(joinButton.disabled).toBe(false);
  });

  it('opens /play/:code for a live room', async () => {
    const fetch = stubFetch(200, { exists: true, phase: 'LOBBY', full: false });
    renderLanding();
    fireEvent.change(codeInput(), { target: { value: 'wxyz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByText('play WXYZ')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/rooms/WXYZ/exists');
  });

  it('says "No game with that code" for an unknown code and stays put', async () => {
    stubFetch(200, { exists: false, phase: null, full: false });
    renderLanding();
    fireEvent.change(codeInput(), { target: { value: 'wxyz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect((await screen.findByRole('alert')).textContent).toBe(UNKNOWN_CODE_ERROR);
    expect(screen.queryByText(/^play/)).toBeNull();
  });

  it('shows the server error text when the lookup is rate limited', async () => {
    stubFetch(429, { error: 'Too many tries. Wait a minute and try again.' });
    renderLanding();
    fireEvent.change(codeInput(), { target: { value: 'wxyz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Too many tries. Wait a minute and try again.',
    );
  });

  it('Show creates a room and opens /screen/:code', async () => {
    const fetch = stubFetch(201, { code: 'QRST' });
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(await screen.findByText('screen QRST')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/rooms', { method: 'POST' });
  });

  it('Show reports a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect((await screen.findByRole('alert')).textContent).toBe(NETWORK_ERROR);
  });
});

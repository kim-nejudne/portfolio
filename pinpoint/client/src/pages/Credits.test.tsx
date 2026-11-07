// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreditsResponse } from '#shared/types.js';
import { AppRoutes } from '../App.js';
import { GAME_ENDED, NO_CREDITS } from './Credits.js';
import { NETWORK_ERROR } from './Landing.js';

function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function renderCredits(code = 'ABCD') {
  render(
    <MemoryRouter initialEntries={[`/credits/${code}`]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const CREDITS: CreditsResponse = {
  credits: [
    {
      name: 'Tokyo Tower',
      author: 'Jane Doe',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      commonsFile: 'File:Tokyo Tower.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tokyo_Tower.jpg',
      thumbUrl: '/api/credits/ABCD/0/thumb',
    },
    {
      name: 'Golden Gate Bridge',
      author: 'John Roe',
      licence: 'CC0',
      licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      commonsFile: 'File:GGB.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:GGB.jpg',
      thumbUrl: '/api/credits/ABCD/2/thumb',
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Credits', () => {
  it("lists each revealed photo's thumbnail, place, author, licence link and Commons page", async () => {
    const fetch = stubFetch(200, CREDITS);
    renderCredits();
    expect(screen.getByRole('heading', { level: 1, name: 'Photo credits' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    const items = await screen.findAllByRole('listitem');
    expect(fetch).toHaveBeenCalledWith('/api/credits/ABCD');
    expect(items).toHaveLength(2);
    const [first] = items;
    expect(first!.querySelector('img')!.getAttribute('src')).toBe('/api/credits/ABCD/0/thumb');
    expect(first!.querySelector('h2')!.textContent).toBe('Tokyo Tower');
    expect(first!.textContent).toContain('Jane Doe');
    const licence = screen.getByRole('link', { name: 'CC BY-SA 4.0' });
    expect(licence.getAttribute('href')).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
    const page = screen.getByRole('link', { name: 'File:Tokyo Tower.jpg' });
    expect(page.getAttribute('href')).toBe(
      'https://commons.wikimedia.org/wiki/File:Tokyo_Tower.jpg',
    );
    expect(page.getAttribute('rel')).toBe('noreferrer');
    expect(screen.getByRole('link', { name: 'CC0' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('never makes a non-https address a link', async () => {
    const [first] = CREDITS.credits;
    stubFetch(200, { credits: [{ ...first, licenceUrl: 'javascript:alert(1)' }] });
    renderCredits();
    expect(await screen.findByText('CC BY-SA 4.0')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'CC BY-SA 4.0' })).toBeNull();
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.queryByText(NO_CREDITS)).toBeNull();
  });

  it('shows "Photo unavailable" in place of a thumbnail that fails', async () => {
    stubFetch(200, CREDITS);
    renderCredits();
    const [img] = await screen.findAllByRole('img', { name: 'Tokyo Tower' });
    fireEvent.error(img!);
    expect(screen.getByText('Photo unavailable')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Golden Gate Bridge' })).toBeTruthy();
  });

  it('says "No photos revealed yet" when nothing has been revealed', async () => {
    stubFetch(200, { credits: [] });
    renderCredits();
    expect(await screen.findByText(NO_CREDITS)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('says the game has ended for an unknown room, and shows other errors', async () => {
    stubFetch(404, { error: 'No such game.' });
    renderCredits('WXYZ');
    expect(await screen.findByText(GAME_ENDED)).toBeTruthy();
    cleanup();
    stubFetch(429, { error: 'Too many tries. Wait a minute and try again.' });
    renderCredits();
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeTruthy();
    cleanup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    renderCredits();
    expect(await screen.findByText(NETWORK_ERROR)).toBeTruthy();
  });
});

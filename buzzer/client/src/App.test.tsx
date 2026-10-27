// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function headingAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return screen.getByRole('heading', { level: 1 }).textContent;
}

describe('AppRoutes', () => {
  it.each([
    ['/', 'Buzzr'],
    ['/sets/set-1', 'Edit set'],
    ['/nowhere', 'Page not found'],
  ])('%s renders the %s page', (path, heading) => {
    expect(headingAt(path)).toBe(heading);
  });

  it('/sets loads the My question sets page, which reports a browser without IndexedDB', async () => {
    // jsdom has no IndexedDB, like some private browsing modes.
    render(
      <MemoryRouter initialEntries={['/sets']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('My question sets');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not load the saved sets in this browser.',
    );
  });

  it('/play/:code renders the Player page, which first checks the room', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    expect(headingAt('/play/ABCD')).toBe('Checking the room…');
  });

  it('/host/:code renders the Host remote, which refuses a device without a token', () => {
    expect(headingAt('/host/ABCD')).toBe('Not authorised');
  });

  it('passes the route parameter from the URL to the page', () => {
    headingAt('/sets/set-1');
    expect(screen.getByText('set-1')).toBeTruthy();
  });

  it('/dev/bots/:code renders the bots page in development', async () => {
    render(
      <MemoryRouter initialEntries={['/dev/bots/ABCD']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Bots for ABCD');
  });

  it('has no /dev/bots route in a production build', async () => {
    vi.stubEnv('DEV', false);
    vi.resetModules();
    const { AppRoutes: ProdRoutes } = await import('./App.js');
    render(
      <MemoryRouter initialEntries={['/dev/bots/ABCD']}>
        <ProdRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Page not found');
  });
});

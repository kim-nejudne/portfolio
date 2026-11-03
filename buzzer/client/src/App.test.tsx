// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App.js';
import { CATEGORIES, catalog, signedIn, stubServer } from './test/adminServer.js';
import { resetAdminSession } from './lib/adminSession.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetAdminSession();
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
    ['/nowhere', 'Page not found'],
  ])('%s renders the %s page', (path, heading) => {
    expect(headingAt(path)).toBe(heading);
  });

  it('/sets loads the Question sets page, which reports a browser without IndexedDB', async () => {
    // jsdom has no IndexedDB, like some private browsing modes.
    render(
      <MemoryRouter initialEntries={['/sets']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Question sets');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not load the saved sets in this browser.',
    );
  });

  it('/admin loads the Admin page, which first checks the session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: false, error: 'Not found.' }, { status: 404 })),
    );
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Admin');
  });

  it('/admin/categories/:name loads the page inside the lazy admin layout, header and all (F119)', async () => {
    stubServer({ 'GET /api/admin/session': [signedIn], [CATEGORIES]: [catalog()] });
    render(
      <MemoryRouter initialEntries={['/admin/categories/Rivers']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Review Rivers' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Buzzr Admin' }).getAttribute('href')).toBe('/admin');
  });

  it('/admin/sets/:setId keeps the built-in editor outside the admin layout', async () => {
    stubServer({ 'GET /api/admin/session': [signedIn] });
    render(
      <MemoryRouter initialEntries={['/admin/sets/riv-e']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Buzzr Admin' })).toBeNull();
  });

  it('/play/:code renders the Player page, which first checks the room', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    expect(headingAt('/play/ABCD')).toBe('Checking the room…');
  });

  it('/host/:code renders the Host remote, which asks a device without a token for a PIN', () => {
    expect(headingAt('/host/ABCD')).toBe('Pair this phone');
  });

  it('/sets/:setId loads the set editor, which reports a browser without IndexedDB', async () => {
    render(
      <MemoryRouter initialEntries={['/sets/set-1']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Edit set');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not load this set in this browser.',
    );
  });

  it('/sets/:setId/print loads the answer sheet, which reports a browser without IndexedDB', async () => {
    render(
      <MemoryRouter initialEntries={['/sets/set-1/print']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not load this set in this browser.',
    );
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

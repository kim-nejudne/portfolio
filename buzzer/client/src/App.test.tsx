// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    ['/sets', 'My question sets'],
    ['/sets/set-1', 'Edit set'],
    ['/nowhere', 'Page not found'],
  ])('%s renders the %s page', (path, heading) => {
    expect(headingAt(path)).toBe(heading);
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
});

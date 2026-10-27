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
    ['/host/ABCD', 'Host'],
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

  it('passes the room code from the URL to the page', () => {
    headingAt('/host/WXYZ');
    expect(screen.getByText('WXYZ')).toBeTruthy();
  });
});

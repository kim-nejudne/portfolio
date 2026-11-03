// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminCategory } from '../../../shared/types.js';
import { resetAdminSession } from '../lib/adminSession.js';
import {
  AdminRoutes,
  CATEGORIES,
  RIVERS,
  catalog,
  level,
  signedIn,
  stubServer,
} from '../test/adminServer.js';
import { AdminCategories } from './AdminCategories.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetAdminSession();
});

const MOONS: AdminCategory = {
  name: 'Moons',
  levels: [level({ setId: 'mo-e', title: 'Moons – Easy' })],
  job: null,
  hidden: false,
  emoji: '🌙',
};

describe('Admin category list: emoji (F130)', () => {
  it("shows each category's emoji before its name, and an empty slot for one with none", async () => {
    stubServer({
      'GET /api/admin/session': [signedIn],
      [CATEGORIES]: [catalog([MOONS, { ...RIVERS, emoji: null }])],
    });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminRoutes path="/admin" page={<AdminCategories />} />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Categories' });
    const rows = within(screen.getByRole('list', { name: 'Categories' })).getAllByRole('link');
    const firstSpan = (row: HTMLElement) => row.firstElementChild as HTMLElement;
    const byName = (name: string) => rows.find((r) => r.textContent!.includes(name))!;

    const moons = byName('Moons');
    expect(firstSpan(moons).textContent).toBe('🌙');
    expect(firstSpan(moons).getAttribute('aria-hidden')).toBe('true');
    expect(moons.textContent!.startsWith('🌙Moons')).toBe(true);

    // The slot keeps the names in line even with no emoji.
    const rivers = byName('Rivers');
    expect(firstSpan(rivers).textContent).toBe('');
    expect(firstSpan(rivers).className).toMatch(/w-7/);
    expect(rivers.textContent!.startsWith('Rivers')).toBe(true);
  });
});

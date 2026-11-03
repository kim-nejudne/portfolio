// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetAdminSession } from '../lib/adminSession.js';
import { DESKTOP_QUERY } from '../lib/useMediaQuery.js';
import { BUTTON_PRIMARY } from '../lib/ui.js';
import {
  AdminRoutes,
  CATEGORIES,
  LocationProbe,
  RIVERS,
  catalog,
  json,
  signedIn,
  stubMedia,
  stubServer,
  unstubMedia,
  type Answer,
} from '../test/adminServer.js';
import { Admin } from './Admin.js';
import { AdminCategory } from './AdminCategory.js';
import { AdminLevel } from './AdminLevel.js';
import { AdminLayout, clockTime, HEADER_ROW_QUERY } from './AdminLayout.js';

const signedOut = json({ ok: false, error: 'x' }, 401);

/** A page inside the layout at `url`, as the App routes it. */
function renderAt(path: string, url: string, page = <Admin />) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoutes path={path} page={page} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function serve(session: Answer, routes: Record<string, Answer[]> = {}) {
  return stubServer({ 'GET /api/admin/session': [session], ...routes });
}

const header = () => screen.getByRole('banner');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  unstubMedia();
  resetAdminSession();
});

describe('AdminLayout: the session gate', () => {
  it('shows Checking… while the session loads', () => {
    serve(signedOut);
    renderAt('/admin', '/admin');
    expect(screen.getByText('Checking…')).toBeTruthy();
  });

  it('says admin is not set up when the server answers 404, with no page and no header', async () => {
    serve(json({ ok: false, error: 'Not found.' }, 404));
    renderAt('/admin', '/admin');
    expect(await screen.findByText('Admin sign-in is not set up on this server.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Buzzr Admin' })).toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('offers Retry when the server cannot be reached', async () => {
    serve(signedOut);
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderAt('/admin', '/admin');
    expect((await screen.findByRole('alert')).textContent).toBe('Could not reach the server.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText('Password')).toBeTruthy();
  });

  it('shows the sign-in form alone on /admin', async () => {
    serve(signedOut);
    renderAt('/admin', '/admin');
    expect(await screen.findByLabelText('Password')).toBeTruthy();
    expect(screen.queryByText(/Only the admin/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to start' }).getAttribute('href')).toBe('/');
  });

  it('on an inner page says only the admin can open it, and signing in opens that page', async () => {
    const calls = serve(signedOut, {
      'POST /api/admin/login': [signedIn],
      [CATEGORIES]: [catalog()],
    });
    renderAt('/admin/categories/:name', '/admin/categories/Rivers', <AdminCategory />);
    expect(
      await screen.findByText('Only the admin can open this page. Sign in first.'),
    ).toBeTruthy();
    expect(calls.filter((c) => c.key === CATEGORIES)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'open sesame' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Rivers' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/admin/categories/Rivers');
  });
});

describe('AdminLayout: the header', () => {
  it('from sm: Buzzr Admin, History, Question sets, the session end and Logout in a row', async () => {
    stubMedia(HEADER_ROW_QUERY);
    serve(signedIn, { [CATEGORIES]: [catalog()] });
    renderAt('/admin', '/admin');
    const bar = within(await screen.findByRole('banner'));
    expect(bar.getByRole('link', { name: 'Buzzr Admin' }).getAttribute('href')).toBe('/admin');
    const history = bar.getByRole('link', { name: 'History' });
    expect(history.getAttribute('href')).toBe('/admin/history');
    expect(history.getAttribute('aria-current')).toBeNull();
    expect(bar.getByRole('link', { name: 'Question sets' }).getAttribute('href')).toBe('/sets');
    expect(bar.getByText(/^Signed in until/).textContent).toMatch(/^Signed in until \d/);
    expect(bar.getByRole('button', { name: 'Logout' })).toBeTruthy();
    expect(bar.queryByRole('button', { name: 'Admin menu' })).toBeNull();
    // The old session card and the foot's way home are gone.
    expect(screen.queryByRole('link', { name: 'Back to start' })).toBeNull();
  });

  it('Logout signs out to the form', async () => {
    stubMedia(HEADER_ROW_QUERY);
    serve(signedIn, { [CATEGORIES]: [catalog()], 'POST /api/admin/logout': [json({ ok: true })] });
    renderAt('/admin', '/admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }));
    expect(await screen.findByLabelText('Password')).toBeTruthy();
  });

  it('below sm folds History, Question sets, the session end and Logout into the ⋯ menu', async () => {
    const calls = serve(signedIn, {
      [CATEGORIES]: [catalog()],
      'POST /api/admin/logout': [json({ ok: true })],
    });
    renderAt('/admin', '/admin');
    await screen.findByRole('heading', { name: 'Categories' });
    expect(within(header()).queryByRole('link', { name: 'Question sets' })).toBeNull();
    expect(within(header()).queryByRole('button', { name: 'Logout' })).toBeNull();
    fireEvent.click(within(header()).getByRole('button', { name: 'Admin menu' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'History',
      'Question sets',
      expect.stringMatching(/^Logout \(until \d/),
    ]);
    expect(items[0]!.getAttribute('href')).toBe('/admin/history');
    expect(items[1]!.getAttribute('href')).toBe('/sets');
    fireEvent.click(items[2]!);
    expect(await screen.findByLabelText('Password')).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/admin/logout')).toBe(true);
  });

  it('writes the session end as a clock time', () => {
    const at = new Date(2026, 10, 3, 23, 13).getTime();
    expect(clockTime(at)).toMatch(/^(23:13|11:13\sPM)$/);
  });
});

describe('AdminLayout: panes', () => {
  it('below lg: one pane, /admin is the list with + Add category its only gold button', async () => {
    serve(signedIn, { [CATEGORIES]: [catalog()] });
    renderAt('/admin', '/admin');
    await screen.findByRole('heading', { name: 'Categories' });
    expect(document.querySelector('[data-layout="single"]')).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Categories' })).toBeNull();
    const gold = [...document.querySelectorAll('a, button')].filter((el) =>
      el.className.includes(BUTTON_PRIMARY),
    );
    expect(gold.map((el) => el.textContent)).toEqual(['+ Add category']);
    expect(screen.queryByRole('link', { name: /^←/ })).toBeNull();
  });

  it('below lg: an inner page has a back link under the header', async () => {
    serve(signedIn, { [CATEGORIES]: [catalog()] });
    renderAt('/admin/categories/:name', '/admin/categories/Rivers', <AdminCategory />);
    await screen.findByRole('heading', { level: 1, name: 'Rivers' });
    expect(screen.getByRole('link', { name: '← Categories' }).getAttribute('href')).toBe('/admin');
    // The list is not on this page.
    expect(screen.queryByRole('heading', { name: 'Categories' })).toBeNull();
  });

  it("below lg: a level's back link leads to its category", async () => {
    serve(signedIn);
    renderAt(
      '/admin/categories/:name/:setId',
      '/admin/categories/Rivers%20%26%20Lakes/riv-m',
      <AdminLevel />,
    );
    expect(
      (await screen.findByRole('link', { name: '← Rivers & Lakes' })).getAttribute('href'),
    ).toBe('/admin/categories/Rivers%20%26%20Lakes');
  });

  it('from lg: the list pane beside the open page, each scrolling on its own, with no back link', async () => {
    stubMedia(DESKTOP_QUERY, HEADER_ROW_QUERY);
    serve(signedIn, { [CATEGORIES]: [catalog(), catalog()] });
    renderAt('/admin/categories/:name', '/admin/categories/Rivers', <AdminCategory />);
    const list = await screen.findByRole('complementary', { name: 'Categories' });
    expect(await within(list).findByRole('heading', { name: 'Categories' })).toBeTruthy();
    expect(list.className).toMatch(/overflow-y-auto/);
    const main = screen.getByRole('main');
    expect(main.className).toMatch(/overflow-y-auto/);
    expect(await within(main).findByRole('heading', { level: 1, name: 'Rivers' })).toBeTruthy();
    expect(document.querySelector('[data-layout="panes"]')!.className).toMatch(/h-dvh/);
    expect(screen.queryByRole('link', { name: /^←/ })).toBeNull();
  });

  it('from lg: each scroll pane is positioned, so its sr-only text cannot stretch the window', async () => {
    stubMedia(DESKTOP_QUERY, HEADER_ROW_QUERY);
    serve(signedIn, { [CATEGORIES]: [catalog(), catalog()] });
    renderAt('/admin/categories/:name', '/admin/categories/Rivers', <AdminCategory />);
    const list = await screen.findByRole('complementary', { name: 'Categories' });
    expect(list.className).toMatch(/\brelative\b/);
    expect(screen.getByRole('main').className).toMatch(/\brelative\b/);
  });

  it('from lg: /admin keeps the list on the left and shows the overview on the right', async () => {
    stubMedia(DESKTOP_QUERY, HEADER_ROW_QUERY);
    // The list and the overview each read the categories.
    serve(signedIn, { [CATEGORIES]: [catalog(), catalog()] });
    renderAt('/admin', '/admin');
    const list = await screen.findByRole('complementary', { name: 'Categories' });
    expect(await within(list).findByRole('link', { name: 'Add category' })).toBeTruthy();
    expect(
      await within(screen.getByRole('main')).findByRole('heading', { level: 1, name: 'Overview' }),
    ).toBeTruthy();
    const gold = [...document.querySelectorAll('a, button')].filter((el) =>
      el.className.includes(BUTTON_PRIMARY),
    );
    expect(gold).toHaveLength(1);
  });

  it('from lg: a publish\'s "<name> is live" message shows in the detail pane', async () => {
    stubMedia(DESKTOP_QUERY, HEADER_ROW_QUERY);
    serve(signedIn, { [CATEGORIES]: [catalog(), catalog()] });
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/admin', state: { published: 'Rivers is live: 2 sets published.' } },
        ]}
      >
        <AdminRoutes path="/admin" page={<Admin />} />
      </MemoryRouter>,
    );
    await screen.findByRole('complementary', { name: 'Categories' });
    const main = screen.getByRole('main');
    expect(within(main).getByText('Rivers is live: 2 sets published.')).toBeTruthy();
  });

  it('from lg: Hide from hosts on the open page reads the list again, which badges it Hidden (F126)', async () => {
    stubMedia(DESKTOP_QUERY, HEADER_ROW_QUERY);
    const hidden = catalog([{ ...RIVERS, hidden: true }]);
    // The list and the page each read the categories, then again after the hide.
    serve(signedIn, {
      [CATEGORIES]: [catalog(), catalog(), hidden, hidden],
      'PUT /api/admin/categories/Rivers/hidden': [json({ name: 'Rivers', hidden: true })],
    });
    renderAt('/admin/categories/:name', '/admin/categories/Rivers', <AdminCategory />);
    const list = await screen.findByRole('complementary', { name: 'Categories' });
    const main = screen.getByRole('main');
    fireEvent.click(await within(main).findByRole('button', { name: 'Hide from hosts' }));
    await within(main).findByRole('button', { name: 'Show to hosts' });
    const row = within(list).getByRole('link', { name: /^Rivers/ });
    expect(await within(row).findByText('Hidden')).toBeTruthy();
  });

  it('from lg: the list is read again after the open page moves elsewhere', async () => {
    stubMedia(DESKTOP_QUERY, HEADER_ROW_QUERY);
    const calls = serve(signedIn, { [CATEGORIES]: [catalog(), catalog(), catalog(), catalog()] });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Admin />} />
            <Route path="categories/:name" element={<AdminCategory />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const list = await screen.findByRole('complementary', { name: 'Categories' });
    await within(list).findByRole('heading', { name: 'Categories' });
    // The list and the overview (F121).
    await within(screen.getByRole('main')).findByRole('heading', { name: 'Overview' });
    expect(calls.filter((c) => c.key === CATEGORIES)).toHaveLength(2);
    const row = within(list).getByRole('link', { name: /^Rivers/ });
    expect(row.getAttribute('aria-current')).toBeNull();
    fireEvent.click(row);
    // The list once more, and the category page once.
    await vi.waitFor(() => expect(calls.filter((c) => c.key === CATEGORIES)).toHaveLength(4));
    expect(
      await within(screen.getByRole('main')).findByRole('heading', { level: 1, name: 'Rivers' }),
    ).toBeTruthy();
    expect(within(list).getByRole('heading', { name: 'Categories' })).toBeTruthy();
    // The open category's row is marked in the list that stayed (ADM-02).
    expect(
      within(list)
        .getByRole('link', { name: /^Rivers/ })
        .getAttribute('aria-current'),
    ).toBe('page');
  });
});

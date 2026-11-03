// The admin page (F80): which view each status shows, and the markup of each view. The flows
// themselves run against the server in server/http.admin.test.ts and the F80 playtest.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../App.js';
import { MemoryRouter } from '../../lib/router.js';
import { ADMIN_COPY, AdminBody, AdminFrame, adminView, type AdminView } from './Admin.js';

const status = (configured: boolean, passwordSet: boolean, signedIn: boolean) => ({
  configured,
  passwordSet,
  signedIn,
});

/** The `<input>` tag holding `name="…"`, so attribute order doesn't matter. */
const input = (html: string, name: string) =>
  (html.match(/<input [^>]*>/g) ?? []).find((tag) => tag.includes(`name="${name}"`)) ?? '';

const render = (view: AdminView) =>
  renderToStaticMarkup(
    <AdminFrame view={view}>
      <AdminBody view={view} refresh={() => undefined} setForgot={() => undefined} />
    </AdminFrame>,
  );

describe('adminView', () => {
  it('loads, then follows the status', () => {
    expect(adminView(null, false)).toBe('loading');
    expect(adminView('error', false)).toBe('unreachable');
    expect(adminView(status(false, false, false), false)).toBe('notConfigured');
    expect(adminView(status(true, false, false), false)).toBe('setup');
    expect(adminView(status(true, true, false), false)).toBe('login');
    expect(adminView(status(true, true, true), false)).toBe('shell');
  });

  it('shows Forgot password only to a signed-out admin with a password set', () => {
    expect(adminView(status(true, true, false), true)).toBe('reset');
    expect(adminView(status(true, false, false), true)).toBe('setup');
    expect(adminView(status(true, true, true), true)).toBe('shell');
    expect(adminView(status(false, false, false), true)).toBe('notConfigured');
  });
});

describe('the admin views', () => {
  it('says "Admin not configured" with neither a setup code nor a password', () => {
    const html = render('notConfigured');
    expect(html).toContain('>Admin not configured</h2>');
    expect(html).toContain('SKETCHY_ADMIN_SETUP_CODE');
    expect(html).not.toContain('<input');
  });

  it('setup asks for the setup code and a new password of at least 12 characters', () => {
    const html = render('setup');
    expect(html).toContain(`>${ADMIN_COPY.setupHeading}</h2>`);
    // The code, the password, and the fixed username password managers need.
    expect(html.match(/<input /g)).toHaveLength(3);
    const code = input(html, 'setupCode');
    expect(code).toContain('type="password"');
    // Not a saved password, so managers don't pair it with the new one.
    expect(code).toContain('autoComplete="one-time-code"');
    expect(code).toContain('aria-describedby="admin-setup-error"');
    const password = input(html, 'password');
    expect(password).toContain('type="password"');
    expect(password).toContain('autoComplete="new-password"');
    expect(password).toContain('minLength="12"');
    // The hint is read with the field.
    // The hint and the error line are read with the field.
    expect(password).toMatch(/aria-describedby="[^"]+-hint admin-setup-error"/);
    expect(password).not.toContain('aria-invalid');
    const username = input(html, 'username');
    expect(username).toContain('autoComplete="username"');
    expect(username).toContain('value="admin"');
    expect(username).toContain('tabindex="-1"');
    expect(username).toContain('aria-hidden="true"');
    expect(username).toContain('sr-only');
    expect(html).toContain('At least 12 characters.');
    expect(html).toMatch(/<button type="submit" [^>]*disabled=""[^>]*>Save and sign in</);
    // No way back to a sign-in that can't work yet.
    expect(html).not.toContain(ADMIN_COPY.back);
  });

  it('sign-in asks for the password and offers Forgot password', () => {
    const html = render('login');
    expect(html).toContain('>Sign in</h2>');
    expect(html.match(/<input /g)).toHaveLength(2);
    expect(input(html, 'username')).toContain('autoComplete="username"');
    const password = input(html, 'password');
    expect(password).toContain('type="password"');
    expect(password).toContain('autoComplete="current-password"');
    expect(html).toContain(`>${ADMIN_COPY.forgot}</button>`);
    expect(html).toContain('<p id="admin-login-error" role="alert"');
    expect(password).toContain('aria-describedby="admin-login-error"');
  });

  it('Forgot password takes the setup code and a new password, with a way back', () => {
    const html = render('reset');
    expect(html).toContain('>Forgot password</h2>');
    expect(html).toContain('Everyone signed in is signed out.');
    expect(html.match(/<input /g)).toHaveLength(3);
    expect(input(html, 'setupCode')).toContain('aria-describedby="admin-reset-error"');
    expect(html).toContain(`>${ADMIN_COPY.back}</button>`);
  });

  it('the signed-in shell has Sign out and a wide column; the forms a narrow one', () => {
    const shell = render('shell');
    expect(shell).toMatch(/<button type="button" data-variant="ghost"[^>]*>Sign out</);
    expect(shell).toContain('max-w-5xl');
    expect(shell.match(/<h1/g)).toHaveLength(1);
    expect(render('login')).toContain('max-w-md');
  });

  it('every view is in the sketchbook look: dot paper, Patrick Hand, ink on paper', () => {
    for (const view of [
      'loading',
      'unreachable',
      'notConfigured',
      'setup',
      'login',
      'reset',
      'shell',
    ] as const) {
      const html = render(view);
      expect(html, view).toMatch(/<main class="paper-dots [^"]*bg-paper[^"]*font-hand text-ink"/);
      expect(html, view).toContain(ADMIN_COPY.title);
    }
  });
});

describe('the /admin route', () => {
  it('is in the route table, and lazy (nothing renders before its chunk loads)', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    // The Suspense fallback is null while the lazy chunk loads.
    expect(html).toBe('');
  });
});

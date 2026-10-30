import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Link, matchPath, MemoryRouter, Route, Routes, useParams } from './router.js';

describe('matchPath', () => {
  it('matches a static path', () => {
    expect(matchPath('/', '/')).toEqual({});
    expect(matchPath('/', '/play')).toBeNull();
  });

  it('reads params, decoded', () => {
    expect(matchPath('/play/:code', '/play/ABCD')).toEqual({ code: 'ABCD' });
    expect(matchPath('/dev/bots/:code', '/dev/bots/a%20b')).toEqual({ code: 'a b' });
  });

  it('allows one trailing slash, like react-router', () => {
    expect(matchPath('/play/:code', '/play/ABCD/')).toEqual({ code: 'ABCD' });
  });

  it('needs every segment, and no more', () => {
    expect(matchPath('/play/:code', '/play')).toBeNull();
    expect(matchPath('/play/:code', '/play/')).toBeNull();
    expect(matchPath('/play/:code', '/play/ABCD/x')).toBeNull();
    expect(matchPath('/play/:code', '/screen/ABCD')).toBeNull();
  });

  it('keeps a param it cannot decode as typed', () => {
    expect(matchPath('/play/:code', '/play/%E0%A4%A')).toEqual({ code: '%E0%A4%A' });
  });
});

function Code() {
  return <p>code {useParams().code ?? 'none'}</p>;
}

function render(path: string, extra = false) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/play/:code" element={<Code />} />
        {extra && <Route path="/screen/:code" element={<p>screen</p>} />}
      </Routes>
    </MemoryRouter>,
  );
}

describe('Routes', () => {
  it('renders the first route that matches, with its params', () => {
    expect(render('/')).toBe('<p>home</p>');
    expect(render('/play/WXYZ')).toBe('<p>code WXYZ</p>');
  });

  it('renders nothing for an unknown path, and skips a route left out', () => {
    expect(render('/nope')).toBe('');
    expect(render('/screen/WXYZ')).toBe('');
    expect(render('/screen/WXYZ', true)).toBe('<p>screen</p>');
  });

  it('ignores a query string', () => {
    expect(render('/play/WXYZ?debug=1')).toBe('<p>code WXYZ</p>');
  });

  it('gives no params outside a route', () => {
    expect(
      renderToStaticMarkup(
        <MemoryRouter>
          <Code />
        </MemoryRouter>,
      ),
    ).toBe('<p>code none</p>');
  });
});

describe('Link', () => {
  it('is a plain link to its path', () => {
    expect(
      renderToStaticMarkup(
        <MemoryRouter>
          <Link to="/" className="x">
            Home
          </Link>
        </MemoryRouter>,
      ),
    ).toBe('<a href="/" class="x">Home</a>');
  });
});

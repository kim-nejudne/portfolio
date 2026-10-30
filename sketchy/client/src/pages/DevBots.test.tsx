import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from '../lib/router.js';
import { describe, expect, it } from 'vitest';
import DevBots from './DevBots.js';

// Effects don't run in a static render, so no bot connects here; bots.test.ts covers the bots.
function render(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dev/bots/:code" element={<DevBots />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DevBots page', () => {
  it('opens the panel for a room code, in any case', () => {
    const html = render('/dev/bots/kprw');
    expect(html).toContain('Bots for KPRW');
    expect(html).toContain('Number of bots');
    expect(html).toContain('No bots yet. Spawn some above.');
    expect(html).toContain('href="/screen/KPRW"');
  });

  it('refuses something that is not a room code', () => {
    expect(render('/dev/bots/nope1')).toContain('Not a room code');
  });
});

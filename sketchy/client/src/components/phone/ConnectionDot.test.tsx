import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { translator } from '../../lib/copy.js';
import { ConnectionDot } from './ConnectionDot.js';

const t = translator('en');

describe('the connection dot (F37)', () => {
  it.each([
    ['connected', 'Connected', 'bg-[#2DC653]'],
    ['connecting', 'Reconnecting…', 'bg-[#FFD166]'],
    ['offline', 'Offline', 'bg-[#EF476F]'],
  ] as const)('is %s: labelled "%s", coloured %s', (connection, label, color) => {
    const html = renderToStaticMarkup(<ConnectionDot connection={connection} t={t} />);
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain(`title="${label}"`);
    expect(html).toContain(color);
  });

  it('never takes a tap meant for the view under it', () => {
    const html = renderToStaticMarkup(<ConnectionDot connection="connected" t={t} />);
    expect(html).toContain('pointer-events-none');
  });
});

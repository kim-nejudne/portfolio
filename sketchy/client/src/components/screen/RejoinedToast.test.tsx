// The Screen's "Jun is back (new phone)" (F42).
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { translator } from '../../lib/copy.js';
import { RejoinedToast } from './RejoinedToast.js';

const t = translator('en');

describe('RejoinedToast', () => {
  it('says who is back on a new phone, in a status region', () => {
    const html = renderToStaticMarkup(<RejoinedToast name="Jun" t={t} />);
    expect(html).toContain('Jun is back (new phone)');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('sr-only');
  });

  it('stays mounted, empty and hidden, with nobody back', () => {
    const html = renderToStaticMarkup(<RejoinedToast name={null} t={t} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('sr-only');
    expect(html).not.toContain('back');
  });
});

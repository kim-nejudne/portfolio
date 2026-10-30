// The rematch countdown (F29): "Game 2 starts in 3… 2… 1…" and who draws first, on every device.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { View } from '../../../shared/types.js';
import { translator } from '../lib/copy.js';
import { RematchOverlay } from './RematchOverlay.js';

const t = translator('en');

/** Only the countdown fields are read. */
const view = (rematchInMs: number, gameNumber = 1, first = true) =>
  ({
    rematchInMs,
    gameNumber,
    rematchFirst: first ? { pid: 'p1', name: 'Jun', color: '#3A86FF' } : null,
  }) as unknown as View;

const render = (v: View, variant: 'screen' | 'phone') =>
  renderToStaticMarkup(
    <RematchOverlay view={v} receivedAt={performance.now()} variant={variant} t={t} />,
  );

describe('RematchOverlay', () => {
  it('names the next game and its first drawer, on the Screen and the phone', () => {
    for (const variant of ['screen', 'phone'] as const) {
      const html = render(view(3000), variant);
      expect(html).toContain('Game 2 starts in');
      expect(html).toContain('Jun draws first');
      expect(html).toContain('>3<');
      expect(html).toContain('role="status"');
      // Screen readers hear the seconds once, with the line; the big digit is hidden from them.
      expect(html).toContain('3 seconds');
      expect(html).toContain('aria-hidden="true"');
    }
    expect(render(view(1200, 3), 'phone')).toContain('Game 4 starts in');
    expect(render(view(1200, 3), 'phone')).toContain('>2<');
  });

  it('lets the pointer through on the Screen, but covers the phone', () => {
    expect(render(view(3000), 'screen')).toContain('pointer-events-none');
    expect(render(view(3000), 'phone')).not.toContain('pointer-events-none');
  });

  it('leaves out the first drawer when nobody is connected to draw', () => {
    expect(render(view(3000, 1, false), 'screen')).not.toContain('draws first');
  });
});

// The paused overlay (F28): why the game is held, then the 3-2-1, on the Screen and the phone.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PausedView, View } from '../../../shared/types.js';
import { translator } from '../lib/copy.js';
import { PausedOverlay } from './PausedOverlay.js';

const t = translator('en');

/** Only `paused` and the drawer's name are read. */
const view = (paused: PausedView) => ({ paused, turn: { drawerName: 'Mika' } }) as unknown as View;

const render = (paused: PausedView, variant: 'screen' | 'phone') =>
  renderToStaticMarkup(
    <PausedOverlay view={view(paused)} receivedAt={performance.now()} variant={variant} t={t} />,
  );

describe('PausedOverlay', () => {
  it('says Paused and why, on both the Screen and the phone', () => {
    for (const variant of ['screen', 'phone'] as const) {
      const html = render({ reasons: ['host'], resumeInMs: null }, variant);
      expect(html).toContain('Paused');
      expect(html).toContain('The host paused the game');
      expect(html).toContain('role="status"');
    }
    expect(render({ reasons: ['host', 'drawerAway'], resumeInMs: null }, 'phone')).toContain(
      'Waiting for Mika’s phone…',
    );
  });

  it('shows the 3-2-1 once nothing holds the game', () => {
    const html = render({ reasons: [], resumeInMs: 3000 }, 'phone');
    expect(html).toContain('Back in');
    expect(html).toMatch(/>3<\/p>/);
    expect(html).not.toContain('Paused');
  });

  it('lets the pointer through on the Screen (the host bar sits above), not on the phone', () => {
    expect(render({ reasons: ['host'], resumeInMs: null }, 'screen')).toContain(
      'pointer-events-none',
    );
    expect(render({ reasons: ['host'], resumeInMs: null }, 'phone')).not.toContain(
      'pointer-events-none',
    );
  });
});

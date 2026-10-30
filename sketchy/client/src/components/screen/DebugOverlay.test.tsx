import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PlayerChipView } from '../../../../shared/types.js';
import { DebugReadout } from './DebugOverlay.js';

const chip = (pid: string, name: string): PlayerChipView => ({
  pid,
  name,
  color: '#FF6B35',
  connected: true,
  crown: false,
  isDrawer: false,
  hasDoodle: false,
  guessed: false,
  turnPoints: 0,
  score: null,
  rank: null,
});

describe('DebugReadout', () => {
  it('shows p50 and p95 of send → paint, the same plus the 25 ms flush wait, and each RTT', () => {
    const html = renderToStaticMarkup(
      <DebugReadout
        stats={{ count: 200, p50: 84.4, p95: 161 }}
        offset={12}
        rtt={{ a: 120, b: 38.6 }}
        players={[chip('a', 'Ana'), chip('b', 'Ben'), chip('c', 'Carlo')]}
      />,
    );
    expect(html).toContain('p50 84 ms · p95 161 ms');
    expect(html).toContain('last 200 batches');
    expect(html).toContain('clock offset: 12 ms');
    expect(html).toContain('+ 25 ms avg flush wait: p50 109 ms · p95 186 ms');
    expect(html).toContain('RTT Ana: 120 ms');
    expect(html).toContain('RTT Ben: 39 ms');
    // No sample yet.
    expect(html).toContain('RTT Carlo: –');
  });

  it('says so while there is nothing to measure', () => {
    const html = renderToStaticMarkup(
      <DebugReadout
        stats={{ count: 0, p50: undefined, p95: undefined }}
        offset={undefined}
        rtt={{}}
        players={[]}
      />,
    );
    expect(html).toContain('p50 – · p95 –');
    expect(html).toContain('last 0 batches');
    expect(html).toContain('waiting for the server');
  });
});

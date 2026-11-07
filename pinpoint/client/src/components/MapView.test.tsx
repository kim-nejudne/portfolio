// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORLD_BOX } from '#shared/constants.js';
import { mercatorCentre } from '#shared/geo.js';
import type { ConfigResponse } from '#shared/types.js';
import { reportTileError, resetTiles } from '../lib/tiles.js';
import { MapView } from './MapView.js';

const FALLBACK = {
  url: '/tiles/fallback/{z}/{x}/{y}.png',
  attribution: 'Made with Natural Earth',
  maxNativeZoom: 6,
};
const CARTO = {
  url: 'https://{s}.carto.test/{z}/{x}/{y}{r}.png?key=k',
  attribution: '© OpenStreetMap contributors © CARTO',
  maxNativeZoom: 20,
};

function serveConfig(config: ConfigResponse) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(config))),
  );
}

/** Renders the map and lets the config fetch settle. */
async function renderMap(onLockIn = vi.fn()) {
  render(<MapView box={WORLD_BOX} worldCopyJump onLockIn={onLockIn} />);
  await act(async () => {});
  return onLockIn;
}

beforeEach(() => resetTiles());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MapView', () => {
  it('shows the crosshair at the centre, the zoom buttons and the map landmark', async () => {
    serveConfig({ tiles: CARTO, fallbackTiles: FALLBACK });
    await renderMap();
    expect(screen.getByTestId('crosshair')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy();
    expect(
      screen.getByRole('application', { name: 'Map. Pan to aim the crosshair.' }),
    ).toBeTruthy();
  });

  it('Lock in sends the map centre, as does Enter on the focused map', async () => {
    serveConfig({ tiles: CARTO, fallbackTiles: FALLBACK });
    const onLockIn = await renderMap();
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    const centre = mercatorCentre(WORLD_BOX);
    expect(onLockIn).toHaveBeenCalledTimes(1);
    const sent = onLockIn.mock.calls[0]![0] as { lat: number; lng: number };
    expect(sent.lat).toBeCloseTo(centre.lat, 6);
    expect(sent.lng).toBeCloseTo(centre.lng, 6);
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' });
    expect(onLockIn).toHaveBeenCalledTimes(2);
  });

  it('shows CARTO with its attribution, and switches to the fallback with a badge after 4 errors', async () => {
    serveConfig({ tiles: CARTO, fallbackTiles: FALLBACK });
    const { container } = render(<MapView box={WORLD_BOX} onLockIn={vi.fn()} />);
    await act(async () => {});
    expect(screen.getByText(CARTO.attribution)).toBeTruthy();
    expect(screen.queryByText('Simplified map')).toBeNull();
    expect(container.querySelector('img.leaflet-tile')?.getAttribute('src')).toContain(
      'carto.test',
    );
    act(() => {
      for (let i = 0; i < 4; i++) reportTileError();
    });
    expect(screen.getByText('Simplified map')).toBeTruthy();
    expect(screen.getByText(FALLBACK.attribution)).toBeTruthy();
    expect(container.querySelector('img.leaflet-tile')?.getAttribute('src')).toContain(
      '/tiles/fallback/',
    );
  });

  it('uses the fallback tiles from the start without a CARTO key', async () => {
    serveConfig({ tiles: null, fallbackTiles: FALLBACK });
    await renderMap();
    expect(screen.getByText('Simplified map')).toBeTruthy();
    expect(screen.getByText(FALLBACK.attribution)).toBeTruthy();
  });
});

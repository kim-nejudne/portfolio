import { describe, expect, it, vi } from 'vitest';
import { enterFullscreen, type FullscreenDocument } from './fullscreen.js';

const doc = (
  requestFullscreen: (() => Promise<void>) | undefined,
  fullscreenElement: Element | null = null,
): FullscreenDocument => ({
  fullscreenElement,
  documentElement: requestFullscreen ? { requestFullscreen } : {},
});

describe('enterFullscreen (Tap to start, F37)', () => {
  it('asks for fullscreen on the whole page', () => {
    const request = vi.fn(() => Promise.resolve());
    enterFullscreen(doc(request));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when the page is already fullscreen', () => {
    const request = vi.fn(() => Promise.resolve());
    enterFullscreen(doc(request, {} as Element));
    expect(request).not.toHaveBeenCalled();
  });

  it('carries on where fullscreen is missing (iPhone Safari), refused or throws', async () => {
    expect(() => enterFullscreen(doc(undefined))).not.toThrow();
    const refused = vi.fn(() => Promise.reject(new TypeError('not allowed')));
    enterFullscreen(doc(refused));
    // A rejection left unhandled would fail the run.
    await Promise.resolve();
    expect(refused).toHaveBeenCalledTimes(1);
    expect(() =>
      enterFullscreen(
        doc(() => {
          throw new Error('denied');
        }),
      ),
    ).not.toThrow();
  });
});

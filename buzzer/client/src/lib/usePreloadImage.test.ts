// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePreloadImage } from './usePreloadImage.js';

afterEach(() => vi.unstubAllGlobals());

/** Records every image URL the browser would start loading. */
function stubImages(): string[] {
  const loaded: string[] = [];
  vi.stubGlobal(
    'Image',
    class {
      decoding = 'auto';
      set src(url: string) {
        loaded.push(url);
      }
    },
  );
  return loaded;
}

describe('usePreloadImage', () => {
  it("loads the room's image URL, and the new one when the next image changes", () => {
    const loaded = stubImages();
    const { rerender } = renderHook(({ id }) => usePreloadImage('WXYZ', id), {
      initialProps: { id: 'img1' as string | null },
    });
    expect(loaded).toEqual(['/api/rooms/WXYZ/images/img1']);
    rerender({ id: 'img1' });
    rerender({ id: 'img2' });
    expect(loaded).toEqual(['/api/rooms/WXYZ/images/img1', '/api/rooms/WXYZ/images/img2']);
  });

  it('loads nothing when the next question has no image', () => {
    const loaded = stubImages();
    renderHook(() => usePreloadImage('WXYZ', null));
    renderHook(() => usePreloadImage('WXYZ', undefined));
    expect(loaded).toEqual([]);
  });
});

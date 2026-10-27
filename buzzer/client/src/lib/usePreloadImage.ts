import { useEffect } from 'react';
import { imageUrl } from './api.js';

/**
 * Fetches the room's image `imageId` ahead of time (Images: Preload), so the next question's image
 * is in the browser cache when it is shown. The server sends a long cache header for it.
 */
export function usePreloadImage(code: string, imageId: string | null | undefined): void {
  useEffect(() => {
    if (!imageId) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = imageUrl(code, imageId);
  }, [code, imageId]);
}

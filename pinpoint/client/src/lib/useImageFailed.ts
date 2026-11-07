import { useEffect, useState } from 'react';

/**
 * Whether `url` failed to load as an image (a round's photo file gone mid-game answers 404). The
 * VIP drawer reads it on its own, since the prompt's thumbnail may not be on screen (locked in).
 */
export function useImageFailed(url: string | null): boolean {
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onerror = () => setFailed(url);
    img.src = url;
    return () => {
      img.onerror = null;
    };
  }, [url]);
  return url !== null && failed === url;
}

import { useEffect, useState } from 'react';
import { getImage } from './db.js';

/** An object URL for a blob in this browser's image table, revoked when no longer shown. */
export function useStoredImageUrl(imageId: string | undefined): string | undefined {
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (imageId === undefined) return;
    let url: string | undefined;
    let live = true;
    getImage(imageId).then(
      (image) => {
        if (!live || !image) return;
        url = URL.createObjectURL(image.blob);
        setLoaded({ id: imageId, url });
      },
      () => {},
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageId]);

  return loaded && loaded.id === imageId ? loaded.url : undefined;
}

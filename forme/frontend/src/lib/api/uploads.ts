import type { StoredFile } from '@forme/domain';
import { apiFetch } from './client';

/**
 * Artwork goes to the API, which validates size and magic bytes, names the file
 * by content hash and queues preflight.
 *
 * The scaffold wrote straight to `.uploads/` in the web process's working
 * directory with no size cap, no type check and a silent overwrite on any name
 * collision. Nothing about that survived.
 */
export async function storeArtwork(reference: string, file: File): Promise<StoredFile> {
  const form = new FormData();
  form.append('file', file);

  const { stored } = await apiFetch<{ stored: StoredFile }>(
    `/jobs/${encodeURIComponent(reference)}/artwork`,
    { method: 'POST', body: form },
  );
  return stored;
}

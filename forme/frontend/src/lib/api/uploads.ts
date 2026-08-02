import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StoredFile } from '@/lib/types';

/**
 * Uploads go to the local filesystem. No object store, no platform blob service.
 */
const UPLOAD_DIR = join(process.cwd(), '.uploads');

function safeName(reference: string, name: string): string {
  return `${reference}_${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export async function storeArtwork(reference: string, file: File): Promise<StoredFile> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = safeName(reference, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOAD_DIR, name), buffer);
  return { name, bytes: buffer.byteLength, at: new Date().toISOString() };
}

export async function listStoredArtwork(): Promise<readonly StoredFile[]> {
  try {
    const names = await readdir(UPLOAD_DIR);
    const files = await Promise.all(
      names.map(async (name) => {
        const info = await stat(join(UPLOAD_DIR, name));
        return { name, bytes: info.size, at: info.mtime.toISOString() };
      }),
    );
    return files.sort((a, b) => b.at.localeCompare(a.at));
  } catch {
    return [];
  }
}

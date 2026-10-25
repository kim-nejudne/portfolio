// §7 Content versions: "`contentVersion` is the content tree's hash at build time, recorded in
// exports so a mismatch can be shown on import". SHA-256 over every file under content/, in
// path order, each framed as its relative path and its bytes with their lengths, so the same
// tree always gives the same digest and any change to a path or a byte gives another. The Vite
// plugin serves it to the app as `virtual:ts-dojo/content-version`; the e2e tests compute it
// here to compare with what the store recorded.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface ContentFile {
  /** Relative to the content directory, with `/` separators. */
  path: string;
  bytes: Uint8Array;
}

export function hashContentTree(files: readonly ContentFile[]): string {
  const hash = createHash('sha256');
  const sorted = [...files].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
  for (const file of sorted) {
    const name = Buffer.from(file.path, 'utf8');
    hash.update(`${String(name.length)}:`);
    hash.update(name);
    hash.update(`${String(file.bytes.length)}:`);
    hash.update(file.bytes);
  }
  return hash.digest('hex');
}

/** Every file under `dir`, read with its relative path. */
export async function readContentTree(dir: string): Promise<ContentFile[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  return Promise.all(
    files.map(async (entry) => {
      const full = path.join(entry.parentPath, entry.name);
      return {
        path: path.relative(dir, full).split(path.sep).join('/'),
        bytes: await readFile(full),
      };
    }),
  );
}

export async function contentVersion(dir: string): Promise<string> {
  return hashContentTree(await readContentTree(dir));
}

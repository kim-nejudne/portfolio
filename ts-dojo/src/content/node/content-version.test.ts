// §7 Content versions: "`contentVersion` is the content tree's hash at build time". The hash
// covers every file under content/ by its relative path and its bytes, so it is the same for
// the same tree whatever order the files are read in, and any one-byte change moves it.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentVersion, hashContentTree } from './content-version';

const CONTENT = path.resolve(import.meta.dirname, '..', '..', '..', 'content');

function copyContent(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'ts-dojo-version-'));
  cpSync(CONTENT, root, { recursive: true });
  return root;
}

describe('contentVersion', () => {
  it('is a SHA-256 hex digest, stable across reads of the same tree', async () => {
    const first = await contentVersion(CONTENT);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(await contentVersion(CONTENT)).toBe(first);
    expect(await contentVersion(copyContent())).toBe(first);
  });

  it('changes when one byte of one file changes, and when a file is added', async () => {
    const before = await contentVersion(CONTENT);
    const edited = copyContent();
    const roadmap = path.join(edited, 'roadmap.yaml');
    writeFileSync(roadmap, `${readFileSync(roadmap, 'utf8')} `);
    expect(await contentVersion(edited)).not.toBe(before);
    const added = copyContent();
    writeFileSync(path.join(added, 'extra.txt'), '');
    expect(await contentVersion(added)).not.toBe(before);
  });

  it('does not depend on the order the files come in, and a path is part of the hash', () => {
    const a = { path: 'a.yaml', bytes: Buffer.from('x') };
    const b = { path: 'b.yaml', bytes: Buffer.from('y') };
    expect(hashContentTree([a, b])).toBe(hashContentTree([b, a]));
    expect(hashContentTree([{ path: 'c.yaml', bytes: a.bytes }, b])).not.toBe(
      hashContentTree([a, b]),
    );
    // Path and bytes are framed, so moving a byte between them changes the hash.
    expect(hashContentTree([{ path: 'ab', bytes: Buffer.from('c') }])).not.toBe(
      hashContentTree([{ path: 'a', bytes: Buffer.from('bc') }]),
    );
  });
});

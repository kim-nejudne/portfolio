// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from './db.js';
import { useStoredImageUrl } from './useStoredImageUrl.js';

let created: string[];
let revoked: string[];

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.images.bulkAdd([
    { id: 'img-a', blob: new Blob(['a']) },
    { id: 'img-b', blob: new Blob(['b']) },
  ]);
  created = [];
  revoked = [];
  // jsdom has no object URLs: each one made is numbered, so a revoke can be matched to it.
  Object.assign(URL, {
    createObjectURL: () => {
      const url = `blob:${created.length + 1}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => revoked.push(url),
  });
});

afterEach(cleanup);

describe('stored image URL', () => {
  it('gives an object URL for a stored image, and none for no image or a missing one', async () => {
    const { result, rerender } = renderHook(({ id }) => useStoredImageUrl(id), {
      initialProps: { id: 'img-a' as string | undefined },
    });
    await waitFor(() => expect(result.current).toBe('blob:1'));
    rerender({ id: undefined });
    expect(result.current).toBeUndefined();
    rerender({ id: 'gone' });
    await waitFor(() => expect(revoked).toEqual(['blob:1']));
    expect(result.current).toBeUndefined();
  });

  it('revokes the old URL when the image changes and the last one on unmount', async () => {
    const { result, rerender, unmount } = renderHook(({ id }) => useStoredImageUrl(id), {
      initialProps: { id: 'img-a' },
    });
    await waitFor(() => expect(result.current).toBe('blob:1'));
    rerender({ id: 'img-b' });
    await waitFor(() => expect(result.current).toBe('blob:2'));
    expect(revoked).toEqual(['blob:1']);
    unmount();
    expect(revoked).toEqual(['blob:1', 'blob:2']);
  });
});

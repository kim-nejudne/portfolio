import { describe, expect, it } from 'vitest';
import { InMemoryImageStore } from './imageStore.js';

function image(bytes: number, fill = 0) {
  return { type: 'image/png', data: Buffer.alloc(bytes, fill) };
}

describe('InMemoryImageStore', () => {
  it('keeps each image under its room and id', () => {
    const store = new InMemoryImageStore(100, 1000);
    expect(store.put('ABCD', 'img1', image(10, 1))).toBe('ok');
    expect(store.put('WXYZ', 'img1', image(20, 2))).toBe('ok');
    expect(store.get('ABCD', 'img1')?.data).toEqual(Buffer.alloc(10, 1));
    expect(store.get('WXYZ', 'img1')?.data).toEqual(Buffer.alloc(20, 2));
    expect(store.get('ABCD', 'img2')).toBeUndefined();
    expect(store.totalBytes).toBe(30);
  });

  it('accepts a room up to its cap exactly and refuses one byte more', () => {
    const store = new InMemoryImageStore(100, 1000);
    expect(store.put('ABCD', 'a', image(60))).toBe('ok');
    expect(store.put('ABCD', 'b', image(40))).toBe('ok');
    expect(store.put('ABCD', 'c', image(1))).toBe('room-full');
    expect(store.get('ABCD', 'c')).toBeUndefined();
    expect(store.put('WXYZ', 'c', image(1))).toBe('ok');
  });

  it('counts a replaced image once, so re-uploading the same image fits', () => {
    const store = new InMemoryImageStore(100, 1000);
    store.put('ABCD', 'a', image(60));
    expect(store.put('ABCD', 'a', image(90, 7))).toBe('ok');
    expect(store.get('ABCD', 'a')?.data).toEqual(Buffer.alloc(90, 7));
    expect(store.totalBytes).toBe(90);
    expect(store.put('ABCD', 'b', image(11))).toBe('room-full');
  });

  it('refuses an upload that would take the server past its global cap', () => {
    const store = new InMemoryImageStore(100, 150);
    store.put('ABCD', 'a', image(100));
    expect(store.put('WXYZ', 'a', image(51))).toBe('server-full');
    expect(store.put('WXYZ', 'a', image(50))).toBe('ok');
  });

  it("frees a deleted room's bytes for other rooms", () => {
    const store = new InMemoryImageStore(100, 150);
    store.put('ABCD', 'a', image(100));
    store.put('ABCD', 'b', image(0));
    store.deleteRoom('ABCD');
    expect(store.get('ABCD', 'a')).toBeUndefined();
    expect(store.totalBytes).toBe(0);
    expect(store.put('WXYZ', 'a', image(100))).toBe('ok');
    store.deleteRoom('NONE');
    expect(store.totalBytes).toBe(100);
  });
});

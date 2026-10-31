import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { visibleStrokes } from '../../../shared/ink.js';
import type { InkOp } from '../../../shared/types.js';
import { createScreenGallery, galleryKey, type GalleryFetch } from './gallery.js';

const OPS: InkOp[] = [
  ['b', 1, 0, 1, 10, 20],
  ['p', 1, 5, 5],
  ['e', 1],
];

/** A fetch whose answers the test settles by hand, per call. */
function manualFetch() {
  const calls: { turnId: number; resolve: (r: unknown) => void; reject: (e: Error) => void }[] = [];
  const fetch: GalleryFetch = (turnId) =>
    new Promise((resolve, reject) =>
      calls.push({ turnId, resolve: resolve as (r: unknown) => void, reject }),
    );
  return { fetch, calls };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the Screen gallery', () => {
  it('asks once per drawing and holds each answer as a stack', async () => {
    const { fetch, calls } = manualFetch();
    const gallery = createScreenGallery(fetch);
    gallery.want([3, 5]);
    gallery.want([3, 5]);
    expect(calls.map((c) => c.turnId)).toEqual([3, 5]);
    expect(gallery.get(3)).toEqual({ status: 'loading' });
    calls[0]!.resolve({ ok: true, turnId: 3, actions: OPS });
    await flush();
    const entry = gallery.get(3);
    expect(entry?.status).toBe('ready');
    if (entry?.status === 'ready') expect(visibleStrokes(entry.stack)).toHaveLength(1);
    expect(gallery.get(5)).toEqual({ status: 'loading' });
  });

  it('marks a drawing the room no longer keeps as not kept, and never asks again', async () => {
    const { fetch, calls } = manualFetch();
    const gallery = createScreenGallery(fetch);
    gallery.want([1]);
    calls[0]!.resolve({ ok: false, error: 'inkNotKept' });
    await flush();
    expect(gallery.get(1)).toEqual({ status: 'notKept' });
    await vi.advanceTimersByTimeAsync(60_000);
    gallery.want([1]);
    gallery.retry();
    expect(calls).toHaveLength(1);
  });

  it('asks again later after a timeout or a refusal it can recover from', async () => {
    const { fetch, calls } = manualFetch();
    const gallery = createScreenGallery(fetch, 1000);
    gallery.want([1, 2]);
    calls[0]!.reject(new Error('operation has timed out'));
    calls[1]!.resolve({ ok: false, error: 'rateLimited' });
    await flush();
    expect(gallery.get(1)).toEqual({ status: 'loading' });
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.slice(2).map((c) => c.turnId)).toEqual([1, 2]);
    // Failing again waits twice as long.
    calls[2]!.resolve({ ok: false, error: 'notJoined' });
    await flush();
    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.at(-1)!.turnId).toBe(1);
  });

  it('treats notScreen as a failure to ask again, not as "Drawing not kept"', async () => {
    const { fetch, calls } = manualFetch();
    const gallery = createScreenGallery(fetch, 1000);
    gallery.want([1]);
    calls[0]!.resolve({ ok: false, error: 'notScreen' });
    await flush();
    expect(gallery.get(1)).toEqual({ status: 'loading' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(2);
  });

  it('retry() keeps the failure count, so the next failure still waits longer', async () => {
    const { fetch, calls } = manualFetch();
    const gallery = createScreenGallery(fetch, 1000);
    gallery.want([1]);
    calls[0]!.resolve({ ok: false, error: 'rateLimited' });
    await flush();
    gallery.retry();
    expect(calls).toHaveLength(2);
    calls[1]!.resolve({ ok: false, error: 'rateLimited' });
    await flush();
    // The second failure waits 1000 × 2 = 2000, not the first 1000 again.
    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(3);
  });

  it('retry() asks at once for every drawing still waiting on a failed answer', async () => {
    const { fetch, calls } = manualFetch();
    const gallery = createScreenGallery(fetch, 1000);
    gallery.want([1, 2]);
    calls[0]!.resolve({ ok: false, error: 'notJoined' });
    await flush();
    // 2 is still in flight: not asked twice.
    gallery.retry();
    expect(calls.map((c) => c.turnId)).toEqual([1, 2, 1]);
    // The cancelled timer doesn't ask a third time.
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(3);
  });

  it('clear() forgets everything, and a late answer from before it is dropped', async () => {
    const { fetch, calls } = manualFetch();
    const gallery = createScreenGallery(fetch, 1000);
    gallery.want([1, 2]);
    calls[1]!.reject(new Error('timeout'));
    await flush();
    gallery.clear();
    calls[0]!.resolve({ ok: true, turnId: 1, actions: OPS });
    await vi.advanceTimersByTimeAsync(5000);
    expect(gallery.get(1)).toBeUndefined();
    expect(calls).toHaveLength(2);
  });

  it('tells subscribers when an answer changes what it holds', async () => {
    const { fetch, calls } = manualFetch();
    const gallery = createScreenGallery(fetch);
    const seen: number[] = [];
    const off = gallery.subscribe(() => seen.push(gallery.version()));
    gallery.want([1]);
    calls[0]!.resolve({ ok: true, turnId: 1, actions: OPS });
    await flush();
    off();
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('gallery keys', () => {
  it('← → open the first or last drawing when none is open', () => {
    expect(galleryKey('ArrowRight', -1, 5, false)).toEqual({ open: 0 });
    expect(galleryKey('ArrowLeft', -1, 5, false)).toEqual({ open: 4 });
  });

  it('← → page the open drawing and stop at the ends', () => {
    expect(galleryKey('ArrowRight', 1, 5, false)).toEqual({ open: 2 });
    expect(galleryKey('ArrowLeft', 1, 5, false)).toEqual({ open: 0 });
    expect(galleryKey('ArrowLeft', 0, 5, false)).toEqual({ open: 0 });
    expect(galleryKey('ArrowRight', 4, 5, false)).toEqual({ open: 4 });
    // Paging still works during a rematch countdown: the gallery stays usable until it ends.
    expect(galleryKey('ArrowRight', 1, 5, true)).toEqual({ open: 2 });
  });

  it('Esc closes an open drawing, but is the host’s Cancel during a rematch countdown', () => {
    expect(galleryKey('Escape', 2, 5, false)).toBe('close');
    expect(galleryKey('Escape', 2, 5, true)).toBeNull();
    expect(galleryKey('Escape', -1, 5, false)).toBeNull();
  });

  it('leaves other keys, and every key with no drawings, alone', () => {
    expect(galleryKey('m', 2, 5, false)).toBeNull();
    expect(galleryKey('Enter', 2, 5, false)).toBeNull();
    expect(galleryKey('ArrowRight', -1, 0, false)).toBeNull();
  });
});

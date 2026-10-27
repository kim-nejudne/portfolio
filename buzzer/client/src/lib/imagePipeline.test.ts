import { describe, expect, it } from 'vitest';
import { IMAGE_MAX_BYTES, IMAGE_MAX_SIDE_PX, IMAGE_QUALITY } from '../../../shared/constants.js';
import {
  fitWithin,
  IMAGE_TOO_LARGE,
  IMAGE_UNREADABLE,
  IMAGE_WRONG_TYPE,
  type ImageCodec,
  shrinkImage,
} from './imagePipeline.js';

interface Encoded {
  width: number;
  height: number;
  type: string;
  quality: number;
}

/**
 * A codec without a canvas: decoding reports the given size, encoding records its call and returns
 * a blob of `bytes` bytes of the type the browser would give (`webp: false` gives PNG, as a browser
 * that cannot write WebP does).
 */
function fakeCodec(
  source: { width: number; height: number } | Error,
  { webp = true, bytes = 1000 }: { webp?: boolean; bytes?: number } = {},
) {
  const calls: Encoded[] = [];
  const disposed: unknown[] = [];
  const codec: ImageCodec = {
    async decode() {
      if (source instanceof Error) throw source;
      return { width: source.width, height: source.height, frame: 'first-frame' };
    },
    async encode(frame, width, height, type, quality) {
      expect(frame).toBe('first-frame');
      calls.push({ width, height, type, quality });
      const actual = type === 'image/webp' && !webp ? 'image/png' : type;
      if (bytes < 0) throw new Error('encode failed');
      return new Blob([new Uint8Array(bytes)], { type: actual });
    },
    dispose(frame) {
      disposed.push(frame);
    },
  };
  return { codec, calls, disposed };
}

const file = (type: string, name = 'photo') => new File([new Uint8Array(10)], name, { type });

describe('image size maths', () => {
  it('scales the longest side down to 1600 px and keeps the aspect ratio', () => {
    expect(fitWithin(4000, 3000, IMAGE_MAX_SIDE_PX)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, IMAGE_MAX_SIDE_PX)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(3200, 3200, IMAGE_MAX_SIDE_PX)).toEqual({ width: 1600, height: 1600 });
  });

  it('never scales a smaller image up', () => {
    expect(fitWithin(800, 600, IMAGE_MAX_SIDE_PX)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 900, IMAGE_MAX_SIDE_PX)).toEqual({ width: 1600, height: 900 });
  });

  it('rounds to whole pixels and keeps a very thin image at least 1 px wide', () => {
    expect(fitWithin(1601, 1000, IMAGE_MAX_SIDE_PX)).toEqual({ width: 1600, height: 999 });
    expect(fitWithin(100_000, 10, IMAGE_MAX_SIDE_PX)).toEqual({ width: 1600, height: 1 });
  });
});

describe('image pipeline', () => {
  it('re-encodes as WebP at quality 0.8 at the fitted size', async () => {
    const { codec, calls } = fakeCodec({ width: 4000, height: 3000 });
    const result = await shrinkImage(file('image/png'), codec);
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.blob.type).toBe('image/webp');
    expect(calls).toEqual([
      { width: 1600, height: 1200, type: 'image/webp', quality: IMAGE_QUALITY },
    ]);
  });

  it('falls back to JPEG when the browser cannot write WebP', async () => {
    const { codec, calls } = fakeCodec({ width: 800, height: 600 }, { webp: false });
    const result = await shrinkImage(file('image/jpeg'), codec);
    expect(result.ok && result.blob.type).toBe('image/jpeg');
    expect(calls.map((call) => [call.type, call.quality])).toEqual([
      ['image/webp', IMAGE_QUALITY],
      ['image/jpeg', IMAGE_QUALITY],
    ]);
  });

  it('accepts PNG, JPEG, WebP and GIF', async () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      const { codec } = fakeCodec({ width: 10, height: 10 });
      expect((await shrinkImage(file(type), codec)).ok).toBe(true);
    }
  });

  it('refuses other file types without decoding them', async () => {
    for (const type of ['image/svg+xml', 'image/heic', 'application/pdf', '']) {
      const { codec, calls } = fakeCodec({ width: 10, height: 10 });
      expect(await shrinkImage(file(type), codec)).toEqual({ ok: false, error: IMAGE_WRONG_TYPE });
      expect(calls).toEqual([]);
    }
  });

  it('rejects an image still above 1.5 MB after compression', async () => {
    const { codec } = fakeCodec({ width: 1600, height: 1600 }, { bytes: IMAGE_MAX_BYTES + 1 });
    expect(await shrinkImage(file('image/png'), codec)).toEqual({
      ok: false,
      error: IMAGE_TOO_LARGE,
    });
    expect(IMAGE_TOO_LARGE).toContain('1.5 MB');
  });

  it('keeps an image of exactly 1.5 MB', async () => {
    const { codec } = fakeCodec({ width: 1600, height: 1600 }, { bytes: IMAGE_MAX_BYTES });
    const result = await shrinkImage(file('image/png'), codec);
    expect(result.ok && result.blob.size).toBe(IMAGE_MAX_BYTES);
  });

  it('frees the decoded frame after encoding, also when encoding fails', async () => {
    const ok = fakeCodec({ width: 10, height: 10 });
    await shrinkImage(file('image/png'), ok.codec);
    expect(ok.disposed).toEqual(['first-frame']);

    const failing = fakeCodec({ width: 10, height: 10 }, { bytes: -1 });
    expect(await shrinkImage(file('image/png'), failing.codec)).toEqual({
      ok: false,
      error: IMAGE_UNREADABLE,
    });
    expect(failing.disposed).toEqual(['first-frame']);
  });

  it('reports a file the browser cannot decode', async () => {
    const { codec } = fakeCodec(new Error('decode failed'));
    expect(await shrinkImage(file('image/png'), codec)).toEqual({
      ok: false,
      error: IMAGE_UNREADABLE,
    });
  });
});

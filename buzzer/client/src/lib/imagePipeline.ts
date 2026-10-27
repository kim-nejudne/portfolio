// The editor's image pipeline (Images): every added image is redrawn in the browser at a longest
// side of 1600 px and re-encoded as WebP (JPEG where the browser cannot write WebP) at quality 0.8.
// A result still above 1.5 MB is refused. A GIF keeps only its first frame.

import { IMAGE_MAX_BYTES, IMAGE_MAX_SIDE_PX, IMAGE_QUALITY } from '../../../shared/constants.js';

/** The types the editor accepts, for the file picker's `accept`. */
export const IMAGE_INPUT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export const IMAGE_WRONG_TYPE = 'Use a PNG, JPEG, WebP or GIF image.';
export const IMAGE_UNREADABLE = "Couldn't read that image. Try another file.";
export const IMAGE_TOO_LARGE = `That image is still over ${IMAGE_MAX_BYTES / 1024 / 1024} MB after shrinking. Try a simpler or smaller one.`;

export type ShrinkResult = { ok: true; blob: Blob } | { ok: false; error: string };

/**
 * Decoding and encoding, injected so the pipeline's rules run in tests without a canvas.
 * `frame` is whatever `decode` returns for `encode` to draw.
 */
export interface ImageCodec<Frame = unknown> {
  decode(file: Blob): Promise<{ width: number; height: number; frame: Frame }>;
  /** The browser picks the output type: one it cannot write comes back as PNG. */
  encode(frame: Frame, width: number, height: number, type: string, quality: number): Promise<Blob>;
  /** Frees the decoded frame once encoding is over. */
  dispose?(frame: Frame): void;
}

/** The size to draw at: the longest side at most `maxSide`, the aspect ratio kept, never enlarged. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function shrinkImage(
  file: Blob,
  codec: ImageCodec = browserCodec,
): Promise<ShrinkResult> {
  if (!(IMAGE_INPUT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: IMAGE_WRONG_TYPE };
  }

  let blob: Blob;
  let decoded: Awaited<ReturnType<ImageCodec['decode']>> | undefined;
  try {
    decoded = await codec.decode(file);
    const { width, height, frame } = decoded;
    const size = fitWithin(width, height, IMAGE_MAX_SIDE_PX);
    blob = await codec.encode(frame, size.width, size.height, 'image/webp', IMAGE_QUALITY);
    if (blob.type !== 'image/webp') {
      blob = await codec.encode(frame, size.width, size.height, 'image/jpeg', IMAGE_QUALITY);
    }
  } catch {
    return { ok: false, error: IMAGE_UNREADABLE };
  } finally {
    if (decoded) codec.dispose?.(decoded.frame);
  }

  // SPEC-QUESTION: only the shrunk result is checked against 1.5 MB (DECISIONS F29).
  return blob.size > IMAGE_MAX_BYTES ? { ok: false, error: IMAGE_TOO_LARGE } : { ok: true, blob };
}

/**
 * `createImageBitmap` decodes the first frame of a GIF and applies EXIF rotation. The canvas redraws
 * it at the fitted size. JPEG has no transparency, so a JPEG is drawn over white, not black.
 */
const browserCodec: ImageCodec<ImageBitmap> = {
  async decode(file) {
    const frame = await createImageBitmap(file);
    return { width: frame.width, height: frame.height, frame };
  },
  encode(frame, width, height, type, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return Promise.reject(new Error('No 2D canvas'));
    if (type === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(frame, 0, 0, width, height);
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
        type,
        quality,
      ),
    );
  },
  dispose(frame) {
    frame.close();
  },
};

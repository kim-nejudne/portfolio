// Stored photos (spec: Wikidata and Commons resolution, Photos step 3–4; Stored categories): a
// Commons thumbnail is re-encoded with sharp to WebP with every byte of metadata dropped (EXIF with
// GPS, XMP, IPTC, ICC), as `DATA_DIR/photos/<id>.webp` and `<id>-thumb.webp`. The id is random,
// unrelated to the place or the Commons file, so neither a file name nor its bytes name the answer.

import { randomBytes } from 'node:crypto';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Photo, PhotoCandidate, Place } from '#shared/types.js';
import { placeholderSvg } from './generate/fakeWikimedia.js';
import { WikimediaError, type WikimediaClient } from './generate/wikimedia.js';

// One libvips thread: the droplet is small and a game must not stall while a level downloads.
sharp.concurrency(1);

export const PHOTO_MAX_PX = 1280;
export const PHOTO_QUALITY = 80;
export const THUMB_MAX_PX = 480;
export const THUMB_QUALITY = 75;
/** Downloads are 1280 px thumbnails; refuse to decode anything far larger. */
const INPUT_MAX_PIXELS = 50_000_000;

export const photosDir = (dataDir: string) => join(dataDir, 'photos');
export const photoFile = (id: string) => `${id}.webp`;
export const thumbFile = (id: string) => `${id}-thumb.webp`;

/** A random id (the nanoid alphabet, 20 characters), as place ids are made. */
export const newPhotoId = () => randomBytes(15).toString('base64url');

export interface EncodedPhoto {
  photo: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

/**
 * WebP q80 (longest side ≤ 1280) and q75 (≤ 480), never enlarged. sharp writes no metadata unless
 * asked and converts to sRGB, so EXIF, XMP, IPTC and ICC are all left behind; the EXIF orientation
 * is applied to the pixels first, so an upright photo stays upright without it.
 */
export async function encodePhoto(input: Buffer): Promise<EncodedPhoto> {
  const resized = (max: number) =>
    sharp(input, { failOn: 'error', limitInputPixels: INPUT_MAX_PIXELS })
      .rotate()
      .resize(max, max, { fit: 'inside', withoutEnlargement: true });
  const { data: photo, info } = await resized(PHOTO_MAX_PX)
    .webp({ quality: PHOTO_QUALITY })
    .toBuffer({ resolveWithObject: true });
  const thumb = await resized(THUMB_MAX_PX).webp({ quality: THUMB_QUALITY }).toBuffer();
  return { photo, thumb, width: info.width, height: info.height };
}

/** Writes both files under `dir`; neither stays behind when the other fails. */
export async function writePhoto(dir: string, id: string, encoded: EncodedPhoto): Promise<void> {
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(join(dir, photoFile(id)), encoded.photo);
    await writeFile(join(dir, thumbFile(id)), encoded.thumb);
  } catch (err) {
    await rm(join(dir, photoFile(id)), { force: true });
    await rm(join(dir, thumbFile(id)), { force: true });
    throw err;
  }
}

/** The Commons file page of `File:…`. */
export function commonsPageUrl(commonsFile: string): string {
  const path = encodeURIComponent(commonsFile.replace(/ /g, '_')).replace(/%3A/gi, ':');
  return `https://commons.wikimedia.org/wiki/${path}`;
}

/** A download that failed for this file only (gone, refused), not because Commons is down. */
function fileFailed(err: unknown): boolean {
  return (
    err instanceof WikimediaError &&
    err.status !== undefined &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 429
  );
}

export interface FetchedPhoto {
  photo: Photo;
  /** The usable candidates after the stored one, metadata only, for Swap photo. */
  photoCandidates: PhotoCandidate[];
}

/**
 * Photos step 3–4: downloads the first usable candidate that downloads and decodes, and stores it.
 * Null when none does. A Commons outage (5xx, busy, network) throws, which fails the level.
 */
export async function fetchPhoto(
  candidates: readonly PhotoCandidate[],
  client: WikimediaClient,
  dir: string,
  signal?: AbortSignal,
): Promise<FetchedPhoto | null> {
  for (const [i, candidate] of candidates.entries()) {
    signal?.throwIfAborted();
    let encoded: EncodedPhoto;
    try {
      encoded = await encodePhoto((await client.download(candidate.thumbUrl)).bytes);
    } catch (err) {
      if (fileFailed(err) || !(err instanceof WikimediaError)) continue; // gone, or not an image
      throw err;
    }
    const id = newPhotoId();
    await writePhoto(dir, id, encoded);
    return {
      photo: {
        id,
        width: encoded.width,
        height: encoded.height,
        author: candidate.author,
        licence: candidate.licence,
        licenceUrl: candidate.licenceUrl,
        commonsFile: candidate.commonsFile,
        sourceUrl: commonsPageUrl(candidate.commonsFile),
      },
      photoCandidates: candidates.slice(i + 1),
    };
  }
  return null;
}

/**
 * The dev fixture's landmarks (place ids `dev-…`) point at placeholder photos that live in no
 * repository: render the missing ones (a colour and a number) into `dir`. Development only.
 */
export async function writeDevPhotos(dir: string, places: readonly Place[]): Promise<number> {
  let written = 0;
  const dev = places.filter((p) => p.id.startsWith('dev-') && p.photo);
  for (const [i, place] of dev.entries()) {
    const { id, width, height } = place.photo!;
    const exists = await access(join(dir, thumbFile(id))).then(
      () => true,
      () => false,
    );
    if (exists) continue;
    const svg = Buffer.from(placeholderSvg(i + 1, width, height));
    await writePhoto(dir, id, await encodePhoto(svg));
    written++;
  }
  return written;
}

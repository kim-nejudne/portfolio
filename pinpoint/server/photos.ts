// Stored photos (spec: Wikidata and Commons resolution, Photos step 3–4; Stored categories): a
// Commons thumbnail is re-encoded with sharp to WebP with every byte of metadata dropped (EXIF with
// GPS, XMP, IPTC, ICC), as `DATA_DIR/photos/<id>.webp` and `<id>-thumb.webp`. The id is random,
// unrelated to the place or the Commons file, so neither a file name nor its bytes name the answer.

import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Response } from 'express';
import sharp from 'sharp';
import type {
  Category,
  Difficulty,
  LevelContent,
  Photo,
  PhotoCandidate,
  Place,
} from '#shared/types.js';
import { placeholderSvg } from './generate/fakeWikimedia.js';
import { DROP } from './generate/resolver.js';
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

/** Deletes both files of a stored photo; a missing one is fine. */
export async function removePhoto(dir: string, id: string): Promise<void> {
  await rm(join(dir, photoFile(id)), { force: true });
  await rm(join(dir, thumbFile(id)), { force: true });
}

/** Writes both files under `dir`; neither stays behind when the other fails. */
export async function writePhoto(dir: string, id: string, encoded: EncodedPhoto): Promise<void> {
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(join(dir, photoFile(id)), encoded.photo);
    await writeFile(join(dir, thumbFile(id)), encoded.thumb);
  } catch (err) {
    await removePhoto(dir, id);
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
  /**
   * The usable candidates other than the stored one, metadata only, for Swap photo: the later ones
   * and any flagged by the sign check (Swap photo re-checks and badges them); failed ones are gone.
   */
  photoCandidates: PhotoCandidate[];
}

/** The sign check on a candidate's 480 px thumbnail: true when it names or hints at the place. */
export type SignCheck = (candidate: PhotoCandidate, thumb: Buffer) => Promise<boolean>;

/**
 * One candidate downloaded and encoded, or null when that file failed (gone, refused, not an
 * image); a Commons outage (5xx, busy, network) throws.
 */
export async function downloadCandidate(
  candidate: PhotoCandidate,
  client: WikimediaClient,
): Promise<EncodedPhoto | null> {
  try {
    return await encodePhoto((await client.download(candidate.thumbUrl)).bytes);
  } catch (err) {
    if (fileFailed(err) || !(err instanceof WikimediaError)) return null;
    throw err;
  }
}

/** The place's record of a stored candidate; `signCheck` absent when it was never checked. */
export function storedPhoto(
  id: string,
  encoded: EncodedPhoto,
  candidate: PhotoCandidate,
  signCheck?: Photo['signCheck'],
): Photo {
  return {
    id,
    width: encoded.width,
    height: encoded.height,
    author: candidate.author,
    licence: candidate.licence,
    licenceUrl: candidate.licenceUrl,
    commonsFile: candidate.commonsFile,
    sourceUrl: commonsPageUrl(candidate.commonsFile),
    commonsThumbUrl: candidate.thumbUrl,
    ...(signCheck ? { signCheck } : {}),
  };
}

/**
 * Photos step 3–4: stores the first usable candidate that downloads, decodes and (when `signCheck`
 * is given) passes the sign check. A drop when none does: "Every photo names the place" when a
 * candidate was flagged, else "No usable photo". A Commons outage (5xx, busy, network) throws.
 */
export async function fetchPhoto(
  candidates: readonly PhotoCandidate[],
  client: WikimediaClient,
  dir: string,
  signal?: AbortSignal,
  signCheck?: SignCheck,
): Promise<FetchedPhoto | { drop: string }> {
  const flagged: PhotoCandidate[] = [];
  for (const [i, candidate] of candidates.entries()) {
    signal?.throwIfAborted();
    const encoded = await downloadCandidate(candidate, client);
    if (!encoded) continue;
    // Checked in memory, so a flagged photo never reaches the disk.
    if (signCheck && (await signCheck(candidate, encoded.thumb))) {
      flagged.push({ ...candidate, namesPlace: true });
      continue;
    }
    const id = newPhotoId();
    await writePhoto(dir, id, encoded);
    return {
      photo: storedPhoto(id, encoded, candidate, signCheck ? 'passed' : undefined),
      photoCandidates: [...flagged, ...candidates.slice(i + 1)],
    };
  }
  return { drop: flagged.length ? DROP.allFlagged : DROP.noPhoto };
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

/**
 * The category with every landmark whose photo or thumbnail file is missing from `dir` left out,
 * or that has no photo at all,
 * so a broken file never reaches a round (spec: Place selection). The store's copy is untouched.
 */
export function withPhotosOnDisk(category: Category, dir: string | null): Category {
  // With no photo folder (tests) only a landmark without a photo is left out.
  const onDisk = (p: Place) =>
    p.kind !== 'landmark' ||
    (p.photo !== undefined &&
      (dir === null ||
        (existsSync(join(dir, photoFile(p.photo.id))) &&
          existsSync(join(dir, thumbFile(p.photo.id))))));
  const live: Category['live'] = {};
  for (const [level, content] of Object.entries(category.live) as [Difficulty, LevelContent][])
    live[level] = { ...content, places: content.places.filter(onDisk) };
  return { ...category, live };
}

/**
 * Sends a stored WebP from `dir` with nothing that names it: no `ETag`, `Last-Modified` or
 * `Content-Disposition` (Express's `sendFile` and `send` would add an ETag); `cacheControl` only
 * with the bytes. A missing file is a JSON 404. Photos are a few hundred KB, so read whole.
 */
export async function sendPhoto(
  res: Response,
  dir: string,
  file: string,
  cacheControl?: string,
): Promise<void> {
  let bytes: Buffer;
  try {
    bytes = await readFile(join(dir, file));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  if (cacheControl) res.set('Cache-Control', cacheControl); // never on a 404: the file may return
  res.set('Content-Type', 'image/webp').end(bytes);
}

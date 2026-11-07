import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { Photo, PhotoCandidate, Place } from '#shared/types.js';
import { DROP } from './generate/resolver.js';
import { WikimediaError, type WikimediaClient } from './generate/wikimedia.js';
import {
  commonsPageUrl,
  encodePhoto,
  fetchPhoto,
  photoFile,
  thumbFile,
  writeDevPhotos,
} from './photos.js';

const CAPTION = 'Secret caption naming Himeji';
const XMP = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>XMP title Himeji</dc:title></rdf:Description></rdf:RDF></x:xmpmeta>`;

/** An APP13 (Photoshop IRB) segment holding one IPTC caption record. */
function iptcSegment(caption: string): Buffer {
  const text = Buffer.from(caption);
  const record = Buffer.concat([Buffer.from([0x1c, 0x02, 0x78, 0, text.length]), text]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(record.length);
  const pad = record.length % 2 ? Buffer.from([0]) : Buffer.alloc(0);
  const body = Buffer.concat([
    Buffer.from('Photoshop 3.0\0'),
    Buffer.from('8BIM'),
    Buffer.from([0x04, 0x04, 0, 0]),
    size,
    record,
    pad,
  ]);
  const head = Buffer.from([0xff, 0xed, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

/** A 2000 × 1500 JPEG carrying GPS EXIF, XMP, IPTC and a Display P3 ICC profile. */
async function taggedJpeg(width = 2000, height = 1500): Promise<Buffer> {
  const jpeg = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .withExif({
      IFD0: { ImageDescription: 'EXIF description Himeji', Artist: 'Someone' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '34/1 50/1 21/1', GPSLongitudeRef: 'E' },
    })
    .withXmp(XMP)
    .withIccProfile('p3')
    .jpeg()
    .toBuffer();
  // After SOI (FFD8): the IPTC segment.
  return Buffer.concat([jpeg.subarray(0, 2), iptcSegment(CAPTION), jpeg.subarray(2)]);
}

const has = (bytes: Buffer, text: string) => bytes.includes(Buffer.from(text));

describe('encodePhoto', () => {
  it('strips EXIF (GPS included), XMP, IPTC and ICC from both files', async () => {
    const input = await taggedJpeg();
    const before = await sharp(input).metadata();
    expect(before.exif).toBeDefined();
    expect(before.xmp).toBeDefined();
    expect(before.iptc).toBeDefined();
    expect(before.icc).toBeDefined();
    expect(has(input, 'GPS') || has(input, 'Himeji')).toBe(true);

    const { photo, thumb } = await encodePhoto(input);
    for (const out of [photo, thumb]) {
      const meta = await sharp(out).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      for (const marker of ['Exif', 'EXIF', 'XMP ', 'ICCP', 'xmpmeta', 'Photoshop', '8BIM']) {
        expect(has(out, marker), marker).toBe(false);
      }
      for (const text of ['Himeji', 'Someone', CAPTION]) expect(has(out, text), text).toBe(false);
    }
  });

  it('fits the photo in 1280 px and the thumbnail in 480 px, never enlarging', async () => {
    const big = await encodePhoto(await taggedJpeg(2000, 1500));
    expect(big).toMatchObject({ width: 1280, height: 960 });
    expect(await sharp(big.thumb).metadata()).toMatchObject({ width: 480, height: 360 });

    const tall = await encodePhoto(await taggedJpeg(900, 1600));
    expect(tall).toMatchObject({ width: 720, height: 1280 });
    expect(await sharp(tall.thumb).metadata()).toMatchObject({ width: 270, height: 480 });

    const small = await encodePhoto(await taggedJpeg(400, 300));
    expect(small).toMatchObject({ width: 400, height: 300 });
    expect(await sharp(small.thumb).metadata()).toMatchObject({ width: 400, height: 300 });
  });

  it('applies the EXIF orientation to the pixels before dropping it', async () => {
    const rotated = await sharp({
      create: { width: 1000, height: 500, channels: 3, background: '#fff' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect(await encodePhoto(rotated)).toMatchObject({ width: 500, height: 1000 });
  });

  it('refuses bytes that are not an image', async () => {
    await expect(encodePhoto(Buffer.from('<html>Not found</html>'))).rejects.toThrow();
  });
});

const candidate = (n: number): PhotoCandidate => ({
  commonsFile: `File:Candidate ${n}.jpg`,
  thumbUrl: `https://upload.wikimedia.org/c${n}.jpg`,
  author: `Author ${n}`,
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  width: 1600,
  height: 1200,
});

/** Downloads by URL: an image, a 404, a non-image or an outage. */
function client(files: Record<string, Buffer | number | 'outage'>): WikimediaClient {
  return {
    download: async (url: string) => {
      const file = files[url];
      if (file === 'outage') throw new WikimediaError('Wikimedia is busy (HTTP 503)', 503);
      if (typeof file === 'number') throw new WikimediaError(`HTTP ${file}`, file);
      return { bytes: file ?? Buffer.from('?'), contentType: 'image/jpeg' };
    },
  } as WikimediaClient;
}

describe('fetchPhoto', () => {
  it('stores the first candidate that downloads and decodes, keeping the later ones', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pinpoint-photos-'));
    const jpeg = await taggedJpeg();
    const got = await fetchPhoto(
      [candidate(1), candidate(2), candidate(3), candidate(4)],
      client({
        'https://upload.wikimedia.org/c1.jpg': 404,
        'https://upload.wikimedia.org/c2.jpg': Buffer.from('not an image'),
        'https://upload.wikimedia.org/c3.jpg': jpeg,
      }),
      dir,
    );
    if ('drop' in got) throw new Error(got.drop);
    const photo: Photo = got.photo;
    expect(photo).toEqual({
      id: expect.stringMatching(/^[\w-]{20}$/),
      width: 1280,
      height: 960,
      author: 'Author 3',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      commonsFile: 'File:Candidate 3.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Candidate_3.jpg',
      commonsThumbUrl: 'https://upload.wikimedia.org/c3.jpg',
    });
    expect(got.photoCandidates).toEqual([candidate(4)]);
    expect(readdirSync(dir).sort()).toEqual([thumbFile(photo.id), photoFile(photo.id)].sort());
    const stored = readFileSync(join(dir, photoFile(photo.id)));
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
    // The id names neither the place nor the file.
    expect(photo.id).not.toMatch(/candidate|himeji/i);
  });

  it('drops "No usable photo" when no candidate works, and throws on a Commons outage', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pinpoint-photos-'));
    expect(await fetchPhoto([], client({}), dir)).toEqual({ drop: DROP.noPhoto });
    expect(
      await fetchPhoto([candidate(1)], client({ 'https://upload.wikimedia.org/c1.jpg': 410 }), dir),
    ).toEqual({ drop: DROP.noPhoto });
    await expect(
      fetchPhoto([candidate(1)], client({ 'https://upload.wikimedia.org/c1.jpg': 'outage' }), dir),
    ).rejects.toThrow(WikimediaError);
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe('fetchPhoto with the sign check', () => {
  const files = async () => {
    const jpeg = await taggedJpeg();
    return client({
      'https://upload.wikimedia.org/c1.jpg': jpeg,
      'https://upload.wikimedia.org/c2.jpg': 404,
      'https://upload.wikimedia.org/c3.jpg': jpeg,
      'https://upload.wikimedia.org/c4.jpg': jpeg,
    });
  };

  it('checks the 480 px thumbnail, skips a flagged candidate and keeps it for Swap photo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pinpoint-photos-'));
    const seen: { file: string; width: number }[] = [];
    const got = await fetchPhoto(
      [candidate(1), candidate(2), candidate(3), candidate(4)],
      await files(),
      dir,
      undefined,
      async ({ commonsFile }, thumb) => {
        seen.push({ file: commonsFile, width: (await sharp(thumb).metadata()).width });
        return commonsFile === 'File:Candidate 1.jpg';
      },
    );
    if ('drop' in got) throw new Error(got.drop);
    expect(seen).toEqual([
      { file: 'File:Candidate 1.jpg', width: 480 },
      { file: 'File:Candidate 3.jpg', width: 480 },
    ]);
    expect(got.photo).toMatchObject({ commonsFile: 'File:Candidate 3.jpg', signCheck: 'passed' });
    // The flagged one stays a candidate, marked for Swap photo's badge; a failed download does not.
    expect(got.photoCandidates).toEqual([{ ...candidate(1), namesPlace: true }, candidate(4)]);
    expect(readdirSync(dir)).toHaveLength(2);
  });

  it('drops "Every photo names the place" when every candidate is flagged, storing nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pinpoint-photos-'));
    const got = await fetchPhoto(
      [candidate(1), candidate(2), candidate(3)],
      await files(),
      dir,
      undefined,
      () => Promise.resolve(true),
    );
    expect(got).toEqual({ drop: DROP.allFlagged });
    expect(DROP.allFlagged).toBe('Every photo names the place');
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe('commonsPageUrl', () => {
  it('links the file page with underscores and escaped characters', () => {
    expect(commonsPageUrl('File:Tokyo Tower 2023.jpg')).toBe(
      'https://commons.wikimedia.org/wiki/File:Tokyo_Tower_2023.jpg',
    );
    expect(commonsPageUrl('File:Château & tour?.jpg')).toBe(
      'https://commons.wikimedia.org/wiki/File:Ch%C3%A2teau_%26_tour%3F.jpg',
    );
  });
});

describe('writeDevPhotos', () => {
  it("renders the dev fixture's missing placeholder photos once", async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pinpoint-photos-'));
    const photo = (id: string) => ({ id, width: 1280, height: 960 }) as Photo;
    const places = [
      { id: 'dev-eiffel-tower', photo: photo('abc') },
      { id: 'dev-tokyo' },
      { id: 'real-place', photo: photo('def') },
    ] as Place[];
    expect(await writeDevPhotos(dir, places)).toBe(1);
    expect(readdirSync(dir).sort()).toEqual(['abc-thumb.webp', 'abc.webp']);
    expect(await sharp(join(dir, 'abc.webp')).metadata()).toMatchObject({
      width: 1280,
      height: 960,
    });
    expect(await writeDevPhotos(dir, places)).toBe(0);
  });
});

import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { IMAGE_MAX_BYTES, ROOM_IMAGES_MAX_BYTES } from '../shared/constants.js';
import type { HttpErrorBody } from '../shared/types.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { createApp } from './http.js';
import { InMemoryImageStore } from './imageStore.js';
import { InMemoryRoomStore } from './roomStore.js';
import { makeQuestion, makeRoom, makeSet } from './test/rooms.js';

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

const IMAGE_COUNT = 40;
const token = generateHostToken();

/** Room ABCD, whose questions use img1…img40, with `token` as its hostToken. */
async function setup(images = new InMemoryImageStore()) {
  const rooms = new InMemoryRoomStore();
  const set = {
    ...makeSet(0),
    questions: Array.from({ length: IMAGE_COUNT }, (_, i) =>
      makeQuestion(i + 1, { imageId: `img${i + 1}` }),
    ),
  };
  rooms.set(makeRoom({ code: 'ABCD', hostTokenHash: hashHostToken(token), set }));
  server = createApp({ rooms, images }).listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, rooms, images };
}

function upload(
  base: string,
  imageId: string,
  body: Uint8Array,
  { auth = `Bearer ${token}`, type = 'image/webp', code = 'ABCD' } = {},
): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': type };
  if (auth) headers.authorization = auth;
  return fetch(`${base}/api/rooms/${code}/images/${imageId}`, { method: 'POST', headers, body });
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as HttpErrorBody).error;
}

const bytes = (length: number, fill = 1) => new Uint8Array(length).fill(fill);

describe('POST /api/rooms/:code/images/:imageId', () => {
  it("stores the host's image and answers 201 {ok: true}", async () => {
    const { base, images } = await setup();
    const res = await upload(base, 'img1', bytes(1000, 7));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(images.get('ABCD', 'img1')).toEqual({
      type: 'image/webp',
      data: Buffer.alloc(1000, 7),
    });
  });

  it('refuses an upload without the Bearer hostToken with 401 and stores nothing', async () => {
    const { base, images } = await setup();
    for (const auth of ['', `Bearer ${generateHostToken()}`, token, 'Bearer ']) {
      const res = await upload(base, 'img1', bytes(10), { auth });
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
      expect(await errorOf(res)).toMatch(/only the host/i);
    }
    expect(images.totalBytes).toBe(0);
  });

  it('answers 404 for a room that does not exist, or an image no question uses', async () => {
    const { base, images } = await setup();
    expect((await upload(base, 'img1', bytes(10), { code: 'WXYZ' })).status).toBe(404);
    const unused = await upload(base, 'img99', bytes(10));
    expect(unused.status).toBe(404);
    expect(await errorOf(unused)).toMatch(/no question/i);
    expect((await upload(base, 'bad%20id', bytes(10))).status).toBe(404);
    expect(images.totalBytes).toBe(0);
  });

  it('refuses a type other than PNG, JPEG, WebP or GIF with 415', async () => {
    const { base } = await setup();
    for (const type of ['image/png', 'image/jpeg', 'image/gif']) {
      expect((await upload(base, 'img1', bytes(10), { type })).status).toBe(201);
    }
    for (const type of ['image/svg+xml', 'text/html', 'application/octet-stream']) {
      expect((await upload(base, 'img1', bytes(10), { type })).status).toBe(415);
    }
  });

  it('accepts an image of exactly 1.5 MB and refuses one byte more with 413', async () => {
    const { base, images } = await setup();
    expect((await upload(base, 'img1', bytes(IMAGE_MAX_BYTES))).status).toBe(201);
    const tooBig = await upload(base, 'img2', bytes(IMAGE_MAX_BYTES + 1));
    expect(tooBig.status).toBe(413);
    expect(await errorOf(tooBig)).toBe('The image is larger than 1.5 MB.');
    expect(images.get('ABCD', 'img2')).toBeUndefined();
  });

  it('refuses an empty body with 400', async () => {
    const { base } = await setup();
    expect((await upload(base, 'img1', new Uint8Array())).status).toBe(400);
  });

  it('accepts 50 MB per room and refuses the 51st MB with 413', async () => {
    const { base, images } = await setup();
    const mb = 1024 * 1024;
    // 33 images of 1.5 MB, then 0.5 MB: exactly 50 MB.
    for (let i = 1; i <= 33; i++) {
      expect((await upload(base, `img${i}`, bytes(IMAGE_MAX_BYTES))).status).toBe(201);
    }
    expect((await upload(base, 'img34', bytes(mb / 2))).status).toBe(201);
    expect(images.totalBytes).toBe(ROOM_IMAGES_MAX_BYTES);

    const over = await upload(base, 'img35', bytes(mb));
    expect(over.status).toBe(413);
    expect(await errorOf(over)).toMatch(/over 50 MB/);
    expect(images.get('ABCD', 'img35')).toBeUndefined();
    // A retry of an image already stored replaces it, so it still fits.
    expect((await upload(base, 'img34', bytes(mb / 2, 9))).status).toBe(201);
  });

  it('refuses with 507 when the server-wide image cap is reached', async () => {
    const { base } = await setup(new InMemoryImageStore(ROOM_IMAGES_MAX_BYTES, 1000));
    expect((await upload(base, 'img1', bytes(1000))).status).toBe(201);
    expect((await upload(base, 'img2', bytes(1))).status).toBe(507);
  });
});

describe('GET /api/rooms/:code/images/:imageId', () => {
  it('serves the uploaded bytes with their type and a long cache header, without auth', async () => {
    const { base } = await setup();
    await upload(base, 'img1', bytes(500, 3), { type: 'image/png' });
    const res = await fetch(`${base}/api/rooms/abcd/images/img1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes(500, 3));
  });

  it('answers 404 for an image not uploaded, or once its room is gone', async () => {
    const { base, rooms } = await setup();
    expect((await fetch(`${base}/api/rooms/ABCD/images/img2`)).status).toBe(404);
    await upload(base, 'img1', bytes(10));
    rooms.delete('ABCD');
    expect((await fetch(`${base}/api/rooms/ABCD/images/img1`)).status).toBe(404);
    expect((await fetch(`${base}/api/rooms/NOPE!/images/img1`)).status).toBe(404);
  });
});

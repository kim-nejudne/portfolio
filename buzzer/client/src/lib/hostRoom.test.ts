// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROOM_IMAGES_MAX_BYTES } from '../../../shared/constants.js';
import { SAMPLE_FLAG_ID, SAMPLE_HEXAGON_ID, SAMPLE_SET } from '../../../shared/sampleSet.js';
import type { Question, QuestionSet } from '../../../shared/types.js';
import { NewGameTakenError } from './api.js';
import {
  checkPlayable,
  hostNextSet,
  hostSet,
  SetImagesError,
  uploadSetImages,
} from './hostRoom.js';
import { loadHostToken } from './hostTokens.js';
import { sampleImages } from './sampleImages.js';

const good: Question = { id: 'q1', text: 'What?', answer: 'Yes', points: 100 };

function withQuestions(questions: Question[], title = 'Quiz'): QuestionSet {
  return { ...SAMPLE_SET, title, questions };
}

function errorOf(set: QuestionSet) {
  const checked = checkPlayable(set);
  return checked.ok ? null : checked.error;
}

describe('checkPlayable', () => {
  it('accepts a playable set and returns it trimmed', () => {
    const checked = checkPlayable(withQuestions([{ ...good, answer: '  Yes ' }]));
    expect(checked).toEqual({ ok: true, set: withQuestions([good]) });
  });

  it('says a set with no questions has none yet', () => {
    expect(errorOf(withQuestions([]))).toBe('This set has no questions yet.');
  });

  it('says a blank title needs a title', () => {
    expect(errorOf(withQuestions([good], '   '))).toBe('This set needs a title.');
  });

  it('names the question that has no answer', () => {
    const blank = { ...good, id: 'q2', answer: '' };
    expect(errorOf(withQuestions([good, blank]))).toBe('Question 2 needs an answer.');
  });

  it('names the question that has neither text nor image', () => {
    expect(errorOf(withQuestions([{ ...good, text: '' }]))).toBe(
      'Question 1 needs text or an image.',
    );
  });

  it('names the question and field for any other problem', () => {
    expect(errorOf(withQuestions([{ ...good, points: 1.5 }]))).toMatch(/^Question 1 \(points\): /);
  });
});

describe('hostSet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  interface Call {
    url: string;
    headers: Record<string, string>;
    body: unknown;
  }

  /** A fake server: creates room WXYZ, then answers each image upload with `uploadStatus`. */
  function stubServer(uploadStatus = 201) {
    const calls: Call[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        calls.push({ url, headers: init.headers as Record<string, string>, body: init.body });
        if (url === '/api/rooms') {
          return Promise.resolve(
            Response.json({ code: 'WXYZ', hostToken: 'token-1' }, { status: 201 }),
          );
        }
        return Promise.resolve(
          uploadStatus === 201
            ? Response.json({ ok: true }, { status: 201 })
            : Response.json(
                { ok: false, error: 'The image is larger than 1.5 MB.' },
                { status: 413 },
              ),
        );
      }),
    );
    return calls;
  }

  const blobs: Record<string, Blob> = {
    'img-a': new Blob(['aaaa'], { type: 'image/webp' }),
    'img-b': new Blob(['bb'], { type: 'image/png' }),
  };
  const load = (id: string) => Promise.resolve(blobs[id]);
  const imageSet = withQuestions([
    { ...good, id: 'q1', imageId: 'img-a' },
    { ...good, id: 'q2', text: '', imageId: 'img-b' },
    { ...good, id: 'q3', imageId: 'img-a' },
    { ...good, id: 'q4' },
  ]);

  it('creates the room, then uploads each image once with the Bearer hostToken', async () => {
    const calls = stubServer();
    await expect(hostSet(imageSet, load)).resolves.toBe('WXYZ');
    expect(calls.map((c) => c.url)).toEqual([
      '/api/rooms',
      '/api/rooms/WXYZ/images/img-a',
      '/api/rooms/WXYZ/images/img-b',
    ]);
    expect(calls[1]!.headers).toEqual({
      authorization: 'Bearer token-1',
      'content-type': 'image/webp',
    });
    expect(calls[1]!.body).toBe(blobs['img-a']);
    expect(calls[2]!.headers['content-type']).toBe('image/png');
    expect(loadHostToken('WXYZ')).toBe('token-1');
  });

  it('creates no room when an image is missing from this browser', async () => {
    const calls = stubServer();
    const set = withQuestions([good, { ...good, id: 'q2', imageId: 'gone' }]);
    await expect(hostSet(set, load)).rejects.toThrow("Question 2's image is missing");
    expect(calls).toEqual([]);
  });

  it('creates no room when the images add up to more than 50 MB', async () => {
    const calls = stubServer();
    const big = { size: ROOM_IMAGES_MAX_BYTES / 2 + 1, type: 'image/webp' } as Blob;
    await expect(hostSet(imageSet, () => Promise.resolve(big))).rejects.toThrow(
      "This set's images add up to 50.0 MB. A game holds up to 50 MB.",
    );
    expect(calls).toEqual([]);
  });

  it("names the server's reason when an upload is refused", async () => {
    stubServer(413);
    await expect(hostSet(imageSet, load)).rejects.toThrow(
      "Couldn't upload an image: The image is larger than 1.5 MB.",
    );
  });

  it('hosting the built-in sample uploads its pictures from the bundle, not IndexedDB', async () => {
    const calls = stubServer();
    await expect(hostSet(SAMPLE_SET)).resolves.toBe('WXYZ');
    expect(calls.map((c) => c.url)).toEqual([
      '/api/rooms',
      `/api/rooms/WXYZ/images/${SAMPLE_HEXAGON_ID}`,
      `/api/rooms/WXYZ/images/${SAMPLE_FLAG_ID}`,
    ]);
    const bundled = new Map(sampleImages().map((image) => [image.id, image.blob]));
    for (const call of calls.slice(1)) {
      const id = call.url.split('/').pop()!;
      expect(call.headers['content-type']).toBe('image/png');
      expect(await (call.body as Blob).text()).toBe(await bundled.get(id)!.text());
    }
  });

  it('uploads nothing for a text-only set', async () => {
    const calls = stubServer();
    await expect(hostSet(withQuestions([good]), load)).resolves.toBe('WXYZ');
    expect(calls.map((c) => c.url)).toEqual(['/api/rooms']);
  });
});

describe('hostNextSet', () => {
  afterEach(() => vi.unstubAllGlobals());

  interface Call {
    url: string;
    method: string | undefined;
    headers: Record<string, string>;
    body: unknown;
  }

  /** A fake server: answers the PUT with `putStatus`, then each image upload with `uploadStatus`. */
  function stubServer({ putStatus = 200, uploadStatus = 201 } = {}) {
    const calls: Call[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        calls.push({
          url,
          method: init.method,
          headers: init.headers as Record<string, string>,
          body: init.body,
        });
        if (url === '/api/rooms/WXYZ/set') {
          return Promise.resolve(
            putStatus === 200
              ? Response.json({ ok: true })
              : Response.json({ ok: false, error: 'Refused' }, { status: putStatus }),
          );
        }
        return Promise.resolve(
          uploadStatus === 201
            ? Response.json({ ok: true }, { status: 201 })
            : Response.json(
                { ok: false, error: 'The image is larger than 1.5 MB.' },
                { status: 413 },
              ),
        );
      }),
    );
    return calls;
  }

  const blobs: Record<string, Blob> = {
    'img-a': new Blob(['aaaa'], { type: 'image/webp' }),
    'img-b': new Blob(['bb'], { type: 'image/png' }),
  };
  const load = (id: string) => Promise.resolve(blobs[id]);
  const imageSet = withQuestions([
    { ...good, id: 'q1', imageId: 'img-a' },
    { ...good, id: 'q2', text: '', imageId: 'img-b' },
    { ...good, id: 'q3', imageId: 'img-a' },
  ]);

  it('sends nothing for a set that is not playable', async () => {
    const calls = stubServer();
    await expect(hostNextSet('WXYZ', 'token-1', withQuestions([]), false, load)).rejects.toThrow(
      'This set has no questions yet.',
    );
    expect(calls).toEqual([]);
  });

  it('sends nothing when an image is missing from this browser', async () => {
    const calls = stubServer();
    const set = withQuestions([good, { ...good, id: 'q2', imageId: 'gone' }]);
    await expect(hostNextSet('WXYZ', 'token-1', set, false, load)).rejects.toThrow(
      "Question 2's image is missing",
    );
    expect(calls).toEqual([]);
  });

  it('sends nothing when the images add up to more than 50 MB', async () => {
    const calls = stubServer();
    const big = { size: ROOM_IMAGES_MAX_BYTES / 2 + 1, type: 'image/webp' } as Blob;
    await expect(
      hostNextSet('WXYZ', 'token-1', imageSet, false, () => Promise.resolve(big)),
    ).rejects.toThrow("This set's images add up to 50.0 MB. A game holds up to 50 MB.");
    expect(calls).toEqual([]);
  });

  it('puts the trimmed set and keepScores, then uploads each image once with the Bearer token', async () => {
    const calls = stubServer();
    const set = { ...imageSet, title: '  Round two ' };
    await expect(hostNextSet('WXYZ', 'token-1', set, true, load)).resolves.toBeUndefined();
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['PUT', '/api/rooms/WXYZ/set'],
      ['POST', '/api/rooms/WXYZ/images/img-a'],
      ['POST', '/api/rooms/WXYZ/images/img-b'],
    ]);
    expect(calls[0]!.headers.authorization).toBe('Bearer token-1');
    expect(JSON.parse(calls[0]!.body as string)).toEqual({
      set: { ...imageSet, title: 'Round two' },
      keepScores: true,
    });
    expect(calls[1]!.headers).toEqual({
      authorization: 'Bearer token-1',
      'content-type': 'image/webp',
    });
    expect(calls[2]!.body).toBe(blobs['img-b']);
  });

  it("names the server's reason when an upload is refused, as a SetImagesError", async () => {
    stubServer({ uploadStatus: 413 });
    const caught = await hostNextSet('WXYZ', 'token-1', imageSet, false, load).catch(
      (e: unknown) => e,
    );
    expect(caught).toBeInstanceOf(SetImagesError);
    expect((caught as Error).message).toBe(
      "Couldn't upload an image: The image is larger than 1.5 MB.",
    );
  });

  it('uploadSetImages sends each image once and no PUT', async () => {
    const calls = stubServer();
    await uploadSetImages('WXYZ', 'token-1', imageSet, load);
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['POST', '/api/rooms/WXYZ/images/img-a'],
      ['POST', '/api/rooms/WXYZ/images/img-b'],
    ]);
  });

  it('uploads nothing when the other device already started a new game (409)', async () => {
    const calls = stubServer({ putStatus: 409 });
    await expect(hostNextSet('WXYZ', 'token-1', imageSet, false, load)).rejects.toBeInstanceOf(
      NewGameTakenError,
    );
    expect(calls).toHaveLength(1);
  });
});

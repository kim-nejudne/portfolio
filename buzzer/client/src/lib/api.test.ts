import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { createRoom } from './api.js';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response | Error) {
  const fetch = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const body = { set: SAMPLE_SET, settings: DEFAULT_SETTINGS };

describe('createRoom', () => {
  it('posts the set and settings as JSON and returns the code and token', async () => {
    const fetch = stubFetch(Response.json({ code: 'WXYZ', hostToken: 'secret' }, { status: 201 }));
    await expect(createRoom(body)).resolves.toEqual({ code: 'WXYZ', hostToken: 'secret' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/rooms');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it("throws the server's error message", async () => {
    stubFetch(Response.json({ ok: false, error: 'Too many rooms' }, { status: 429 }));
    await expect(createRoom(body)).rejects.toThrow('Too many rooms');
  });

  it('throws a readable message when the body is not JSON', async () => {
    stubFetch(new Response('Bad Gateway', { status: 502 }));
    await expect(createRoom(body)).rejects.toThrow('Could not create a room (502).');
  });

  it('throws a readable message when the server cannot be reached', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    await expect(createRoom(body)).rejects.toThrow('Could not reach the server');
  });
});

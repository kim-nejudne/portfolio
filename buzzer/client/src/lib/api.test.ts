import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, ROOM_CHECK_RATE_LIMITED_ERROR } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import {
  createRoom,
  fetchConfig,
  NEW_GAME_TAKEN_MESSAGE,
  NewGameTakenError,
  replaceSet,
  roomExists,
  uploadImage,
} from './api.js';

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

describe('roomExists', () => {
  it('asks the exists endpoint for the code', async () => {
    const fetch = stubFetch(Response.json({ exists: true, phase: 'LOBBY' }));
    await expect(roomExists('WXYZ')).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/rooms/WXYZ/exists');
  });

  it('answers false for an unknown room', async () => {
    stubFetch(Response.json({ exists: false, phase: null }));
    await expect(roomExists('WXYZ')).resolves.toBe(false);
  });

  it('throws a readable message on a server error', async () => {
    stubFetch(new Response('Bad Gateway', { status: 502 }));
    await expect(roomExists('WXYZ')).rejects.toThrow('Could not check the room (502).');
  });

  it('throws a readable message when the server cannot be reached', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    await expect(roomExists('WXYZ')).rejects.toThrow('Could not reach the server');
  });

  it("throws the server's message past the room-check limit", async () => {
    stubFetch(Response.json({ ok: false, error: ROOM_CHECK_RATE_LIMITED_ERROR }, { status: 429 }));
    await expect(roomExists('WXYZ')).rejects.toThrow(ROOM_CHECK_RATE_LIMITED_ERROR);
  });
});

describe('fetchConfig', () => {
  it('returns the join origin, or null when there is none', async () => {
    const fetch = stubFetch(Response.json({ joinOrigin: 'http://192.168.1.20' }));
    await expect(fetchConfig()).resolves.toEqual({ joinOrigin: 'http://192.168.1.20' });
    expect(fetch).toHaveBeenCalledWith('/api/config');
    stubFetch(Response.json({ joinOrigin: null }));
    await expect(fetchConfig()).resolves.toEqual({ joinOrigin: null });
  });

  it('is null when the server cannot answer', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    await expect(fetchConfig()).resolves.toBeNull();
    stubFetch(new Response('Bad Gateway', { status: 502 }));
    await expect(fetchConfig()).resolves.toBeNull();
    stubFetch(Response.json({ joinOrigin: 42 }));
    await expect(fetchConfig()).resolves.toBeNull();
  });
});

describe('uploadImage', () => {
  const blob = new Blob(['x'], { type: 'image/gif' });

  it('throws a readable message when the error body is not JSON', async () => {
    stubFetch(new Response('Bad Gateway', { status: 502 }));
    await expect(uploadImage('WXYZ', 't', 'img1', blob)).rejects.toThrow(
      'Could not upload an image (502).',
    );
  });

  it('throws a readable message when the server cannot be reached', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    await expect(uploadImage('WXYZ', 't', 'img1', blob)).rejects.toThrow(
      'Could not reach the server',
    );
  });
});

describe('replaceSet', () => {
  const next = { set: SAMPLE_SET, keepScores: true };

  it('puts the set and keepScores as JSON with the Bearer hostToken', async () => {
    const fetch = stubFetch(Response.json({ ok: true }));
    await expect(replaceSet('WXYZ', 'secret', next)).resolves.toBeUndefined();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/rooms/WXYZ/set');
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({
      authorization: 'Bearer secret',
      'content-type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual(next);
  });

  it('throws NewGameTakenError on 409', async () => {
    stubFetch(Response.json({ ok: false, error: 'Only after the game' }, { status: 409 }));
    const caught = await replaceSet('WXYZ', 'secret', next).catch((e: unknown) => e);
    expect(caught).toBeInstanceOf(NewGameTakenError);
    expect((caught as Error).message).toBe(NEW_GAME_TAKEN_MESSAGE);
  });

  it("throws the server's error message", async () => {
    stubFetch(Response.json({ ok: false, error: 'Invalid host token' }, { status: 401 }));
    await expect(replaceSet('WXYZ', 'secret', next)).rejects.toThrow('Invalid host token');
  });

  it('throws a readable message when the body is not JSON', async () => {
    stubFetch(new Response('Bad Gateway', { status: 502 }));
    await expect(replaceSet('WXYZ', 'secret', next)).rejects.toThrow(
      'Could not start a new game (502).',
    );
  });

  it('throws a readable message when the server cannot be reached', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    await expect(replaceSet('WXYZ', 'secret', next)).rejects.toThrow('Could not reach the server');
  });
});

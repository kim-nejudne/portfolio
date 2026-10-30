// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { BuiltInSetsResponse } from '../../../shared/types.js';
import {
  BUILT_IN_LOAD_ERROR,
  builtInList,
  loadBuiltInSets,
  resetBuiltInSets,
  useBuiltInSets,
} from './builtInSets.js';

const SERVER: BuiltInSetsResponse = { sets: STARTER_SETS.slice(0, 3), sampleHidden: false };

/** A fake server answering each `/api/built-in-sets` with the next of `answers`. */
function stubServer(...answers: (() => Response)[]) {
  const fetch = vi.fn(async (url: string) => {
    expect(url).toBe('/api/built-in-sets');
    const answer = answers.shift();
    if (!answer) throw new TypeError('Failed to fetch');
    return answer();
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const ok = (body: unknown) => () => Response.json(body);
const down = () => Response.json({ error: 'Down' }, { status: 503 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetBuiltInSets();
});

describe('builtInList', () => {
  it("puts the bundled sample first, then the server's sets in their order", () => {
    expect(builtInList(SERVER)).toEqual([SAMPLE_SET, ...SERVER.sets]);
  });

  it('leaves the sample out when the admin hid it', () => {
    expect(builtInList({ ...SERVER, sampleHidden: true })).toEqual(SERVER.sets);
  });
});

describe('loadBuiltInSets', () => {
  it('fetches once per page load: callers at once and later share the one answer', async () => {
    const fetch = stubServer(ok(SERVER), ok({ sets: [], sampleHidden: true }));
    const [first, second] = await Promise.all([loadBuiltInSets(), loadBuiltInSets()]);
    const later = await loadBuiltInSets();
    expect(first).toEqual([SAMPLE_SET, ...SERVER.sets]);
    expect(second).toBe(first);
    expect(later).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails with the readable message, and the next call asks the server again', async () => {
    const fetch = stubServer(down, ok(SERVER));
    await expect(loadBuiltInSets()).rejects.toThrow(BUILT_IN_LOAD_ERROR);
    await expect(loadBuiltInSets()).resolves.toEqual([SAMPLE_SET, ...SERVER.sets]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails when the server cannot be reached', async () => {
    stubServer();
    await expect(loadBuiltInSets()).rejects.toThrow(BUILT_IN_LOAD_ERROR);
  });

  it('fails on a body that is not the built-in list', async () => {
    const badSet = { ...STARTER_SETS[0]!, questions: 'none' };
    for (const body of [
      { sets: 'no', sampleHidden: false },
      { sets: [] },
      { sets: [badSet], sampleHidden: false },
      null,
    ]) {
      resetBuiltInSets();
      stubServer(ok(body));
      await expect(loadBuiltInSets()).rejects.toThrow(BUILT_IN_LOAD_ERROR);
    }
  });

  it('resetBuiltInSets with a response serves that list with no request', async () => {
    const fetch = stubServer();
    resetBuiltInSets({ ...SERVER, sampleHidden: true });
    await expect(loadBuiltInSets()).resolves.toEqual(SERVER.sets);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('useBuiltInSets', () => {
  it('is loading, then ready with the list', async () => {
    stubServer(ok(SERVER));
    const { result } = renderHook(() => useBuiltInSets());
    expect(result.current.kind).toBe('loading');
    await waitFor(() => expect(result.current.kind).toBe('ready'));
    expect(result.current).toEqual({ kind: 'ready', sets: [SAMPLE_SET, ...SERVER.sets] });
  });

  it('fails, then Retry loads again and gets the list', async () => {
    const fetch = stubServer(down, ok(SERVER));
    const { result } = renderHook(() => useBuiltInSets());
    await waitFor(() => expect(result.current.kind).toBe('failed'));
    const failed = result.current as Extract<typeof result.current, { kind: 'failed' }>;
    act(() => failed.retry());
    expect(result.current.kind).toBe('loading');
    await waitFor(() => expect(result.current.kind).toBe('ready'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

// §9 Offline, updates: "the service worker fetches new assets in the background and the app shows
// 'Reload for the new version'. It never reloads by itself mid-exercise." Plus F15's timing: the
// worker registers once the compiler is ready (or failed, or after a fallback), so the precache
// never competes with the cold start. The flow runs against a fake `registerSW`; the real one is
// exercised in Chrome by e2e/offline.spec.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUpdates,
  REGISTER_FALLBACK_MS,
  type RegisterOptions,
} from './update';

interface Harness {
  registered: RegisterOptions[];
  skipWaiting: ReturnType<typeof vi.fn>;
  reloadPage: ReturnType<typeof vi.fn>;
  ready: { resolve: () => void; reject: () => void };
}

function harness(): Harness & { updates: ReturnType<typeof createUpdates> } {
  const registered: RegisterOptions[] = [];
  const skipWaiting = vi.fn(() => Promise.resolve());
  const reloadPage = vi.fn();
  let resolve = (): void => undefined;
  let reject = (): void => undefined;
  const whenReady = new Promise<void>((res, rej) => {
    resolve = () => res();
    reject = () => rej(new Error('compiler failed'));
  });
  const updates = createUpdates({
    register: (options) => {
      registered.push(options);
      return skipWaiting;
    },
    reloadPage,
    whenReady,
  });
  return {
    registered,
    skipWaiting,
    reloadPage,
    ready: { resolve, reject },
    updates,
  };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('registration', () => {
  it('waits for the compiler to be ready, then registers once', async () => {
    const h = harness();
    await flush();
    expect(h.registered).toHaveLength(0);
    h.ready.resolve();
    await flush();
    expect(h.registered).toHaveLength(1);
    expect(h.registered[0]?.immediate).toBe(true);
    await vi.advanceTimersByTimeAsync(REGISTER_FALLBACK_MS);
    expect(h.registered).toHaveLength(1);
  });

  it('registers when the compiler fails, so a fixed deploy still reaches the page', async () => {
    const h = harness();
    h.ready.reject();
    await flush();
    expect(h.registered).toHaveLength(1);
  });

  it('registers after the fallback when the compiler never answers', async () => {
    const h = harness();
    await vi.advanceTimersByTimeAsync(REGISTER_FALLBACK_MS - 1);
    expect(h.registered).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.registered).toHaveLength(1);
    expect(REGISTER_FALLBACK_MS).toBe(10_000);
  });

  it('swallows a registration error (service workers blocked or unsupported)', async () => {
    const h = harness();
    h.ready.resolve();
    await flush();
    expect(() =>
      h.registered[0]?.onRegisterError?.(new Error('blocked')),
    ).not.toThrow();
    expect(h.updates.waiting).toBe(false);
  });
});

describe('a new version', () => {
  it('shows "Reload for the new version" when a worker is waiting, and tells subscribers', async () => {
    const h = harness();
    h.ready.resolve();
    await flush();
    const listener = vi.fn();
    h.updates.subscribe(listener);
    expect(h.updates.waiting).toBe(false);
    h.registered[0]?.onNeedRefresh?.();
    expect(h.updates.waiting).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reloads only after Reload is pressed here: skip waiting, then reload when the new worker controls the page', async () => {
    const h = harness();
    h.ready.resolve();
    await flush();
    h.registered[0]?.onNeedRefresh?.();
    h.updates.reload();
    expect(h.skipWaiting).toHaveBeenCalledTimes(1);
    expect(h.reloadPage).not.toHaveBeenCalled();
    h.registered[0]?.onNeedReload?.();
    expect(h.reloadPage).toHaveBeenCalledTimes(1);
  });

  it('never reloads by itself when another tab activated the new worker; Reload then reloads at once', async () => {
    const h = harness();
    h.ready.resolve();
    await flush();
    h.registered[0]?.onNeedRefresh?.();
    // Another tab pressed Reload: the new worker took control of this page too.
    h.registered[0]?.onNeedReload?.();
    expect(h.reloadPage).not.toHaveBeenCalled();
    expect(h.updates.waiting).toBe(true);
    h.updates.reload();
    expect(h.skipWaiting).not.toHaveBeenCalled();
    expect(h.reloadPage).toHaveBeenCalledTimes(1);
  });
});

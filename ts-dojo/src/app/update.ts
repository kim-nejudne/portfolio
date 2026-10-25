// The service worker's updates (§9 Offline): "the service worker fetches new assets in the
// background and the app shows 'Reload for the new version'. It never reloads by itself
// mid-exercise." `vite-plugin-pwa`'s prompt mode supplies the events; this decides what they do.
//
// - A worker waiting with a new version sets `waiting`, and the header shows the line and its
//   Reload button (src/app/update-prompt.tsx).
// - Reload pressed here skips the waiting worker, and the page reloads once the new worker
//   controls it.
// - When another tab pressed Reload, the new worker takes control of this page too and the
//   plugin would reload it; `onNeedReload` keeps it from doing so. The line stays up, and Reload
//   here reloads at once.
//
// Registration waits for the compiler's first `ready` (or its failure, or REGISTER_FALLBACK_MS):
// the precache is the whole app plus /ts/6.0.3/, about 9 MB, and on a first visit it would
// otherwise share the connection with the worker chunk and the lib files the §9 cold-start budget
// is about. Pure apart from the injected register function, so Vitest runs it.

/** The options `registerSW` from `virtual:pwa-register` takes, the ones used here. */
export interface RegisterOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onNeedReload?: () => void;
  onRegisterError?: (error: unknown) => void;
}

/** `registerSW`: returns the function that tells the waiting worker to take over. */
export type Register = (options: RegisterOptions) => () => Promise<void>;

export const REGISTER_FALLBACK_MS = 10_000;

export interface Updates {
  /** A new version is installed and waiting for Reload. */
  readonly waiting: boolean;
  readonly subscribe: (listener: () => void) => () => void;
  /** Reload pressed: take the new version. */
  reload(): void;
}

export function createUpdates(deps: {
  register: Register;
  reloadPage: () => void;
  /** Settles when the compiler is first ready or has failed. */
  whenReady: Promise<unknown>;
}): Updates {
  const listeners = new Set<() => void>();
  let waiting = false;
  let reloadRequested = false;
  let takenOverElsewhere = false;
  let skipWaiting: (() => Promise<void>) | null = null;

  const register = (): void => {
    if (skipWaiting !== null) return;
    skipWaiting = deps.register({
      immediate: true,
      onNeedRefresh: () => {
        waiting = true;
        for (const listener of listeners) listener();
      },
      onNeedReload: () => {
        if (reloadRequested) deps.reloadPage();
        else takenOverElsewhere = true;
      },
      // Service workers blocked (the e2e runs that block them) or unsupported: the app works
      // online as before, without the offline copy.
      onRegisterError: () => undefined,
    });
  };

  const fallback = setTimeout(register, REGISTER_FALLBACK_MS);
  const settled = (): void => {
    clearTimeout(fallback);
    register();
  };
  deps.whenReady.then(settled, settled);

  return {
    get waiting() {
      return waiting;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reload() {
      if (takenOverElsewhere || skipWaiting === null) {
        deps.reloadPage();
        return;
      }
      reloadRequested = true;
      void skipWaiting();
    },
  };
}

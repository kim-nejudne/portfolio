// The app's one service-worker registration (§9 Offline): `vite-plugin-pwa`'s `registerSW`, through
// the update flow in ./update.ts, once the compiler is ready. main.tsx starts it; the header's
// UpdatePrompt reads it.
/// <reference types="vite-plugin-pwa/vanillajs" />
import { registerSW } from 'virtual:pwa-register';
import { getCompiler } from './compiler';
import { createUpdates, type Updates } from './update';

let updates: Updates | null = null;

export function startUpdates(): Updates {
  updates ??= createUpdates({
    register: registerSW,
    reloadPage: () => {
      window.location.reload();
    },
    whenReady: getCompiler().whenReady(),
  });
  return updates;
}

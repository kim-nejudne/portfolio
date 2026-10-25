// The app-level Playwright seam, next to the editor's `window.__tsDojo` (src/editor/registry.ts):
// what a test can call on any page without a mounted editor. F5 publishes `openInRepl` so
// the §12 F5 flow runs before F6 renders a theory block with the button.
import type { OpenInReplRequest } from './open-in-repl';

export interface TsDojoAppSeam {
  openInRepl(request: OpenInReplRequest): Promise<string>;
}

declare global {
  interface Window {
    __tsDojoApp?: TsDojoAppSeam;
  }
}

export function publishAppSeam(seam: TsDojoAppSeam | null): void {
  if (typeof window === 'undefined') return;
  if (seam === null) delete window.__tsDojoApp;
  else window.__tsDojoApp = seam;
}

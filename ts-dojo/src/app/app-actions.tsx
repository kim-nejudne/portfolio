// App-level actions a page or the editor can ask for without knowing the layout: the `?` help
// overlay, the Ctrl-p palette, the roadmap and `:export` (F9). Provided by Layout; `:help`,
// `:roadmap`, `:export` and the palette's own fallbacks (when no editor is mounted) go through it.
import { createContext, useContext } from 'react';
import type { OpenInReplRequest } from './open-in-repl';

export interface AppActions {
  openHelp: () => void;
  openPalette: () => void;
  goToRoadmap: () => void;
  /** A theory block's Open in REPL (F5): the new buffer's name. */
  openInRepl: (request: OpenInReplRequest) => Promise<string>;
  /** `:export` (§7): downloads the progress file; the file name. */
  exportProgress: () => Promise<string>;
}

const noop = (): void => undefined;

export const AppActionsContext = createContext<AppActions>({
  openHelp: noop,
  openPalette: noop,
  goToRoadmap: noop,
  openInRepl: () => Promise.resolve(''),
  exportProgress: () => Promise.resolve(''),
});

export function useAppActions(): AppActions {
  return useContext(AppActionsContext);
}

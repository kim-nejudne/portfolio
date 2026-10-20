// App-level actions a page or the editor can ask for without knowing the layout: the `?` help
// overlay, the Ctrl-p palette and the roadmap. Provided by Layout; `:help`, `:roadmap` and the
// palette's own fallbacks (when no editor is mounted) go through it.
import { createContext, useContext } from 'react';
import type { OpenInReplRequest } from './open-in-repl';

export interface AppActions {
  openHelp: () => void;
  openPalette: () => void;
  goToRoadmap: () => void;
  /** A theory block's Open in REPL (F5): the new buffer's name. */
  openInRepl: (request: OpenInReplRequest) => Promise<string>;
}

const noop = (): void => undefined;

export const AppActionsContext = createContext<AppActions>({
  openHelp: noop,
  openPalette: noop,
  goToRoadmap: noop,
  openInRepl: () => Promise.resolve(''),
});

export function useAppActions(): AppActions {
  return useContext(AppActionsContext);
}

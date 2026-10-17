// App-level actions a page or the editor can ask for without knowing the layout: the `?` help
// overlay, the Ctrl-p palette and the roadmap. Provided by Layout; `:help`, `:roadmap` and the
// palette's own fallbacks (when no editor is mounted) go through it.
import { createContext, useContext } from 'react';

export interface AppActions {
  openHelp: () => void;
  openPalette: () => void;
  goToRoadmap: () => void;
}

const noop = (): void => undefined;

export const AppActionsContext = createContext<AppActions>({
  openHelp: noop,
  openPalette: noop,
  goToRoadmap: noop,
});

export function useAppActions(): AppActions {
  return useContext(AppActionsContext);
}

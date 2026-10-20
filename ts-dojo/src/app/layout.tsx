// The app shell around every §6 page: a one-line header (the current path and the compiler
// status chip), the page, the global keys, the `?` help overlay and the Ctrl-p palette.
// shadcn's Tooltip needs one provider above everything that uses it.
import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { getActiveEditor } from '@/editor/registry';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppActionsContext, type AppActions } from './app-actions';
import { CommandPalette } from './command-palette';
import { CompilerStatusChip } from './compiler-status';
import { HelpOverlay } from './help-overlay';
import type { GlobalAction } from './keys';
import { openInRepl } from './open-in-repl';
import { getPageActions } from './page-actions';
import { publishAppSeam } from './seam';
import { useGlobalKeys, type GlobalKeyHandlers } from './use-global-keys';

export function Layout() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Where the focus was when the palette opened: a page-level command acts from that pane.
  const [paletteOrigin, setPaletteOrigin] = useState<Element | null>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const actions = useMemo<AppActions>(
    () => ({
      openHelp: () => setHelpOpen(true),
      openPalette: () => {
        setPaletteOrigin(document.activeElement);
        setPaletteOpen(true);
      },
      goToRoadmap: () => void navigate('/'),
      openInRepl: (request) => openInRepl((to) => void navigate(to), request),
    }),
    [navigate],
  );
  // The Playwright seam for Open in REPL until F6 renders a theory block (src/app/seam.ts).
  useEffect(() => {
    publishAppSeam({ openInRepl: actions.openInRepl });
    return () => publishAppSeam(null);
  }, [actions]);
  // The page-level keys (`g n`, `] e`, the pane keys) go to the mounted page first
  // (src/app/page-actions.ts); `Esc` and `2` fall back to the editor when the page has none.
  const handlers = useMemo<GlobalKeyHandlers>(() => {
    const page = (action: GlobalAction, fallback?: () => void) => (): void => {
      if (getPageActions()?.key?.(action) === true) return;
      fallback?.();
    };
    const focusEditor = (): void => getActiveEditor()?.focus();
    return {
      help: actions.openHelp,
      palette: actions.openPalette,
      roadmap: actions.goToRoadmap,
      lessonNext: page('lessonNext'),
      lessonPrev: page('lessonPrev'),
      exerciseNext: page('exerciseNext'),
      exercisePrev: page('exercisePrev'),
      focusTheory: page('focusTheory'),
      focusEditor: page('focusEditor', focusEditor),
      focusOutput: page('focusOutput'),
      focusLeft: page('focusLeft'),
      focusDown: page('focusDown'),
      focusUp: page('focusUp'),
      focusRight: page('focusRight'),
    };
  }, [actions]);
  useGlobalKeys(handlers);
  return (
    <AppActionsContext value={actions}>
      <TooltipProvider>
        <div className="flex h-svh flex-col bg-background text-foreground">
          <header className="flex h-10 shrink-0 items-center gap-3 border-b px-4 text-sm">
            <Link to="/" className="font-semibold tracking-tight">
              ts-dojo
            </Link>
            <span className="font-mono text-muted-foreground">{pathname}</span>
            <span className="ml-auto flex items-center gap-3 text-muted-foreground">
              <CompilerStatusChip />
              <span>
                <kbd className="rounded border px-1 font-mono">?</kbd> keys
              </span>
            </span>
          </header>
          <main className="flex min-h-0 flex-1 flex-col overflow-auto">
            <Outlet />
          </main>
        </div>
        <HelpOverlay open={helpOpen} onOpenChange={setHelpOpen} />
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          origin={paletteOrigin}
        />
      </TooltipProvider>
    </AppActionsContext>
  );
}

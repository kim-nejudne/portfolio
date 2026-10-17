// The app shell around every §6 page: a one-line header (the current path and the compiler
// status chip), the page, the global keys, the `?` help overlay and the Ctrl-p palette.
// shadcn's Tooltip needs one provider above everything that uses it.
import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppActionsContext, type AppActions } from './app-actions';
import { CommandPalette } from './command-palette';
import { CompilerStatusChip } from './compiler-status';
import { HelpOverlay } from './help-overlay';
import { useGlobalKeys, type GlobalKeyHandlers } from './use-global-keys';

export function Layout() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const actions = useMemo<AppActions>(
    () => ({
      openHelp: () => setHelpOpen(true),
      openPalette: () => setPaletteOpen(true),
      goToRoadmap: () => void navigate('/'),
    }),
    [navigate],
  );
  // `g n`, `g p`, `] e`, `[ e` need the lesson page (F8); unhandled keys do nothing.
  const handlers = useMemo<GlobalKeyHandlers>(
    () => ({
      help: actions.openHelp,
      palette: actions.openPalette,
      roadmap: actions.goToRoadmap,
    }),
    [actions],
  );
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
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </TooltipProvider>
    </AppActionsContext>
  );
}

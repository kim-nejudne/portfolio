// The app shell around every §6 page: a one-line header (the current path and the compiler
// status chip), the page, the global keys and the `?` help overlay. shadcn's Tooltip needs one
// provider above everything that uses it.
import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CompilerStatusChip } from './compiler-status';
import { HelpOverlay } from './help-overlay';
import { useGlobalKeys, type GlobalKeyHandlers } from './use-global-keys';

export function Layout() {
  const [helpOpen, setHelpOpen] = useState(false);
  const { pathname } = useLocation();
  const handlers = useMemo<GlobalKeyHandlers>(
    () => ({ help: () => setHelpOpen(true) }),
    [],
  );
  useGlobalKeys(handlers);
  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col bg-background text-foreground">
        <header className="flex h-10 items-center gap-3 border-b px-4 text-sm">
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
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      <HelpOverlay open={helpOpen} onOpenChange={setHelpOpen} />
    </TooltipProvider>
  );
}

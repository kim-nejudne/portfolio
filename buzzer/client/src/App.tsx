import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Host } from './pages/Host.js';
import { Landing } from './pages/Landing.js';
import { Placeholder } from './pages/Placeholder.js';
import { Play } from './pages/Play.js';
import { Screen } from './pages/Screen.js';

// Vite replaces `import.meta.env.DEV` with `false` in `vite build`, so a production bundle has
// neither this route nor the bots chunk (Dev tool: fake players).
const DevBots = import.meta.env.DEV ? lazy(() => import('./dev/DevBots.js')) : null;

/** The route table, without a router, so tests can mount it in a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/play/:code" element={<Play />} />
      <Route path="/screen/:code" element={<Screen />} />
      <Route path="/host/:code" element={<Host />} />
      <Route path="/sets" element={<Placeholder title="My question sets" />} />
      <Route path="/sets/:setId" element={<Placeholder title="Edit set" />} />
      {DevBots && (
        <Route
          path="/dev/bots/:code"
          element={
            <Suspense>
              <DevBots />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<Placeholder title="Page not found" />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from './lib/router.js';
import { Landing } from './pages/Landing.js';
import { Play } from './pages/Play.js';

// The Screen is its own chunk so the player page never downloads it (spec: Performance budget).
const Screen = lazy(() => import('./pages/Screen.js').then((m) => ({ default: m.Screen })));
// Dev tool: fake players. `vite build` folds `import.meta.env.DEV` to false, so a production bundle
// has neither this route nor the bots chunk.
const DevBots = import.meta.env.DEV ? lazy(() => import('./pages/DevBots.js')) : null;

/** The route table, without a router, so tests can mount it in a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/play/:code" element={<Play />} />
      <Route
        path="/screen/:code"
        element={
          <Suspense fallback={null}>
            <Screen />
          </Suspense>
        }
      />
      {DevBots && (
        <Route
          path="/dev/bots/:code"
          element={
            <Suspense fallback={null}>
              <DevBots />
            </Suspense>
          }
        />
      )}
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

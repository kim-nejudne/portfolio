import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Landing } from './pages/Landing.js';
import { Play } from './pages/Play.js';
import { Screen } from './pages/Screen.js';

// The admin is its own chunk: nothing admin loads with the play or screen pages.
const Admin = lazy(() => import('./pages/Admin.js').then((m) => ({ default: m.Admin })));

/** The route table, without a router, so tests can mount it in a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/screen/:code" element={<Screen />} />
      <Route path="/play/:code" element={<Play />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={null}>
            <Admin />
          </Suspense>
        }
      />
    </Routes>
  );
}

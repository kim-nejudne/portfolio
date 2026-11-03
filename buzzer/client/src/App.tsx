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

// The set list and editor carry Dexie. Players' phones never open it, so it loads on its own.
const Sets = lazy(() => import('./pages/Sets.js').then((m) => ({ default: m.Sets })));
const SetEditor = lazy(() =>
  import('./pages/SetEditor.js').then((m) => ({ default: m.SetEditor })),
);
// A built-in set in the same editor, for the signed-in admin (F107).
const AdminSetEditor = lazy(() =>
  import('./pages/SetEditor.js').then((m) => ({ default: m.AdminSetEditor })),
);

// The super-admin's frame and sign-in (F105, F119): no link reaches it, so it never loads for
// anyone else. Its pages render in its <Outlet/>, which has a Suspense of its own.
const AdminLayout = lazy(() =>
  import('./pages/AdminLayout.js').then((m) => ({ default: m.AdminLayout })),
);
const Admin = lazy(() => import('./pages/Admin.js').then((m) => ({ default: m.Admin })));
// Generating a category and its progress (F115), for the signed-in admin only.
const AdminGenerate = lazy(() =>
  import('./pages/AdminGenerate.js').then((m) => ({ default: m.AdminGenerate })),
);

// A generated category's review before it is published (F116), for the signed-in admin only.
const AdminCategory = lazy(() =>
  import('./pages/AdminCategory.js').then((m) => ({ default: m.AdminCategory })),
);
// A draft level's questions, edited or removed one at a time, then marked reviewed (F117).
const AdminLevel = lazy(() =>
  import('./pages/AdminLevel.js').then((m) => ({ default: m.AdminLevel })),
);

// Every ended generation and the spend (F128), for the signed-in admin only.
const AdminHistory = lazy(() =>
  import('./pages/AdminHistory.js').then((m) => ({ default: m.AdminHistory })),
);

const AnswerSheet = lazy(() =>
  import('./pages/AnswerSheet.js').then((m) => ({ default: m.AnswerSheet })),
);

/** The route table, without a router, so tests can mount it in a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/play/:code" element={<Play />} />
      <Route path="/screen/:code" element={<Screen />} />
      <Route path="/host/:code" element={<Host />} />
      <Route
        path="/sets"
        element={
          <Suspense>
            <Sets />
          </Suspense>
        }
      />
      <Route
        path="/sets/:setId"
        element={
          <Suspense>
            <SetEditor />
          </Suspense>
        }
      />
      <Route
        path="/sets/:setId/print"
        element={
          <Suspense>
            <AnswerSheet />
          </Suspense>
        }
      />
      {/* The admin header, the session gate and from `lg` the list pane, once for these (F119). */}
      <Route
        path="/admin"
        element={
          <Suspense>
            <AdminLayout />
          </Suspense>
        }
      >
        <Route index element={<Admin />} />
        <Route path="generate" element={<AdminGenerate />} />
        <Route path="categories/:name" element={<AdminCategory />} />
        <Route path="categories/:name/:setId" element={<AdminLevel />} />
        <Route path="history" element={<AdminHistory />} />
      </Route>
      <Route
        path="/admin/sets/:setId"
        element={
          <Suspense>
            <AdminSetEditor />
          </Suspense>
        }
      />
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

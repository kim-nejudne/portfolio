// Entry: theme before the first paint (no inline script under the §10 CSP), the ts-ls worker
// started on load (§2, §9 Warm-up), then the router.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@/app/globals.css';
import { startCompiler } from '@/app/compiler';
import { router } from '@/app/router';
import { initTheme } from '@/app/theme';

initTheme();
startCompiler();

const container = document.getElementById('root');
if (container === null) throw new Error('index.html has no #root element');
createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

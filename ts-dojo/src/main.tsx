// Entry: theme before the first paint (no inline script under the §10 CSP), then the router.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@/app/globals.css';
import { router } from '@/app/router';
import { initTheme } from '@/app/theme';

initTheme();

const container = document.getElementById('root');
if (container === null) throw new Error('index.html has no #root element');
createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

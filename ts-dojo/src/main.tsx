// Entry: theme and code font size before the first paint (no inline script under the §10 CSP),
// the ts-ls worker started on load (§2, §9 Warm-up), the §7 content update (renames,
// `contentVersion`) set to run when the store opens, before any page reads it, then the router.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@/app/globals.css';
import { startCompiler } from '@/app/compiler';
import { router } from '@/app/router';
import { initFontSize } from '@/app/font-size';
import { initTheme } from '@/app/theme';
import { CONTENT_VERSION, registry } from '@/content/registry';
import { installContentUpdate } from '@/store/content-update';
import { getDb } from '@/store/db';

initTheme();
initFontSize();
startCompiler();
installContentUpdate(getDb(), {
  renames: registry.renames,
  contentVersion: CONTENT_VERSION,
});

const container = document.getElementById('root');
if (container === null) throw new Error('index.html has no #root element');
createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

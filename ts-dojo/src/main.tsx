// Entry: zod configured before any module builds a schema (src/app/zod-config.ts, the §10 CSP),
// theme and code font size before the first paint (no inline script under the §10 CSP), the
// ts-ls worker started on load (§2, §9 Warm-up), the service worker registered once it is ready
// (§9 Offline), the §7 content update (renames, `contentVersion`) set to run when the store
// opens, before any page reads it, then the router.
import '@/app/zod-config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@/app/globals.css';
import 'virtual:ts-dojo-schemes.css';
import { startCompiler } from '@/app/compiler';
import { router } from '@/app/router';
import { initFontSize } from '@/app/font-size';
import { startUpdates } from '@/app/service-worker';
import { initTheme } from '@/app/theme';
import { CONTENT_VERSION, registry } from '@/content/registry';
import { installContentUpdate } from '@/store/content-update';
import { getDb } from '@/store/db';

initTheme();
initFontSize();
startCompiler();
startUpdates();
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

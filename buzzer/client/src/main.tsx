import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted so a LAN game night makes no third-party request.
import '@fontsource-variable/anybody/wdth.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo-narrow/600.css';
import { App } from './App.js';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

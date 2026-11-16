import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// shortcut: Gabarito and Manrope fall back to the system sans until F132b installs and imports
// @fontsource/gabarito (800) and @fontsource/manrope (500, 700), self-hosted for offline LAN play.
import { App } from './App.js';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

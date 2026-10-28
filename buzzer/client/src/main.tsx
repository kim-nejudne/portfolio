import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted, so a game on an offline LAN gets the theme fonts too. Each file sets font-display: swap.
import '@fontsource/bungee/400.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/700.css';
import { App } from './App.js';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

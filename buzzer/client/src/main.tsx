import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted so a LAN game night makes no third-party request.
import '@fontsource/gabarito/800.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/700.css';
import { App } from './App.js';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

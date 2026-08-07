import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import '@fontsource-variable/instrument-sans';
import '@fontsource/martian-mono/400.css';
import '@fontsource/martian-mono/500.css';
import './index.css';
import { start } from './lib/api/queue';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

// Load the durable queue and wire the browser's connectivity events before the
// first render. Anything the shopkeeper recorded before the app was last closed
// is on screen immediately, pending or not — a phone that died mid-sale should
// come back showing the sale, not an empty till.
void start();

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/standard.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './index.css';
import './gsapSetup';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

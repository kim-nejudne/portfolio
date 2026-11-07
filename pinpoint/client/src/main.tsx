import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const WORDMARK = 'PINPOINT';

// Placeholder landing page (F01): the tokens and fonts wired in. F09 builds the real landing page.
function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-board-bg px-4 text-center">
      <h1 className="board-face flex gap-1 sm:gap-1.5" aria-label="Pinpoint">
        {[...WORDMARK].map((ch, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="relative flex h-12 w-9 items-center justify-center rounded-flap-phone bg-flap-bg text-3xl text-amber sm:h-20 sm:w-14 sm:rounded-flap-screen sm:text-5xl"
          >
            {ch}
            <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-flap-seam" />
          </span>
        ))}
      </h1>
      <p className="text-text">Find it on the map. Closest pin wins.</p>
      <p className="text-sm text-text-dim">Coming soon to pinpoint.kimnejudne.dev</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

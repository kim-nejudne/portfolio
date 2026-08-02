'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="label-caps text-magenta">Error</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">This screen did not render</h1>
      <p className="mt-3 max-w-prose text-muted">
        The data layer returned something this screen could not read. Nothing has been written to
        the job record. Reload the screen; if it fails twice, the job reference and the time are
        what prepress will need.
      </p>
      <button
        type="button"
        onClick={reset}
        data-testid="error-retry"
        className="mt-6 border border-ink px-4 py-2 label-caps transition-colors duration-100 hover:bg-ink hover:text-paper"
      >
        Reload this screen
      </button>
    </main>
  );
}

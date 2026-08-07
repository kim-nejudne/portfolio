import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="label-caps text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">No such page</h1>
      <p className="mt-3 max-w-prose text-muted">
        Job references are formatted <span className="num text-ink">FM-2608-0417</span> — prefix,
        year and month, sequence. If you followed a link from an old estimate the reference may have
        been superseded.
      </p>
      <ul className="mt-6 space-y-2 label-caps">
        <li>
          <Link className="border-b border-ink pb-0.5" href="/app">
            Job list
          </Link>
        </li>
        <li>
          <Link className="border-b border-ink pb-0.5" href="/quote">
            Instant quote
          </Link>
        </li>
        <li>
          <Link className="border-b border-ink pb-0.5" href="/specs">
            Artwork specification
          </Link>
        </li>
      </ul>
    </main>
  );
}

// Any path outside §6. The nginx SPA fallback (§10) serves index.html for every path, so the
// app answers here instead of a server 404.
import { Link, useLocation } from 'react-router';

export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-10">
      <h1 className="prompt-heading text-2xl font-semibold">Not found</h1>
      <p className="font-mono text-sm text-muted-foreground">{pathname}</p>
      <p className="text-sm">
        <Link to="/" className="text-link underline underline-offset-4">
          Back to the roadmap
        </Link>
      </p>
    </section>
  );
}

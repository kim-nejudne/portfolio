import { Link } from 'react-router';
import { BulbRail } from '../components/BulbRail.js';

// The page for unknown routes.
export function Placeholder({ title }: { title: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <BulbRail count={9} variant="row" />
      <h1 className="font-display text-4xl text-accent">{title}</h1>
      <p className="text-muted">Coming soon.</p>
      <Link to="/" className="py-2 text-lg text-muted underline underline-offset-4 hover:text-ink">
        Back to start
      </Link>
    </main>
  );
}

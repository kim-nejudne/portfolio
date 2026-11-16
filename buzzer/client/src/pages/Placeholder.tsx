import { Link } from 'react-router';
import { PageShell } from '../components/PageShell.js';
import { LINK } from '../lib/ui.js';

// The page for unknown routes.
export function Placeholder({ title }: { title: string }) {
  return (
    <PageShell width="narrow" className="items-center text-center">
      <h1 className="font-display text-4xl text-ink">{title}</h1>
      <p className="text-muted">Coming soon.</p>
      <Link to="/" className={`${LINK} text-lg`}>
        Back to start
      </Link>
    </PageShell>
  );
}

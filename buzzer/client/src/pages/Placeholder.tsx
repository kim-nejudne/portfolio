import { Link } from 'react-router';
import { BulbRail } from '../components/BulbRail.js';
import { PageShell } from '../components/PageShell.js';
import { LINK } from '../lib/ui.js';

// The page for unknown routes.
export function Placeholder({ title }: { title: string }) {
  return (
    <PageShell width="narrow" className="items-center text-center">
      <BulbRail count={9} variant="row" />
      <h1 className="font-display text-4xl text-accent">{title}</h1>
      <p className="text-muted">Coming soon.</p>
      <Link to="/" className={`${LINK} text-lg`}>
        Back to start
      </Link>
    </PageShell>
  );
}

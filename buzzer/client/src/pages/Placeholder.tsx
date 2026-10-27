import { Link, useParams } from 'react-router';

// Stand-in for views that later features build (Player, Screen, Host, set list and editor).
export function Placeholder({ title }: { title: string }) {
  const { code, setId } = useParams();
  const detail = code ?? setId;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-display text-4xl text-accent">{title}</h1>
      {detail && <p className="font-display text-3xl tracking-[0.2em]">{detail}</p>}
      <p className="text-muted">Coming soon.</p>
      <Link to="/" className="text-lg underline underline-offset-4">
        Back to start
      </Link>
    </main>
  );
}

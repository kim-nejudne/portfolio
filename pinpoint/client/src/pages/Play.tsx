import { useParams } from 'react-router';

// shortcut: a placeholder so Join lands somewhere; the join form and phone lobby are F10's.
export function Play() {
  const code = useParams().code ?? '';
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 text-center">
      <p className="board-face text-2xl text-amber">Game {code.toUpperCase()}</p>
    </main>
  );
}

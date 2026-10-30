import { useParams } from 'react-router';

// Placeholder from F01; joining, the draw pad and the guess box come later in the roadmap.
export function Play() {
  const { code } = useParams();
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <h1 className="text-2xl font-bold">Play {code}</h1>
    </main>
  );
}

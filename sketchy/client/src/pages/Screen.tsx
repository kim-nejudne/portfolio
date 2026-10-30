import { useParams } from 'react-router';

// Placeholder from F01; the Screen's lobby and live drawing come later in the roadmap.
export function Screen() {
  const { code } = useParams();
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <h1 className="text-4xl font-bold">Screen {code}</h1>
    </main>
  );
}

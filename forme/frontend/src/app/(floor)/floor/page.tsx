import type { Metadata } from 'next';
import { FloorBoard } from '@/components/floor/floor-board';
import { getPresses } from '@/lib/api/presses';

export const metadata: Metadata = {
  title: 'Press floor',
  robots: { index: false, follow: false },
};

export default async function FloorPage() {
  const presses = await getPresses();
  return (
    <main id="main">
      <FloorBoard initial={presses} />
    </main>
  );
}

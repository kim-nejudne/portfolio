import { GateNotice, SkipLink, SurfaceHeader } from '@/components/shell/chrome';
import { getSession } from '@/lib/api/session';

const NAV = [
  { href: '/prepress', label: 'Queue' },
  { href: '/floor', label: 'Floor board' },
  { href: '/specs', label: 'Artwork spec' },
];

export default async function PrepressLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const allowed = session.role === 'prepress' || session.role === 'admin';

  return (
    <>
      <SkipLink />
      <SurfaceHeader
        surface="Prepress"
        strap="07:00–19:00 · two shifts"
        nav={NAV}
        session={session}
        home="/prepress"
      />
      {allowed ? (
        children
      ) : (
        <GateNotice
          surface="Prepress"
          required="prepress"
          current={session.role}
          explanation="The prepress queue carries every customer's artwork and the override log, so it is kept behind a prepress or admin session."
        />
      )}
    </>
  );
}

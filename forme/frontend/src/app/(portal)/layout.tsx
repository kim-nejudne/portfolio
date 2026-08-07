import { GateNotice, SkipLink, SurfaceHeader } from '@/components/shell/chrome';
import { getSession } from '@/lib/api/session';

const NAV = [
  { href: '/app', label: 'Jobs' },
  { href: '/app/new', label: 'New job' },
  { href: '/specs', label: 'Artwork spec' },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <>
      <SkipLink />
      <SurfaceHeader
        surface="Customer portal"
        strap="Nine Dots Studio"
        nav={NAV}
        session={session}
        home="/app"
      />
      {session.role === 'customer' ? (
        children
      ) : (
        <GateNotice
          surface="The customer portal"
          required="customer"
          current={session.role}
          explanation="A customer session is scoped to one account, so the job list has to know which account you are. Switch role and you land on the Nine Dots Studio job list."
        />
      )}
    </>
  );
}

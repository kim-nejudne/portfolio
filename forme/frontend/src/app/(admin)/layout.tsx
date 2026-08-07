import { GateNotice, SkipLink, SurfaceHeader } from '@/components/shell/chrome';
import { getSession } from '@/lib/api/session';

const NAV = [
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/quote', label: 'Quote' },
  { href: '/prepress', label: 'Queue' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <>
      <SkipLink />
      <SurfaceHeader
        surface="Admin"
        strap="Price matrix"
        nav={NAV}
        session={session}
        home="/admin/pricing"
      />
      {session.role === 'admin' ? (
        children
      ) : (
        <GateNotice
          surface="Admin"
          required="admin"
          current={session.role}
          explanation="The price matrix drives every quote the shop issues, so it sits behind an admin session."
        />
      )}
    </>
  );
}

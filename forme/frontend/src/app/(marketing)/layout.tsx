import { Footer, SkipLink, SurfaceHeader } from '@/components/shell/chrome';

const NAV = [
  { href: '/specs', label: 'Artwork spec' },
  { href: '/quote', label: 'Instant quote' },
  { href: '/app', label: 'Portal' },
  { href: '/sign-in', label: 'Sign in' },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <SurfaceHeader
        surface="Trade printer"
        strap="Litho and digital"
        nav={NAV}
        session={null}
      />
      {children}
      <Footer />
    </>
  );
}

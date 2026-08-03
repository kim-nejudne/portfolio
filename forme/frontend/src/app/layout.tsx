import type { Metadata } from 'next';
import '@fontsource-variable/ibm-plex-sans/wght.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.FORME_PUBLIC_URL ?? 'https://forme.kimnejudne.dev'),
  title: {
    default: 'FORME \u2014 trade printer, Manila',
    template: '%s \u2014 FORME',
  },
  description:
    'Trade litho and digital printing in Manila. Heidelberg XL75, Komori G40, HP Indigo 12000. Five working days from proof approval.',
  applicationName: 'FORME',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

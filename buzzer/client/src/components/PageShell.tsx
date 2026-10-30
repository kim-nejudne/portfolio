import type { ReactNode } from 'react';

/** Narrow: a form or a phone column. Content: a reading page. Wide: grids and two panes. */
export type PageWidth = 'narrow' | 'content' | 'wide';

const WIDTHS: Record<PageWidth, string> = {
  narrow: 'max-w-md',
  content: 'max-w-3xl',
  wide: 'max-w-6xl',
};

interface PageShellProps {
  width?: PageWidth;
  /** The logo or back link, and the page's actions, above the content. */
  header?: ReactNode;
  /** Extra classes for the content column, such as `items-center text-center`. */
  className?: string;
  children: ReactNode;
}

/**
 * The frame of a phone-and-desktop page (FND-02): a centred column of one of three widths, with
 * gutters that grow on a tablet, and content from the top. The Screen and the buzzer use their own.
 */
export function PageShell({ width = 'content', header, className = '', children }: PageShellProps) {
  return (
    <div
      data-width={width}
      className={`mx-auto flex min-h-dvh w-full flex-col gap-6 px-4 py-6 short:py-3 md:px-8 md:py-10 ${WIDTHS[width]}`}
    >
      {header && <header className="flex flex-wrap items-center gap-3">{header}</header>}
      <main className={`flex flex-col gap-6 ${className}`}>{children}</main>
    </div>
  );
}

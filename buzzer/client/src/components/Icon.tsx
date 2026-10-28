import type { ReactNode } from 'react';

export type IconName =
  'check' | 'x' | 'arrow-right' | 'arrow-left' | 'undo' | 'eye' | 'skip' | 'trophy' | 'flag';

/** 24×24 stroke paths, drawn in `currentColor`. */
const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  'arrow-right': <path d="M4 12h15M13 6l6 6-6 6" />,
  'arrow-left': <path d="M20 12H5M11 6l-6 6 6 6" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  skip: <path d="M5 5l9 7-9 7V5zM19 5v14" />,
  trophy: (
    <path d="M8 4h8v5a4 4 0 01-8 0V4zM8 6H4.5a3 3 0 003.5 4M16 6h3.5a3 3 0 01-3.5 4M12 13v4M8 20h8M10 17h4v3h-4z" />
  ),
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
};

/** An inline SVG stroke icon. Decorative: the button or text beside it carries the name. */
export function Icon({ name, className = 'size-6' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}

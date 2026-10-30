import type { ReactNode } from 'react';

export type IconName =
  | 'check'
  | 'half'
  | 'x'
  | 'arrow-right'
  | 'arrow-left'
  | 'undo'
  | 'eye'
  | 'skip'
  | 'trophy'
  | 'flag'
  | 'more'
  | 'tv'
  | 'cast'
  | 'remote'
  | 'phone'
  | 'grip';

/** 24×24 stroke paths, drawn in `currentColor`. */
const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  // A circle split down the middle: half points.
  half: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" />
    </>
  ),
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
  // Three dots in a column: zero-length strokes with round caps.
  more: <path d="M12 5h.01M12 12h.01M12 19h.01" strokeWidth={4} />,
  tv: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  // A screen with the cast waves in its corner: the Screen on another device.
  cast: (
    <path d="M3 8V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2h-6M3 12a8 8 0 018 8M3 16a4 4 0 014 4" />
  ),
  // A phone with a big button: the host remote.
  remote: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <circle cx="12" cy="10" r="3" />
      <path d="M12 17h.01" strokeWidth={4} />
    </>
  ),
  // Two columns of three dots: the drag handle of a reorderable card (EDT-05).
  grip: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth={4} />,
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M10.5 18h3" />
    </>
  ),
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

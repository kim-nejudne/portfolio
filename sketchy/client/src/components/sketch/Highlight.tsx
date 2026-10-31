import type { ReactNode } from 'react';

/**
 * A highlighter swash behind some words (Sketchbook primitives): `hl` at 85 %, an uneven radius,
 * tilted −1.2°. Only the swash tilts; the text stays level (`highlight` in index.css).
 */
export function Highlight({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`highlight ${className}`.trim()}>{children}</span>;
}

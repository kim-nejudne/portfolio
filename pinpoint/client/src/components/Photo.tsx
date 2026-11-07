import { useState, type ReactNode } from 'react';

/** A round's photo, or `fallback` (the "Photo unavailable" card) once that URL fails to load. */
export function Photo({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return fallback;
  return <img src={src} alt={alt} onError={() => setFailed(src)} className={className} />;
}

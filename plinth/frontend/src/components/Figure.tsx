import { useState } from 'react';
import { IMAGES, type ImageSlot } from '../images';

interface FigureProps {
  id: ImageSlot['id'];
  className?: string;
}

export function Figure({ id, className = '' }: FigureProps) {
  const slot = IMAGES.find((s) => s.id === id);
  const [failed, setFailed] = useState(false);

  if (!slot || slot.url === '' || failed) {
    return (
      <div
        role="img"
        aria-label={slot?.brief ?? 'Reserved image slot'}
        data-testid={`figure-${id}`}
        className={`aspect-[4/3] border border-ink bg-blue ${className}`}
      />
    );
  }

  return (
    <img
      src={slot.url}
      alt={slot.alt}
      onError={() => setFailed(true)}
      data-testid={`figure-${id}`}
      className={`aspect-[4/3] object-cover ${className}`}
    />
  );
}

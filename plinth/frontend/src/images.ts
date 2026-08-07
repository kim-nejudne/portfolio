export interface ImageSlot {
  id: 'plate-texture' | 'block-portrait' | 'session-detail' | 'og-card';
  url: string;
  alt: string;
  brief: string;
  decorative: boolean;
}

export const IMAGES: ImageSlot[] = [
  {
    id: 'plate-texture',
    url: '',
    alt: '',
    brief: 'Optional later: grain/halftone texture overlay for the ink plates',
    decorative: true,
  },
  {
    id: 'block-portrait',
    url: '',
    alt: '',
    brief: 'Optional later: one typographic portrait per training block, if art is ever commissioned',
    decorative: true,
  },
  {
    id: 'session-detail',
    url: '',
    alt: '',
    brief: 'Optional later: a scanned page from the printed program for the session plate',
    decorative: true,
  },
  {
    id: 'og-card',
    url: '',
    alt: '',
    brief: 'Optional later: social share card, 1200x630, headline over bone ground',
    decorative: true,
  },
];

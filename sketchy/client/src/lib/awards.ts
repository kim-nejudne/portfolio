import type { Award } from '../../../shared/types.js';
import type { CopyKey } from './copy.js';

/** Each award's name ("🎨 Picasso") and why it was won, in the copy tables. */
export const AWARD_COPY: Record<Award['kind'], { name: CopyKey; why: CopyKey }> = {
  picasso: { name: 'awardPicasso', why: 'awardPicassoWhy' },
  bilis: { name: 'awardBilis', why: 'awardBilisWhy' },
  sharpshooter: { name: 'awardSharpshooter', why: 'awardSharpshooterWhy' },
  malapitNa: { name: 'awardMalapitNa', why: 'awardMalapitNaWhy' },
  mostCreative: { name: 'awardMostCreative', why: 'awardMostCreativeWhy' },
  modernArt: { name: 'awardModernArt', why: 'awardModernArtWhy' },
};

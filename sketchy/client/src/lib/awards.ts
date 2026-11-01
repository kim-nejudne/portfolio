import type { Award } from '../../../shared/types.js';
import type { CopyKey } from './copy.js';

/** Each award's name ("🎨 Picasso") and why it was won, in the copy table. */
export const AWARD_COPY: Record<Award['kind'], { name: CopyKey; why: CopyKey }> = {
  picasso: { name: 'awardPicasso', why: 'awardPicassoWhy' },
  speedDemon: { name: 'awardSpeedDemon', why: 'awardSpeedDemonWhy' },
  sharpshooter: { name: 'awardSharpshooter', why: 'awardSharpshooterWhy' },
  almost: { name: 'awardAlmost', why: 'awardAlmostWhy' },
  mostCreative: { name: 'awardMostCreative', why: 'awardMostCreativeWhy' },
  modernArt: { name: 'awardModernArt', why: 'awardModernArtWhy' },
};

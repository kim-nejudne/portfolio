import type { PriceMatrix } from '@/lib/types';

/**
 * Rates are whole pesos. Multipliers are integer per-mille: 1000 = 1.000x.
 */
export const PRICE_MATRIX: PriceMatrix = {
  products: [
    {
      id: 'business-cards',
      label: 'Business cards',
      setup: 750,
      perThousand: 1250,
      note: '85 \u00d7 55mm, boards only, step and repeat',
    },
    {
      id: 'flyers',
      label: 'Flyers',
      setup: 900,
      perThousand: 1850,
      note: 'Single sheet, trimmed four sides',
    },
    {
      id: 'booklets',
      label: 'Booklets',
      setup: 2600,
      perThousand: 2400,
      note: 'Rate is per 1,000 copies per 4pp signature',
    },
    {
      id: 'posters',
      label: 'Posters',
      setup: 1100,
      perThousand: 5200,
      note: 'A3 and larger, litho only above 500 sheets',
    },
    {
      id: 'folded-leaflets',
      label: 'Folded leaflets',
      setup: 1000,
      perThousand: 2450,
      note: 'Folding charged separately per finishing line',
    },
  ],
  stocks: [
    { id: 'gloss-130', label: '130gsm gloss art', gsm: 130, coated: true, inkLimit: 300, multiplier: 1000 },
    { id: 'silk-150', label: '150gsm silk', gsm: 150, coated: true, inkLimit: 300, multiplier: 1060 },
    { id: 'uncoated-170', label: '170gsm uncoated', gsm: 170, coated: false, inkLimit: 260, multiplier: 1120 },
    { id: 'silk-board-300', label: '300gsm silk board', gsm: 300, coated: true, inkLimit: 300, multiplier: 1480 },
    { id: 'uncoated-board-350', label: '350gsm uncoated board', gsm: 350, coated: false, inkLimit: 260, multiplier: 1620 },
    { id: 'colorplan-270', label: 'Colorplan 270gsm', gsm: 270, coated: false, inkLimit: 260, multiplier: 2150 },
  ],
  quantityBreaks: [
    { quantity: 100, multiplier: 1600 },
    { quantity: 250, multiplier: 1300 },
    { quantity: 500, multiplier: 1120 },
    { quantity: 1000, multiplier: 1000 },
    { quantity: 2500, multiplier: 920 },
    { quantity: 5000, multiplier: 860 },
  ],
  finishing: [
    { id: 'trim', label: 'Trim only', perThousand: 0, flat: 0, bindery: false },
    { id: 'half-fold', label: 'Half fold', perThousand: 420, flat: 0, bindery: true },
    { id: 'roll-fold', label: 'Roll fold', perThousand: 620, flat: 0, bindery: true },
    { id: 'gate-fold', label: 'Gate fold', perThousand: 780, flat: 0, bindery: true },
    { id: 'saddle-stitch', label: 'Saddle stitch', perThousand: 1250, flat: 350, bindery: true },
    { id: 'perfect-bound', label: 'Perfect bound', perThousand: 2600, flat: 1200, bindery: true },
    { id: 'matt-lam', label: 'Matt lamination', perThousand: 1450, flat: 0, bindery: true },
    { id: 'gloss-lam', label: 'Gloss lamination', perThousand: 1380, flat: 0, bindery: true },
    { id: 'spot-uv', label: 'Spot UV', perThousand: 2100, flat: 900, bindery: true },
    { id: 'die-cut', label: 'Die cut', perThousand: 1900, flat: 2400, bindery: true },
  ],
  turnarounds: [
    { id: 'standard', label: 'Standard', workingDays: 5, multiplier: 1000 },
    { id: 'express', label: 'Express', workingDays: 3, multiplier: 1250 },
    { id: 'rush', label: 'Rush', workingDays: 1, multiplier: 1800 },
  ],
  colours: [
    { id: '4/4', label: '4/4 CMYK both sides', plates: 8, multiplier: 1000 },
    { id: '4/0', label: '4/0 CMYK one side', plates: 4, multiplier: 720 },
    { id: '1/1', label: '1/1 black both sides', plates: 2, multiplier: 480 },
    { id: '5/4', label: '5/4 CMYK + spot', plates: 9, multiplier: 1240 },
  ],
  sizes: [
    { id: 'A6', label: 'A6', widthMm: 105, heightMm: 148 },
    { id: 'A5', label: 'A5', widthMm: 148, heightMm: 210 },
    { id: 'A4', label: 'A4', widthMm: 210, heightMm: 297 },
    { id: 'A3', label: 'A3', widthMm: 297, heightMm: 420 },
    { id: 'DL', label: 'DL', widthMm: 99, heightMm: 210 },
    { id: '85x55', label: '85 \u00d7 55mm', widthMm: 85, heightMm: 55 },
  ],
};
